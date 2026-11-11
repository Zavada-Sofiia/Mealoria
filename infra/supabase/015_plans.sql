-- Free and premium plans.
-- subscriptions: who is premium. Users can read their own row but cannot write it; rows are
-- created by admins (admin_set_plan below) or, later, by a payment webhook.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'premium' check (plan in ('free', 'premium')),
  premium_until timestamptz,            -- null = no expiry
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscription: select" on public.subscriptions;
create policy "own subscription: select" on public.subscriptions
  for select using (auth.uid() = user_id);

-- The single place where plan limits are defined (change the numbers here).
create or replace function public.plan_table()
returns json
language sql
immutable
as $$
  select json_build_object(
    'free',    json_build_object('dishes', 15,  'ai_per_day', 3,  'plan_days_ahead', 14),
    'premium', json_build_object('dishes', 500, 'ai_per_day', 50, 'plan_days_ahead', 365)
  );
$$;
grant execute on function public.plan_table() to anon, authenticated;

create or replace function public.internal_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from public.subscriptions s
    where s.user_id = uid and s.plan = 'premium'
      and (s.premium_until is null or s.premium_until > now())
  ) then 'premium' else 'free' end;
$$;
revoke all on function public.internal_plan(uuid) from public, anon, authenticated;

create or replace function public.my_limits()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p text := public.internal_plan(auth.uid());
  until timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select premium_until into until from public.subscriptions where user_id = auth.uid();
  return (
    jsonb_build_object('plan', p, 'premium_until', case when p = 'premium' then until end)
    || (public.plan_table()::jsonb -> p)
  )::json;
end;
$$;
revoke all on function public.my_limits() from public, anon;
grant execute on function public.my_limits() to authenticated;

-- Limits enforced by the database, so they cannot be bypassed by calling the API directly.
create or replace function public.enforce_dish_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int := ((public.plan_table() -> public.internal_plan(new.user_id)) ->> 'dishes')::int;
begin
  if (select count(*) from public.dishes where user_id = new.user_id) >= lim then
    raise exception 'plan_limit:dishes' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists dishes_plan_limit on public.dishes;
create trigger dishes_plan_limit before insert on public.dishes
  for each row execute function public.enforce_dish_limit();

create or replace function public.enforce_plan_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int := ((public.plan_table() -> public.internal_plan(new.user_id)) ->> 'plan_days_ahead')::int;
begin
  if new.date > (now() at time zone 'utc')::date + lim then
    raise exception 'plan_limit:plan_days' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists meal_plan_window on public.meal_plan;
create trigger meal_plan_window before insert or update of date on public.meal_plan
  for each row execute function public.enforce_plan_window();

-- Admin tools (only for users listed in public.admins).
create or replace function public.admin_set_plan(target_email text, new_plan text, days int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  until timestamptz := case when days is null then null else now() + make_interval(days => days) end;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_plan not in ('free', 'premium') then
    return json_build_object('ok', false, 'error', 'bad_plan');
  end if;
  select id into uid from auth.users where lower(email) = lower(target_email);
  if uid is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;
  insert into public.subscriptions (user_id, plan, premium_until)
  values (uid, new_plan, until)
  on conflict (user_id) do update
    set plan = excluded.plan, premium_until = excluded.premium_until, updated_at = now();
  return json_build_object('ok', true, 'email', target_email, 'plan', new_plan, 'premium_until', until);
end;
$$;

create or replace function public.admin_premium_users()
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'email', u.email,
      'premium_until', s.premium_until,
      'active', s.plan = 'premium' and (s.premium_until is null or s.premium_until > now())
    ) order by s.updated_at desc)
    from public.subscriptions s join auth.users u on u.id = s.user_id
    where s.plan = 'premium'
  ), '[]'::json);
end;
$$;

revoke all on function public.admin_set_plan(text, text, int) from public, anon;
revoke all on function public.admin_premium_users() from public, anon;
grant execute on function public.admin_set_plan(text, text, int) to authenticated;
grant execute on function public.admin_premium_users() to authenticated;

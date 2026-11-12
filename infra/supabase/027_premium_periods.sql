-- Premium for a period (1, 3, 6, 12 months) that is always ADDED to what the user already has,
-- a history of every grant for the developer page, and the period chosen in a pre-order.

create table if not exists public.premium_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  source text not null check (source in ('admin', 'promo', 'reset')),
  months int not null default 0,
  days int not null default 0,
  unlimited boolean not null default false,
  note text not null default '',                  -- the promo code, for example
  was_active boolean not null default false,      -- did the user already have Premium
  previous_until timestamptz,                     -- null: no Premium before, or Premium without an end
  new_until timestamptz,                          -- null: Premium without an end (or reset to free)
  granted_at timestamptz not null default now()
);
create index if not exists premium_grants_at_idx on public.premium_grants (granted_at desc);
alter table public.premium_grants enable row level security;  -- no policies: only the functions below

-- The one place that adds time. The new end is counted from the current end while Premium is still
-- active, otherwise from now. Premium without an end stays without an end.
create or replace function public.internal_extend_premium(
  uid uuid, add_months int, add_days int, make_unlimited boolean, src text, grant_note text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub public.subscriptions%rowtype;
  active boolean;
  prev timestamptz;
  new_until timestamptz;
  mail text;
begin
  select email into mail from auth.users where id = uid;
  select * into sub from public.subscriptions where user_id = uid for update;
  active := found and sub.plan = 'premium' and (sub.premium_until is null or sub.premium_until > now());
  if active then
    prev := sub.premium_until;
  end if;

  if make_unlimited or (active and sub.premium_until is null) then
    new_until := null;
  else
    new_until := (case when active then sub.premium_until else now() end)
      + make_interval(months => coalesce(add_months, 0), days => coalesce(add_days, 0));
  end if;

  insert into public.subscriptions (user_id, plan, premium_until)
  values (uid, 'premium', new_until)
  on conflict (user_id) do update
    set plan = 'premium', premium_until = excluded.premium_until, updated_at = now();

  insert into public.premium_grants (user_id, email, source, months, days, unlimited, note, was_active, previous_until, new_until)
  values (uid, mail, src, coalesce(add_months, 0), coalesce(add_days, 0), new_until is null, coalesce(grant_note, ''), active, prev, new_until);

  return json_build_object(
    'ok', true, 'was_active', active, 'previous_until', prev, 'new_until', new_until, 'unlimited', new_until is null
  );
end;
$$;
revoke all on function public.internal_extend_premium(uuid, int, int, boolean, text, text) from public, anon, authenticated;

create or replace function public.admin_grant_premium(
  target_email text, add_months int, add_days int, make_unlimited boolean
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(add_months, 0) < 0 or coalesce(add_months, 0) > 120 or coalesce(add_days, 0) < 0 or coalesce(add_days, 0) > 3650 then
    return json_build_object('ok', false, 'error', 'bad_period');
  end if;
  if not make_unlimited and coalesce(add_months, 0) = 0 and coalesce(add_days, 0) = 0 then
    return json_build_object('ok', false, 'error', 'bad_period');
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(target_email));
  if uid is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;
  return public.internal_extend_premium(uid, add_months, add_days, make_unlimited, 'admin', '');
end;
$$;

-- The older tool keeps working, but Premium given with it is added too (it used to replace the end date).
create or replace function public.admin_set_plan(target_email text, new_plan text, days int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  sub public.subscriptions%rowtype;
  was boolean;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_plan not in ('free', 'premium') then
    return json_build_object('ok', false, 'error', 'bad_plan');
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(target_email));
  if uid is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;
  if new_plan = 'premium' then
    return public.internal_extend_premium(uid, 0, days, days is null, 'admin', '');
  end if;
  select * into sub from public.subscriptions where user_id = uid;
  was := found and sub.plan = 'premium' and (sub.premium_until is null or sub.premium_until > now());
  insert into public.subscriptions (user_id, plan, premium_until)
  values (uid, 'free', null)
  on conflict (user_id) do update set plan = 'free', premium_until = null, updated_at = now();
  insert into public.premium_grants (user_id, email, source, was_active, previous_until, new_until)
  values (uid, (select email from auth.users where id = uid), 'reset', was, case when was then sub.premium_until end, null);
  return json_build_object('ok', true, 'email', target_email, 'plan', 'free');
end;
$$;

-- A promo code adds its days the same way.
create or replace function public.redeem_promo(input_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c text := upper(trim(input_code));
  promo public.promo_codes%rowtype;
  result json;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if (select count(*) from public.promo_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  select * into promo from public.promo_codes where code = c for update;
  if not found then
    insert into public.promo_attempts (user_id) values (uid);
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if exists (select 1 from public.promo_redemptions where code = c and user_id = uid) then
    return json_build_object('ok', false, 'error', 'already_used');
  end if;
  if promo.max_uses is not null and promo.used_count >= promo.max_uses then
    return json_build_object('ok', false, 'error', 'used_up');
  end if;

  result := public.internal_extend_premium(uid, 0, promo.days, false, 'promo', c);
  insert into public.promo_redemptions (code, user_id) values (c, uid);
  update public.promo_codes set used_count = used_count + 1 where code = c;
  return json_build_object(
    'ok', true, 'days', promo.days,
    'premium_until', result -> 'new_until', 'unlimited', (result ->> 'unlimited')::boolean
  );
end;
$$;

create or replace function public.admin_premium_history(max_rows int default 100)
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
    select json_agg(row_to_json(g) order by g.granted_at desc)
    from (
      select email, source, months, days, unlimited, note, was_active, previous_until, new_until, granted_at
      from public.premium_grants order by granted_at desc limit least(greatest(max_rows, 1), 500)
    ) g
  ), '[]'::json);
end;
$$;

-- The period chosen when pre-ordering Premium (1, 3, 6 or 12 months).
alter table public.preorders add column if not exists months int check (months in (1, 3, 6, 12));
drop policy if exists "own preorder: update" on public.preorders;
create policy "own preorder: update" on public.preorders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.admin_preorders_by_period()
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
    select json_agg(json_build_object('months', months, 'count', n) order by months nulls first)
    from (select months, count(*) as n from public.preorders group by months) p
  ), '[]'::json);
end;
$$;

revoke all on function public.admin_grant_premium(text, int, int, boolean) from public, anon;
revoke all on function public.admin_set_plan(text, text, int) from public, anon;
revoke all on function public.redeem_promo(text) from public, anon;
revoke all on function public.admin_premium_history(int) from public, anon;
revoke all on function public.admin_preorders_by_period() from public, anon;
grant execute on function public.admin_grant_premium(text, int, int, boolean) to authenticated;
grant execute on function public.admin_set_plan(text, text, int) to authenticated;
grant execute on function public.redeem_promo(text) to authenticated;
grant execute on function public.admin_premium_history(int) to authenticated;
grant execute on function public.admin_preorders_by_period() to authenticated;

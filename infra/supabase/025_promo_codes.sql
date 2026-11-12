-- Promo codes: an admin creates a code for N days of Premium, a user redeems it on the Pricing page.
-- The tables have row level security and no policies: everything goes through the functions below.
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and char_length(code) between 3 and 40),
  days int not null check (days between 1 and 3650),
  max_uses int check (max_uses is null or max_uses >= 1),  -- null = unlimited
  used_count int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
-- failed attempts, so that codes cannot be guessed by trying many
create table if not exists public.promo_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists promo_attempts_idx on public.promo_attempts (user_id, at);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_attempts enable row level security;

create or replace function public.admin_create_promo(new_code text, new_days int, new_max_uses int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text := upper(trim(new_code));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(c) < 3 or char_length(c) > 40 or c !~ '^[A-Z0-9А-ЯІЇЄҐ_-]+$' then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if new_days is null or new_days < 1 or new_days > 3650 then
    return json_build_object('ok', false, 'error', 'bad_days');
  end if;
  if exists (select 1 from public.promo_codes where code = c) then
    return json_build_object('ok', false, 'error', 'exists');
  end if;
  insert into public.promo_codes (code, days, max_uses) values (c, new_days, new_max_uses);
  return json_build_object('ok', true, 'code', c, 'days', new_days, 'max_uses', new_max_uses);
end;
$$;

create or replace function public.admin_list_promos()
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
      'code', code, 'days', days, 'max_uses', max_uses, 'used_count', used_count, 'created_at', created_at
    ) order by created_at desc)
    from public.promo_codes
  ), '[]'::json);
end;
$$;

create or replace function public.admin_delete_promo(target_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.promo_codes where code = upper(trim(target_code));
  return json_build_object('ok', found);
end;
$$;

-- A user redeems a code: Premium for its number of days, added to what they already have.
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
  sub public.subscriptions%rowtype;
  new_until timestamptz;
  unlimited boolean := false;
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

  select * into sub from public.subscriptions where user_id = uid;
  if found and sub.plan = 'premium' and sub.premium_until is null then
    unlimited := true;  -- already premium without an end: nothing to add
    new_until := null;
  else
    new_until := greatest(
      now(),
      case when found and sub.plan = 'premium' then coalesce(sub.premium_until, now()) else now() end
    ) + make_interval(days => promo.days);
    insert into public.subscriptions (user_id, plan, premium_until)
    values (uid, 'premium', new_until)
    on conflict (user_id) do update
      set plan = 'premium', premium_until = excluded.premium_until, updated_at = now();
  end if;

  insert into public.promo_redemptions (code, user_id) values (c, uid);
  update public.promo_codes set used_count = used_count + 1 where code = c;
  return json_build_object('ok', true, 'days', promo.days, 'premium_until', new_until, 'unlimited', unlimited);
end;
$$;

revoke all on function public.admin_create_promo(text, int, int) from public, anon;
revoke all on function public.admin_list_promos() from public, anon;
revoke all on function public.admin_delete_promo(text) from public, anon;
revoke all on function public.redeem_promo(text) from public, anon;
grant execute on function public.admin_create_promo(text, int, int) to authenticated;
grant execute on function public.admin_list_promos() to authenticated;
grant execute on function public.admin_delete_promo(text) to authenticated;
grant execute on function public.redeem_promo(text) to authenticated;

-- Paying for Premium by a bank transfer with a personal code. The buyer gets an order with a code
-- (ML-XXXXXX), sends the money to the card and writes the code in the comment. The backend reads the
-- incoming payment from the bank and confirms the order here, which adds Premium. An admin can also
-- confirm an order by hand. Premium is always ADDED to the current end (see internal_extend_premium).

alter table public.premium_grants drop constraint if exists premium_grants_source_check;
alter table public.premium_grants
  add constraint premium_grants_source_check check (source in ('admin', 'promo', 'reset', 'card'));

-- Prices live in the database, so a buyer cannot choose their own price.
create table if not exists public.premium_prices (
  months int primary key check (months in (1, 3, 6, 12)),
  amount_uah int not null check (amount_uah > 0)
);
insert into public.premium_prices (months, amount_uah)
values (1, 49), (3, 129), (6, 239), (12, 449)
on conflict (months) do nothing;
alter table public.premium_prices enable row level security;
drop policy if exists "prices: read" on public.premium_prices;
create policy "prices: read" on public.premium_prices for select using (true);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  code text not null unique,
  months int not null check (months in (1, 3, 6, 12)),
  amount_uah int not null check (amount_uah > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  bank_tx_id text unique,                          -- the bank's id of the payment: one payment, one order
  paid_kopecks int,
  paid_by text check (paid_by in ('auto', 'admin')),
  note text not null default ''
);
create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at desc);
alter table public.payment_orders enable row level security;  -- no policies: only the functions below

-- Only the hash of the secret is stored. The backend keeps the secret itself (PAYMENTS_SECRET).
create table if not exists public.payment_secret (
  id int primary key check (id = 1),
  secret_hash text not null
);
alter table public.payment_secret enable row level security;

create or replace function public.internal_secret_hash(secret text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(sha256(convert_to(coalesce(secret, ''), 'UTF8')), 'hex') $$;
revoke all on function public.internal_secret_hash(text) from public, anon, authenticated;

-- An order for a period. A pending order for the same period is returned again instead of a new one,
-- so a user never has more than four open orders.
create or replace function public.create_payment_order(order_months int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  price int;
  existing public.payment_orders%rowtype;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/I/L
  new_code text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select amount_uah into price from public.premium_prices where months = order_months;
  if price is null then
    return json_build_object('ok', false, 'error', 'bad_period');
  end if;

  select * into existing from public.payment_orders
  where user_id = uid and status = 'pending' and months = order_months and created_at > now() - interval '7 days'
  order by created_at desc limit 1;
  if found then
    return json_build_object('ok', true, 'code', existing.code, 'months', existing.months,
      'amount_uah', existing.amount_uah, 'created_at', existing.created_at);
  end if;

  loop
    new_code := 'ML-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.payment_orders where code = new_code);
  end loop;

  insert into public.payment_orders (user_id, email, code, months, amount_uah)
  values (uid, (select email from auth.users where id = uid), new_code, order_months, price);
  return json_build_object('ok', true, 'code', new_code, 'months', order_months, 'amount_uah', price, 'created_at', now());
end;
$$;

create or replace function public.my_payment_orders()
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(o) order by o.created_at desc), '[]'::json)
  from (
    select code, months, amount_uah, status, created_at, paid_at
    from public.payment_orders where user_id = auth.uid() order by created_at desc limit 20
  ) o
$$;

create or replace function public.cancel_payment_order(order_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_orders set status = 'cancelled'
  where code = upper(trim(order_code)) and user_id = auth.uid() and status = 'pending';
  return json_build_object('ok', found);
end;
$$;

-- Called by the backend (no signed-in user) when the bank reports an incoming payment.
create or replace function public.confirm_card_payment(
  shared_secret text, order_code text, tx_id text, paid_kopecks int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.payment_orders%rowtype;
  stored text;
  result json;
begin
  select secret_hash into stored from public.payment_secret where id = 1;
  if stored is null or stored <> public.internal_secret_hash(shared_secret) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(tx_id, '') = '' then
    return json_build_object('ok', false, 'error', 'no_tx');
  end if;
  if exists (select 1 from public.payment_orders where bank_tx_id = tx_id) then
    return json_build_object('ok', false, 'error', 'already_used');
  end if;

  select * into ord from public.payment_orders
  where code = upper(trim(order_code)) and status = 'pending' and created_at > now() - interval '30 days'
  for update;
  if not found then
    return json_build_object('ok', false, 'error', 'no_order');
  end if;
  if coalesce(paid_kopecks, 0) < ord.amount_uah * 100 then
    return json_build_object('ok', false, 'error', 'amount_too_low', 'expected_kopecks', ord.amount_uah * 100);
  end if;

  update public.payment_orders
  set status = 'paid', paid_at = now(), bank_tx_id = tx_id, paid_kopecks = confirm_card_payment.paid_kopecks, paid_by = 'auto'
  where id = ord.id;
  result := public.internal_extend_premium(ord.user_id, ord.months, 0, false, 'card', ord.code);
  return json_build_object('ok', true, 'months', ord.months, 'new_until', result->'new_until');
end;
$$;

-- Admin: confirm an order by hand (the comment was missing, or the amount did not match).
create or replace function public.admin_confirm_order(order_code text, admin_note text default '')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  ord public.payment_orders%rowtype;
  result json;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into ord from public.payment_orders where code = upper(trim(order_code)) and status = 'pending' for update;
  if not found then
    return json_build_object('ok', false, 'error', 'no_order');
  end if;
  update public.payment_orders set status = 'paid', paid_at = now(), paid_by = 'admin', note = coalesce(admin_note, '')
  where id = ord.id;
  result := public.internal_extend_premium(ord.user_id, ord.months, 0, false, 'card', ord.code);
  return json_build_object('ok', true, 'months', ord.months, 'new_until', result->'new_until');
end;
$$;

create or replace function public.admin_payment_orders(max_rows int default 100)
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
    select json_agg(row_to_json(o) order by o.created_at desc)
    from (
      select email, code, months, amount_uah, status, paid_by, created_at, paid_at, paid_kopecks
      from public.payment_orders order by created_at desc limit least(greatest(max_rows, 1), 500)
    ) o
  ), '[]'::json);
end;
$$;

create or replace function public.admin_payment_status()
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return json_build_object(
    'secret_set', exists (select 1 from public.payment_secret),
    'pending', (select count(*) from public.payment_orders where status = 'pending'),
    'paid', (select count(*) from public.payment_orders where status = 'paid'),
    'paid_uah', coalesce((select sum(amount_uah) from public.payment_orders where status = 'paid'), 0)
  );
end;
$$;

create or replace function public.admin_set_payment_secret(new_secret text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(coalesce(new_secret, '')) < 32 then
    return json_build_object('ok', false, 'error', 'too_short');
  end if;
  insert into public.payment_secret (id, secret_hash) values (1, public.internal_secret_hash(new_secret))
  on conflict (id) do update set secret_hash = excluded.secret_hash;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_check_payment_secret(candidate text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return exists (select 1 from public.payment_secret where secret_hash = public.internal_secret_hash(candidate));
end;
$$;

revoke all on function public.create_payment_order(int) from public, anon;
revoke all on function public.my_payment_orders() from public, anon;
revoke all on function public.cancel_payment_order(text) from public, anon;
revoke all on function public.confirm_card_payment(text, text, text, int) from public;
revoke all on function public.admin_confirm_order(text, text) from public, anon;
revoke all on function public.admin_payment_orders(int) from public, anon;
revoke all on function public.admin_payment_status() from public, anon;
revoke all on function public.admin_set_payment_secret(text) from public, anon;
revoke all on function public.admin_check_payment_secret(text) from public, anon;
grant execute on function public.create_payment_order(int) to authenticated;
grant execute on function public.my_payment_orders() to authenticated;
grant execute on function public.cancel_payment_order(text) to authenticated;
grant execute on function public.confirm_card_payment(text, text, text, int) to anon, authenticated;
grant execute on function public.admin_confirm_order(text, text) to authenticated;
grant execute on function public.admin_payment_orders(int) to authenticated;
grant execute on function public.admin_payment_status() to authenticated;
grant execute on function public.admin_set_payment_secret(text) to authenticated;
grant execute on function public.admin_check_payment_secret(text) to authenticated;

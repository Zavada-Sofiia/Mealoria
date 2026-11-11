-- Favourite dishes, a weight journal and self-service account deletion.

alter table public.dishes add column if not exists favorite boolean not null default false;

create table if not exists public.weight_log (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 20 and 400),
  primary key (user_id, day)
);
alter table public.weight_log enable row level security;

drop policy if exists "weight_log: select own" on public.weight_log;
create policy "weight_log: select own" on public.weight_log
  for select using (user_id = auth.uid());
drop policy if exists "weight_log: insert own" on public.weight_log;
create policy "weight_log: insert own" on public.weight_log
  for insert with check (user_id = auth.uid());
drop policy if exists "weight_log: update own" on public.weight_log;
create policy "weight_log: update own" on public.weight_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "weight_log: delete own" on public.weight_log;
create policy "weight_log: delete own" on public.weight_log
  for delete using (user_id = auth.uid());

-- Deletes the signed-in user. Every table above references auth.users with "on delete cascade",
-- so profile, dishes, plan, shopping data, usage counters and plan rows go with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

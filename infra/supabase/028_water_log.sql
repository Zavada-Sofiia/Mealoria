-- Water drunk during a day: one row per glass or bottle, so a mistake can be removed.
create table if not exists public.water_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  amount_ml int not null check (amount_ml between 10 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists water_log_user_day_idx on public.water_log (user_id, day, created_at);

alter table public.water_log enable row level security;
drop policy if exists "water_log: own rows" on public.water_log;
create policy "water_log: own rows" on public.water_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

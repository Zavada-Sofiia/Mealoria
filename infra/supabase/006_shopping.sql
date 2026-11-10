create table if not exists public.pantry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  unique (user_id, name)
);

create table if not exists public.shopping_checks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  name text not null,
  primary key (user_id, week_start, name)
);

alter table public.pantry enable row level security;
alter table public.shopping_checks enable row level security;

drop policy if exists "own pantry: all" on public.pantry;
create policy "own pantry: all" on public.pantry
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own checks: all" on public.shopping_checks;
create policy "own checks: all" on public.shopping_checks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

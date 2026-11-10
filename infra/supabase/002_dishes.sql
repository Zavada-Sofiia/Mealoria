create table if not exists public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  recipe text not null default '' check (char_length(recipe) <= 5000),
  ingredients jsonb not null default '[]'::jsonb,
  calories int check (calories between 0 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists dishes_user_id_idx on public.dishes (user_id);

alter table public.dishes enable row level security;

drop policy if exists "own dishes: select" on public.dishes;
create policy "own dishes: select" on public.dishes
  for select using (auth.uid() = user_id);
drop policy if exists "own dishes: insert" on public.dishes;
create policy "own dishes: insert" on public.dishes
  for insert with check (auth.uid() = user_id);
drop policy if exists "own dishes: update" on public.dishes;
create policy "own dishes: update" on public.dishes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own dishes: delete" on public.dishes;
create policy "own dishes: delete" on public.dishes
  for delete using (auth.uid() = user_id);

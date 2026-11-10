create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  slot int not null check (slot between 0 and 7),
  dish_id uuid not null references public.dishes (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_user_date_idx on public.meal_plan (user_id, date);

alter table public.meal_plan enable row level security;

drop policy if exists "own plan: select" on public.meal_plan;
create policy "own plan: select" on public.meal_plan
  for select using (auth.uid() = user_id);

drop policy if exists "own plan: insert" on public.meal_plan;
create policy "own plan: insert" on public.meal_plan
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.dishes d where d.id = dish_id and d.user_id = auth.uid())
  );

drop policy if exists "own plan: update" on public.meal_plan;
create policy "own plan: update" on public.meal_plan
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own plan: delete" on public.meal_plan;
create policy "own plan: delete" on public.meal_plan
  for delete using (auth.uid() = user_id);

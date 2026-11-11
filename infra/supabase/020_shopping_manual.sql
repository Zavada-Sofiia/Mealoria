-- Products the user adds to the shopping list by hand, without any dish in the calendar.
create table if not exists public.shopping_manual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shopping_manual_user_idx on public.shopping_manual (user_id, created_at);

alter table public.shopping_manual enable row level security;

drop policy if exists "own manual items: all" on public.shopping_manual;
create policy "own manual items: all" on public.shopping_manual
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

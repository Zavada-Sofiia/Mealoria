create table if not exists public.preorders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.preorders enable row level security;

drop policy if exists "own preorder: select" on public.preorders;
create policy "own preorder: select" on public.preorders
  for select using (auth.uid() = user_id);
drop policy if exists "own preorder: insert" on public.preorders;
create policy "own preorder: insert" on public.preorders
  for insert with check (auth.uid() = user_id);

-- How many people pre-ordered (run in the SQL editor, which bypasses RLS):
-- select count(*) from public.preorders;

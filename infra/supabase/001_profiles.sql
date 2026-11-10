create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text not null check (sex in ('male', 'female')),
  age int not null check (age between 10 and 100),
  height_cm int not null check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 300),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active')),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  meals_per_day int not null default 3 check (meals_per_day between 1 and 8),
  target_calories int check (target_calories between 800 and 6000),
  preferences text not null default '',
  allergies text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile: select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "own profile: insert" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "own profile: update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

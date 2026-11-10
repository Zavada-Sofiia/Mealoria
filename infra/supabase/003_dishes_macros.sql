alter table public.dishes
  add column if not exists protein_g numeric(6, 1) check (protein_g between 0 and 1000),
  add column if not exists fat_g numeric(6, 1) check (fat_g between 0 and 1000),
  add column if not exists carbs_g numeric(6, 1) check (carbs_g between 0 and 1000);

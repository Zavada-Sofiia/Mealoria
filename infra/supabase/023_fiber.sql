-- Dietary fibre (grams) next to protein, fat and carbs. Optional: empty means "unknown".
alter table public.dishes add column if not exists fiber_g numeric(7, 1)
  check (fiber_g is null or fiber_g >= 0);
alter table public.recipes add column if not exists fiber_g numeric(7, 1)
  check (fiber_g is null or fiber_g >= 0);

-- How many servings a dish (recipe) makes. Ingredient amounts are for the whole dish,
-- calories and macros are per serving, and every calendar entry counts as one serving.
alter table public.dishes add column if not exists servings int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dishes_servings_range') then
    alter table public.dishes add constraint dishes_servings_range check (servings between 1 and 100);
  end if;
end $$;

-- Which meals a dish suits: any of breakfast, lunch, dinner, snack (same words as in the recipe catalog).
alter table public.dishes add column if not exists categories text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dishes_categories_allowed') then
    alter table public.dishes add constraint dishes_categories_allowed
      check (categories <@ array['сніданок', 'обід', 'вечеря', 'перекус']::text[]);
  end if;
end $$;

-- Dishes that were saved from the recipe catalog keep the category of their recipe.
update public.dishes d
set categories = array[r.category]
from public.recipes r
where d.name = r.name and d.categories = '{}' and r.category in ('сніданок', 'обід', 'вечеря', 'перекус');

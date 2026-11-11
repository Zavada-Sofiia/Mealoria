-- More allergens: sesame, mustard, celery, honey, citrus, berries, cocoa, mushrooms,
-- corn, legumes, tomatoes (on top of gluten, lactose, nuts, peanuts, eggs, fish, seafood, soy).

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.profiles'::regclass, 'public.recipes'::regclass)
      and pg_get_constraintdef(oid) like '%allergens%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_allergens_check check (
  allergens <@ array['gluten', 'lactose', 'nuts', 'peanuts', 'eggs', 'fish', 'seafood', 'soy',
    'sesame', 'mustard', 'celery', 'honey', 'citrus', 'berries', 'cocoa', 'mushrooms',
    'corn', 'legumes', 'tomatoes']::text[]
);
alter table public.recipes add constraint recipes_allergens_check check (
  allergens <@ array['gluten', 'lactose', 'nuts', 'peanuts', 'eggs', 'fish', 'seafood', 'soy',
    'sesame', 'mustard', 'celery', 'honey', 'citrus', 'berries', 'cocoa', 'mushrooms',
    'corn', 'legumes', 'tomatoes']::text[]
);

-- Tag the catalog (conservative: if a typical version of the dish contains it, it is tagged).
create or replace function pg_temp.add_allergens(recipe_name text, extra text[]) returns void
language sql as $$
  update public.recipes
  set allergens = (select array_agg(distinct a order by a) from unnest(allergens || extra) a)
  where name = recipe_name;
$$;

select pg_temp.add_allergens('Вівсянка з бананом', array['honey']);
select pg_temp.add_allergens('Омлет з овочами', array['tomatoes']);
select pg_temp.add_allergens('Тост з авокадо та яйцем', array['citrus']);
select pg_temp.add_allergens('Грецький йогурт з ягодами', array['berries', 'honey']);
select pg_temp.add_allergens('Борщ', array['tomatoes']);
select pg_temp.add_allergens('Макарони з томатним соусом', array['tomatoes']);
select pg_temp.add_allergens('Салат Цезар з куркою', array['mustard']);
select pg_temp.add_allergens('Тушкована капуста зі свининою', array['tomatoes']);
select pg_temp.add_allergens('Запечена риба з овочами', array['citrus', 'tomatoes']);
select pg_temp.add_allergens('Овочеве рагу', array['tomatoes']);
select pg_temp.add_allergens('Фаршировані перці', array['tomatoes']);
select pg_temp.add_allergens('Лобіо з червоної квасолі', array['legumes']);
select pg_temp.add_allergens('Сир кисломолочний з медом', array['honey']);
select pg_temp.add_allergens('Хумус з морквою', array['legumes', 'sesame']);
select pg_temp.add_allergens('Запечені яблука з корицею', array['honey']);

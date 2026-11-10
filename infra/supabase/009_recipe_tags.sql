-- Tags used to filter recipes by the profile preferences.
-- diet: the strictest diet that can eat the recipe ('any' = contains meat).
-- Allergens are tagged conservatively; always check the ingredients yourself.
alter table public.recipes
  add column if not exists diet text not null default 'any'
    check (diet in ('any', 'pescatarian', 'vegetarian', 'vegan')),
  add column if not exists allergens text[] not null default '{}'
    check (allergens <@ array['gluten', 'lactose', 'nuts', 'peanuts', 'eggs', 'fish', 'seafood', 'soy']),
  add column if not exists cuisine text
    check (cuisine in ('ukrainian', 'italian', 'asian', 'georgian', 'mediterranean')),
  add column if not exists cook_minutes int not null default 30 check (cook_minutes > 0),
  add column if not exists budget text not null default 'medium'
    check (budget in ('low', 'medium'));

update public.recipes set diet = 'vegetarian', allergens = array['gluten', 'lactose']::text[], cuisine = null, cook_minutes = 10, budget = 'low' where name = 'Вівсянка з бананом';
update public.recipes set diet = 'vegetarian', allergens = array['eggs']::text[], cuisine = null, cook_minutes = 15, budget = 'low' where name = 'Омлет з овочами';
update public.recipes set diet = 'vegetarian', allergens = array['gluten', 'lactose', 'eggs']::text[], cuisine = 'ukrainian', cook_minutes = 25, budget = 'low' where name = 'Сирники';
update public.recipes set diet = 'vegetarian', allergens = array['lactose']::text[], cuisine = 'ukrainian', cook_minutes = 20, budget = 'low' where name = 'Гречана каша з молоком';
update public.recipes set diet = 'vegetarian', allergens = array['gluten', 'eggs']::text[], cuisine = 'mediterranean', cook_minutes = 15, budget = 'medium' where name = 'Тост з авокадо та яйцем';
update public.recipes set diet = 'vegetarian', allergens = array['lactose', 'gluten']::text[], cuisine = 'mediterranean', cook_minutes = 5, budget = 'medium' where name = 'Грецький йогурт з ягодами';
update public.recipes set diet = 'vegetarian', allergens = array['lactose']::text[], cuisine = null, cook_minutes = 25, budget = 'low' where name = 'Рисова каша з яблуком';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = 'ukrainian', cook_minutes = 90, budget = 'medium' where name = 'Борщ';
update public.recipes set diet = 'any', allergens = array['gluten', 'eggs']::text[], cuisine = 'ukrainian', cook_minutes = 45, budget = 'low' where name = 'Курячий суп з локшиною';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = 'ukrainian', cook_minutes = 30, budget = 'low' where name = 'Гречка з курячим філе';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = 'asian', cook_minutes = 50, budget = 'medium' where name = 'Плов з куркою';
update public.recipes set diet = 'vegetarian', allergens = array['lactose']::text[], cuisine = null, cook_minutes = 30, budget = 'low' where name = 'Крем-суп з гарбуза';
update public.recipes set diet = 'vegetarian', allergens = array['gluten', 'lactose']::text[], cuisine = 'italian', cook_minutes = 20, budget = 'low' where name = 'Макарони з томатним соусом';
update public.recipes set diet = 'any', allergens = array['gluten', 'eggs', 'fish', 'lactose']::text[], cuisine = 'italian', cook_minutes = 25, budget = 'medium' where name = 'Салат Цезар з куркою';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = 'ukrainian', cook_minutes = 50, budget = 'low' where name = 'Тушкована капуста зі свининою';
update public.recipes set diet = 'pescatarian', allergens = array['fish']::text[], cuisine = 'mediterranean', cook_minutes = 30, budget = 'medium' where name = 'Запечена риба з овочами';
update public.recipes set diet = 'any', allergens = array['eggs']::text[], cuisine = null, cook_minutes = 35, budget = 'low' where name = 'Парові курячі котлети з броколі';
update public.recipes set diet = 'vegan', allergens = '{}'::text[], cuisine = 'mediterranean', cook_minutes = 35, budget = 'low' where name = 'Овочеве рагу';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = null, cook_minutes = 45, budget = 'low' where name = 'Печена картопля з індичкою';
update public.recipes set diet = 'any', allergens = '{}'::text[], cuisine = 'ukrainian', cook_minutes = 60, budget = 'medium' where name = 'Фаршировані перці';
update public.recipes set diet = 'vegan', allergens = array['nuts']::text[], cuisine = 'georgian', cook_minutes = 60, budget = 'low' where name = 'Лобіо з червоної квасолі';
update public.recipes set diet = 'pescatarian', allergens = array['fish', 'eggs']::text[], cuisine = 'mediterranean', cook_minutes = 15, budget = 'medium' where name = 'Салат з тунцем та яйцем';
update public.recipes set diet = 'vegetarian', allergens = array['eggs', 'gluten']::text[], cuisine = 'ukrainian', cook_minutes = 30, budget = 'low' where name = 'Деруни';
update public.recipes set diet = 'vegan', allergens = array['peanuts']::text[], cuisine = null, cook_minutes = 2, budget = 'low' where name = 'Яблуко з арахісовою пастою';
update public.recipes set diet = 'vegetarian', allergens = array['lactose']::text[], cuisine = 'ukrainian', cook_minutes = 2, budget = 'low' where name = 'Сир кисломолочний з медом';
update public.recipes set diet = 'vegan', allergens = '{}'::text[], cuisine = 'mediterranean', cook_minutes = 5, budget = 'low' where name = 'Хумус з морквою';
update public.recipes set diet = 'vegetarian', allergens = array['lactose']::text[], cuisine = null, cook_minutes = 5, budget = 'low' where name = 'Смузі з бананом і шпинатом';
update public.recipes set diet = 'vegan', allergens = array['nuts']::text[], cuisine = null, cook_minutes = 2, budget = 'medium' where name = 'Горіхи з сухофруктами';
update public.recipes set diet = 'vegetarian', allergens = '{}'::text[], cuisine = 'ukrainian', cook_minutes = 25, budget = 'low' where name = 'Запечені яблука з корицею';

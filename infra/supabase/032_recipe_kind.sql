-- The kind of a recipe next to its meal: main course, soup, salad, side dish, appetizer, dessert, baking, drink
-- (the same words as the kinds of dishes). It is used by the "Тип страви" filter and is copied into
-- a dish when the recipe is saved.
alter table public.recipes add column if not exists kind text
  check (kind is null or kind in ('основна страва', 'суп', 'салат', 'гарнір', 'закуска', 'десерт', 'випічка', 'напій'));

update public.recipes set kind = 'основна страва' where name = 'Вівсянка з бананом' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Омлет з овочами' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Сирники' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Гречана каша з молоком' and kind is null;
update public.recipes set kind = 'закуска' where name = 'Тост з авокадо та яйцем' and kind is null;
update public.recipes set kind = 'десерт' where name = 'Грецький йогурт з ягодами' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Рисова каша з яблуком' and kind is null;
update public.recipes set kind = 'суп' where name = 'Борщ' and kind is null;
update public.recipes set kind = 'суп' where name = 'Курячий суп з локшиною' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Гречка з курячим філе' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Плов з куркою' and kind is null;
update public.recipes set kind = 'суп' where name = 'Крем-суп з гарбуза' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Макарони з томатним соусом' and kind is null;
update public.recipes set kind = 'салат' where name = 'Салат Цезар з куркою' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Тушкована капуста зі свининою' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Запечена риба з овочами' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Парові курячі котлети з броколі' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Овочеве рагу' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Печена картопля з індичкою' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Фаршировані перці' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Лобіо з червоної квасолі' and kind is null;
update public.recipes set kind = 'салат' where name = 'Салат з тунцем та яйцем' and kind is null;
update public.recipes set kind = 'основна страва' where name = 'Деруни' and kind is null;
update public.recipes set kind = 'закуска' where name = 'Яблуко з арахісовою пастою' and kind is null;
update public.recipes set kind = 'десерт' where name = 'Сир кисломолочний з медом' and kind is null;
update public.recipes set kind = 'закуска' where name = 'Хумус з морквою' and kind is null;
update public.recipes set kind = 'напій' where name = 'Смузі з бананом і шпинатом' and kind is null;
update public.recipes set kind = 'закуска' where name = 'Горіхи з сухофруктами' and kind is null;
update public.recipes set kind = 'десерт' where name = 'Запечені яблука з корицею' and kind is null;

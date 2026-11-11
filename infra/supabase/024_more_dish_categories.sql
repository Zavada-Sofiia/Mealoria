-- More dish categories next to the four meals: main course, soup, salad, side dish, appetizer,
-- dessert, baking and drink.
alter table public.dishes drop constraint if exists dishes_categories_allowed;
alter table public.dishes add constraint dishes_categories_allowed
  check (categories <@ array[
    'сніданок', 'обід', 'вечеря', 'перекус',
    'основна страва', 'суп', 'салат', 'гарнір', 'закуска', 'десерт', 'випічка', 'напій'
  ]::text[]);

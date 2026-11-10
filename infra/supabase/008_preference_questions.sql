alter table public.profiles
  add column if not exists diet text not null default 'any'
    check (diet in ('any', 'vegetarian', 'vegan', 'pescatarian')),
  add column if not exists allergens text[] not null default '{}'
    check (allergens <@ array['gluten', 'lactose', 'nuts', 'peanuts', 'eggs', 'fish', 'seafood', 'soy']),
  add column if not exists cuisines text[] not null default '{}'
    check (cuisines <@ array['ukrainian', 'italian', 'asian', 'georgian', 'mediterranean']),
  add column if not exists cook_time text not null default 'any'
    check (cook_time in ('15', '30', '60', 'any')),
  add column if not exists budget text not null default 'any'
    check (budget in ('low', 'medium', 'any'));

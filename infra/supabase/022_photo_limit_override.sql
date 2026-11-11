-- A personal daily limit of AI dish photos for one user, instead of the plan's number.
-- Set it by hand in the SQL editor (users cannot write to subscriptions):
--   update public.subscriptions set photos_per_day_override = 100
--   where user_id = (select id from auth.users where email = 'someone@example.com');
-- Set it back to null to use the plan's limit again. It only applies while the user is premium.
alter table public.subscriptions add column if not exists photos_per_day_override int
  check (photos_per_day_override is null or photos_per_day_override between 0 and 1000);

create or replace function public.my_limits()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p text := public.internal_plan(auth.uid());
  until timestamptz;
  photo_override int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select premium_until, photos_per_day_override into until, photo_override
  from public.subscriptions where user_id = auth.uid();
  return (
    jsonb_build_object('plan', p, 'premium_until', case when p = 'premium' then until end)
    || (public.plan_table()::jsonb -> p)
    || case when p = 'premium' and photo_override is not null
         then jsonb_build_object('photos_per_day', photo_override)
         else '{}'::jsonb end
  )::json;
end;
$$;
revoke all on function public.my_limits() from public, anon;
grant execute on function public.my_limits() to authenticated;

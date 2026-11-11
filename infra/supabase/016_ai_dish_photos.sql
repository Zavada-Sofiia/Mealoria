-- AI-generated dish photos (premium only): a separate daily counter and a new plan limit.

-- Same plan table as before, with photos_per_day added (0 = not available).
create or replace function public.plan_table()
returns json
language sql
immutable
as $$
  select json_build_object(
    'free',    json_build_object('dishes', 15,  'ai_per_day', 3,  'plan_days_ahead', 14,  'photos_per_day', 0),
    'premium', json_build_object('dishes', 500, 'ai_per_day', 50, 'plan_days_ahead', 365, 'photos_per_day', 10)
  );
$$;
grant execute on function public.plan_table() to anon, authenticated;

create table if not exists public.image_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0 check (used >= 0),
  primary key (user_id, day)
);
alter table public.image_usage enable row level security;
drop policy if exists "own image usage: select" on public.image_usage;
create policy "own image usage: select" on public.image_usage
  for select using (auth.uid() = user_id);

create or replace function public.image_quota(daily_limit int, consume boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  current_used int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if consume then
    insert into public.image_usage (user_id, day, used)
    values (uid, today, 1)
    on conflict (user_id, day)
      do update set used = public.image_usage.used + 1
      where public.image_usage.used < daily_limit
    returning used into current_used;

    if current_used is not null then
      return json_build_object('allowed', true, 'used', current_used, 'limit', daily_limit);
    end if;
  end if;

  select used into current_used from public.image_usage where user_id = uid and day = today;
  current_used := coalesce(current_used, 0);
  return json_build_object('allowed', current_used < daily_limit, 'used', current_used, 'limit', daily_limit);
end;
$$;

revoke all on function public.image_quota(int, boolean) from public, anon;
grant execute on function public.image_quota(int, boolean) to authenticated;

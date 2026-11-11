-- Daily AI usage per user. Users can read their own counter but cannot write it directly:
-- the only way to change it is the function below, which can only increase it.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0 check (used >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

drop policy if exists "own ai usage: select" on public.ai_usage;
create policy "own ai usage: select" on public.ai_usage
  for select using (auth.uid() = user_id);

create or replace function public.ai_quota(daily_limit int, consume boolean)
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
    insert into public.ai_usage (user_id, day, used)
    values (uid, today, 1)
    on conflict (user_id, day)
      do update set used = public.ai_usage.used + 1
      where public.ai_usage.used < daily_limit
    returning used into current_used;

    if current_used is not null then
      return json_build_object('allowed', true, 'used', current_used, 'limit', daily_limit);
    end if;
  end if;

  select used into current_used from public.ai_usage where user_id = uid and day = today;
  current_used := coalesce(current_used, 0);
  return json_build_object('allowed', current_used < daily_limit, 'used', current_used, 'limit', daily_limit);
end;
$$;

revoke all on function public.ai_quota(int, boolean) from public, anon;
grant execute on function public.ai_quota(int, boolean) to authenticated;

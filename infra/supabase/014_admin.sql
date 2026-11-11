-- Developer-only statistics.
-- public.admins lists who may open the hidden stats page. RLS is on and there are no policies,
-- so regular users cannot read or change it through the API; only the SQL editor can.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.admin_stats()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return json_build_object(
    'users_total', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'preorders_total', (select count(*) from public.preorders),
    'profiles_total', (select count(*) from public.profiles),
    'dishes_total', (select count(*) from public.dishes),
    'plan_entries_total', (select count(*) from public.meal_plan),
    'ai_requests_today', (select coalesce(sum(used), 0) from public.ai_usage where day = today),
    'ai_users_today', (select count(*) from public.ai_usage where day = today),
    'ai_requests_7d', (select coalesce(sum(used), 0) from public.ai_usage where day > today - 7),
    'daily', (
      select json_agg(json_build_object(
        'day', d::date,
        'signups', (select count(*) from auth.users where created_at::date = d::date),
        'preorders', (select count(*) from public.preorders where created_at::date = d::date)
      ) order by d)
      from generate_series(today - 13, today, interval '1 day') d
    ),
    'users', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select
          u.email,
          u.created_at,
          u.last_sign_in_at,
          u.raw_app_meta_data ->> 'provider' as provider,
          exists (select 1 from public.profiles p where p.user_id = u.id) as has_profile,
          (select count(*) from public.dishes d where d.user_id = u.id) as dishes,
          (select count(*) from public.meal_plan m where m.user_id = u.id) as planned,
          exists (select 1 from public.preorders o where o.user_id = u.id) as preordered
        from auth.users u
        order by u.created_at desc
        limit 200
      ) t
    )
  );
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_stats() to authenticated;

-- Make yourself an admin (replace the email; do this in the SQL editor, never commit it):
-- insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';

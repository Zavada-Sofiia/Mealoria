-- Feedback from signed-in users (a problem, an idea, a question), read by an admin on the developer page.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  category text not null check (category in ('bug', 'idea', 'question', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  page text not null default '' check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;  -- no policies: only the functions below

-- At most 5 messages per user in 24 hours.
create or replace function public.submit_feedback(fb_category text, fb_message text, fb_page text default '')
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  text_clean text := btrim(coalesce(fb_message, ''));
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if fb_category not in ('bug', 'idea', 'question', 'other') then
    return json_build_object('ok', false, 'error', 'bad_category');
  end if;
  if char_length(text_clean) < 10 then
    return json_build_object('ok', false, 'error', 'too_short');
  end if;
  if char_length(text_clean) > 2000 then
    return json_build_object('ok', false, 'error', 'too_long');
  end if;
  if (select count(*) from public.feedback where user_id = uid and created_at > now() - interval '24 hours') >= 5 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;
  insert into public.feedback (user_id, email, category, message, page)
  values (uid, (select email from auth.users where id = uid), fb_category, text_clean, left(coalesce(fb_page, ''), 200));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.admin_feedback_list(max_rows int default 100)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return json_build_object(
    'new_count', (select count(*) from public.feedback where status = 'new'),
    'items', coalesce((
      select json_agg(row_to_json(f) order by f.status = 'done', f.created_at desc)
      from (
        select id, email, category, message, page, status, created_at
        from public.feedback
        order by status = 'done', created_at desc
        limit least(greatest(max_rows, 1), 500)
      ) f
    ), '[]'::json)
  );
end;
$$;

create or replace function public.admin_set_feedback_status(fb_id uuid, new_status text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_status not in ('new', 'done') then
    return json_build_object('ok', false, 'error', 'bad_status');
  end if;
  update public.feedback set status = new_status where id = fb_id;
  return json_build_object('ok', found);
end;
$$;

revoke all on function public.submit_feedback(text, text, text) from public, anon;
revoke all on function public.admin_feedback_list(int) from public, anon;
revoke all on function public.admin_set_feedback_status(uuid, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text) to authenticated;
grant execute on function public.admin_feedback_list(int) to authenticated;
grant execute on function public.admin_set_feedback_status(uuid, text) to authenticated;

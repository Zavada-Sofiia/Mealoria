-- The developer page can delete an account (for example our own test accounts).
-- Everything the person had goes with it, the same way as when they delete the account themselves:
-- their rows are removed by "on delete cascade", their feedback stays without the email.
-- An admin cannot delete themselves or another admin here. Safe to run again.
create or replace function public.admin_delete_user(target_email text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(target_email));
  if uid is null then
    return json_build_object('ok', false, 'error', 'user_not_found');
  end if;
  if exists (select 1 from public.admins where user_id = uid) then
    return json_build_object('ok', false, 'error', 'is_admin');
  end if;
  update public.feedback set email = null where user_id = uid;
  delete from auth.users where id = uid;
  return json_build_object('ok', true, 'email', target_email);
end;
$$;
revoke all on function public.admin_delete_user(text) from public, anon;
grant execute on function public.admin_delete_user(text) to authenticated;

-- Deleting an account also removes the email from the messages the person sent through «Допомога»:
-- the text stays for us (without any link to a person), the address does not.
-- Safe to run again.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.feedback set email = null where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- A message of the admin's own for each promo code (in Ukrainian and English). The person who redeems that
-- code sees it instead of the standard "Premium activated" text, e.g. a thank-you for answering a survey.
alter table public.promo_codes add column if not exists message_uk text check (char_length(message_uk) <= 1000);
alter table public.promo_codes add column if not exists message_en text check (char_length(message_en) <= 1000);

create or replace function public.admin_set_promo_message(target_code text, new_uk text, new_en text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text := upper(trim(target_code));
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(coalesce(new_uk, '')) > 1000 or char_length(coalesce(new_en, '')) > 1000 then
    return json_build_object('ok', false, 'error', 'too_long');
  end if;
  update public.promo_codes
     set message_uk = nullif(trim(new_uk), ''), message_en = nullif(trim(new_en), '')
   where code = c;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true, 'code', c);
end;
$$;

create or replace function public.admin_list_promos()
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'code', code, 'days', days, 'max_uses', max_uses, 'used_count', used_count, 'created_at', created_at,
      'message_uk', message_uk, 'message_en', message_en
    ) order by created_at desc)
    from public.promo_codes
  ), '[]'::json);
end;
$$;

-- the same as in 027, plus the code's own message in the answer
create or replace function public.redeem_promo(input_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c text := upper(trim(input_code));
  promo public.promo_codes%rowtype;
  result json;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if (select count(*) from public.promo_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  select * into promo from public.promo_codes where code = c for update;
  if not found then
    insert into public.promo_attempts (user_id) values (uid);
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if exists (select 1 from public.promo_redemptions where code = c and user_id = uid) then
    return json_build_object('ok', false, 'error', 'already_used');
  end if;
  if promo.max_uses is not null and promo.used_count >= promo.max_uses then
    return json_build_object('ok', false, 'error', 'used_up');
  end if;

  result := public.internal_extend_premium(uid, 0, promo.days, false, 'promo', c);
  insert into public.promo_redemptions (code, user_id) values (c, uid);
  update public.promo_codes set used_count = used_count + 1 where code = c;
  return json_build_object(
    'ok', true, 'days', promo.days,
    'premium_until', result -> 'new_until', 'unlimited', (result ->> 'unlimited')::boolean,
    'message_uk', promo.message_uk, 'message_en', promo.message_en
  );
end;
$$;

revoke all on function public.admin_set_promo_message(text, text, text) from public, anon;
revoke all on function public.admin_list_promos() from public, anon;
revoke all on function public.redeem_promo(text) from public, anon;
grant execute on function public.admin_set_promo_message(text, text, text) to authenticated;
grant execute on function public.admin_list_promos() to authenticated;
grant execute on function public.redeem_promo(text) to authenticated;

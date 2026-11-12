-- A message for the whole site ("technical problems", "maintenance"), switched on by an admin.
-- Everybody can read it (the site shows it to visitors too); only admins can change it.
create table if not exists public.site_notice (
  id int primary key default 1 check (id = 1),  -- a single row
  active boolean not null default false,
  level text not null default 'info' check (level in ('info', 'warning')),
  message_uk text not null default '' check (char_length(message_uk) <= 500),
  message_en text not null default '' check (char_length(message_en) <= 500),
  updated_at timestamptz not null default now()
);
insert into public.site_notice (id) values (1) on conflict (id) do nothing;

alter table public.site_notice enable row level security;
drop policy if exists "site notice: everyone can read" on public.site_notice;
create policy "site notice: everyone can read" on public.site_notice for select using (true);
grant select on public.site_notice to anon, authenticated;

create or replace function public.admin_set_notice(new_active boolean, new_level text, new_uk text, new_en text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new_level not in ('info', 'warning') then
    return json_build_object('ok', false, 'error', 'bad_level');
  end if;
  if char_length(coalesce(new_uk, '')) > 500 or char_length(coalesce(new_en, '')) > 500 then
    return json_build_object('ok', false, 'error', 'too_long');
  end if;
  update public.site_notice
  set active = new_active, level = new_level,
      message_uk = coalesce(trim(new_uk), ''), message_en = coalesce(trim(new_en), ''),
      updated_at = now()
  where id = 1;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.admin_set_notice(boolean, text, text, text) from public, anon;
grant execute on function public.admin_set_notice(boolean, text, text, text) to authenticated;

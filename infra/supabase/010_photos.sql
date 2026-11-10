alter table public.dishes add column if not exists photo_url text;
alter table public.recipes add column if not exists photo_url text;

-- Public bucket: anyone with a photo link can view it. Links contain random ids.
-- Users may write only inside their own folder (<user id>/...). Catalog photos live
-- in the "recipes/" folder and are uploaded from the Supabase dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dish photos: select own" on storage.objects;
create policy "dish photos: select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "dish photos: insert own" on storage.objects;
create policy "dish photos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "dish photos: update own" on storage.objects;
create policy "dish photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "dish photos: delete own" on storage.objects;
create policy "dish photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

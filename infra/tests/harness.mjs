// Runs the real migrations (infra/supabase/*.sql) in an in-memory Postgres (PGlite) with
// stand-ins for the parts of Supabase that they use (auth, storage, roles).
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('../supabase/', import.meta.url))

export async function freshDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text, created_at timestamptz default now(), last_sign_in_at timestamptz,
      raw_app_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
    alter table storage.objects enable row level security;
  `)
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(DIR + file, 'utf8'))
    } catch (e) {
      throw new Error(`${file}: ${e.message}`)
    }
  }
  return db
}

export const signInAs = (db, uid) => db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false)`)

export const ADMIN = '11111111-1111-1111-1111-111111111111'
export const USER = '22222222-2222-2222-2222-222222222222'

export async function withUsers(db) {
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.ua'), ('${USER}', 'user@x.ua');
    insert into public.admins (user_id) values ('${ADMIN}');
  `)
  await signInAs(db, ADMIN)
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshDatabase } from './harness.mjs'

const rows = async (db, sql) => (await db.query(sql)).rows

test('the catalogue has 150+ recipes in every category and kind, and every row is complete', async () => {
  const db = await freshDatabase()
  const total = (await rows(db, 'select count(*)::int as n from public.recipes'))[0].n
  assert.ok(total >= 150, `only ${total} recipes`)
  for (const c of ['сніданок', 'обід', 'вечеря', 'перекус']) {
    assert.ok((await rows(db, `select count(*)::int as n from public.recipes where category = '${c}'`))[0].n >= 25, c)
  }
  for (const k of ['основна страва', 'суп', 'салат', 'гарнір', 'закуска', 'десерт', 'випічка', 'напій']) {
    assert.ok((await rows(db, `select count(*)::int as n from public.recipes where kind = '${k}'`))[0].n >= 3, k)
  }
  assert.deepEqual(await rows(db, `select name from public.recipes where kind is null or fiber_g is null or recipe = '' or jsonb_array_length(ingredients) < 2`), [])
  assert.deepEqual(await rows(db, `select name from public.recipes where calories < 30 or calories > 900 or protein_g < 0 or fat_g < 0 or carbs_g < 0`), [])
})

test('every recipe has a photo link of its own', async () => {
  const db = await freshDatabase()
  assert.deepEqual(await rows(db, 'select name from public.recipes where photo_url is null'), [])
  assert.deepEqual(await rows(db, 'select photo_url from public.recipes group by photo_url having count(*) > 1'), [])
})

test('the diet agrees with the allergens that come from animal products', async () => {
  const db = await freshDatabase()
  const bad = await rows(db, `select name, diet, allergens from public.recipes where
    (diet = 'vegan' and allergens && array['eggs','lactose','honey','fish','seafood']::text[])
    or (diet in ('vegan','vegetarian') and allergens && array['fish','seafood']::text[])
    or (diet = 'pescatarian' and not allergens && array['fish','seafood']::text[])`)
  assert.deepEqual(bad, [])
})

test('the file can be run again without duplicates', async () => {
  const db = await freshDatabase()
  const before = (await rows(db, 'select count(*)::int as n from public.recipes'))[0].n
  await db.exec(readFileSync(new URL('../supabase/033_more_recipes.sql', import.meta.url), 'utf8'))
  assert.equal((await rows(db, 'select count(*)::int as n from public.recipes'))[0].n, before)
})

test('every quick "already at home" button matches an ingredient of the catalogue', async () => {
  // the shopping list matches the names exactly, so a button with a name no recipe uses would do nothing
  const src = readFileSync(new URL('../../frontend/src/pages/Shopping.tsx', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('const QUICK_GROUPS'), src.indexOf('export default function Shopping'))
  const names = [...block.matchAll(/\['([^\]]+)'\]/g)].flatMap((m) => m[1].split(/',\s*'/))
  assert.ok(names.length > 60, `found only ${names.length} names`)
  const db = await freshDatabase()
  const used = new Set(
    (await rows(db, `select lower(i->>'name') as n from public.recipes, jsonb_array_elements(ingredients) i`)).map((r) => r.n),
  )
  const unused = names.filter((n) => !used.has(n) && n !== 'сіль')
  assert.deepEqual(unused, [], 'these buttons match no ingredient')
})

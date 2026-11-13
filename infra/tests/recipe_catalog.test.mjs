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

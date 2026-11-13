import test from 'node:test'
import assert from 'node:assert/strict'
import { freshDatabase } from './harness.mjs'

test('every catalogue recipe has fibre, and a hand-set value is not overwritten', async () => {
  const db = await freshDatabase()
  const empty = await db.query('select name from public.recipes where fiber_g is null')
  assert.deepEqual(empty.rows, [], 'a recipe without fibre would show no "Кл" in the catalogue')
  const odd = await db.query('select name from public.recipes where fiber_g < 0 or fiber_g > 20')
  assert.deepEqual(odd.rows, [])

  await db.query(`update public.recipes set fiber_g = 9.9 where name = 'Борщ'`)
  const sql = (await import('node:fs')).readFileSync(new URL('../supabase/031_recipe_fiber.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  assert.equal(Number((await db.query(`select fiber_g from public.recipes where name = 'Борщ'`)).rows[0].fiber_g), 9.9)
})

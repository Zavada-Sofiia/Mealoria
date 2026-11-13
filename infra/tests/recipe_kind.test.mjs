import test from 'node:test'
import assert from 'node:assert/strict'
import { freshDatabase } from './harness.mjs'

test('every catalogue recipe has a kind, and a kind outside the list is refused', async () => {
  const db = await freshDatabase()
  assert.deepEqual((await db.query('select name from public.recipes where kind is null')).rows, [])
  assert.equal((await db.query(`select kind from public.recipes where name = 'Борщ'`)).rows[0].kind, 'суп')
  await assert.rejects(() => db.query(`update public.recipes set kind = 'щось' where name = 'Борщ'`), /check/i)
})

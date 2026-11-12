import test from 'node:test'
import assert from 'node:assert/strict'
import { USER, freshDatabase, withUsers } from './harness.mjs'

test('water entries accept a sensible amount and nothing else', async () => {
  const db = await freshDatabase()
  await withUsers(db)
  await db.exec(`insert into public.water_log (user_id, day, amount_ml) values ('${USER}', current_date, 250)`)
  for (const bad of [0, 5, 3001, -100]) {
    await assert.rejects(() => db.exec(`insert into public.water_log (user_id, day, amount_ml) values ('${USER}', current_date, ${bad})`), /check/)
  }
  assert.equal((await db.query('select count(*)::int as n from public.water_log')).rows[0].n, 1)
})

test('deleting the account removes its water entries', async () => {
  const db = await freshDatabase()
  await withUsers(db)
  await db.exec(`insert into public.water_log (user_id, day, amount_ml) values ('${USER}', current_date, 250), ('${USER}', current_date, 500)`)
  await db.exec(`delete from auth.users where id = '${USER}'`)
  assert.equal((await db.query('select count(*)::int as n from public.water_log')).rows[0].n, 0)
})

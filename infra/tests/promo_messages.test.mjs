import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, USER, freshDatabase, signInAs, withUsers } from './harness.mjs'

async function setup() {
  const db = await freshDatabase()
  await withUsers(db)
  await db.query(`select public.admin_create_promo('FEEDBACK7', 7, 50)`)
  return db
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0].r

test('the code’s own message comes back to the person who redeems it', async () => {
  const db = await setup()
  const set = await one(db, `select public.admin_set_promo_message('feedback7', $1, $2) as r`, [
    '  Дякуємо, що відповіли на опитування!  ',
    'Thank you for answering the survey!',
  ])
  assert.equal(set.ok, true)
  const listed = (await one(db, `select public.admin_list_promos() as r`))[0]
  assert.equal(listed.message_uk, 'Дякуємо, що відповіли на опитування!', 'spaces around are trimmed')
  assert.equal(listed.message_en, 'Thank you for answering the survey!')

  await signInAs(db, USER)
  const r = await one(db, `select public.redeem_promo('feedback7') as r`)
  assert.equal(r.ok, true)
  assert.equal(r.days, 7)
  assert.equal(r.message_uk, 'Дякуємо, що відповіли на опитування!')
  assert.equal(r.message_en, 'Thank you for answering the survey!')
})

test('a code without a message redeems as before, and an empty text clears the message', async () => {
  const db = await setup()
  await one(db, `select public.admin_set_promo_message('FEEDBACK7', 'Привіт', '') as r`)
  let listed = (await one(db, `select public.admin_list_promos() as r`))[0]
  assert.equal(listed.message_en, null, 'an empty English text is stored as no message')
  await one(db, `select public.admin_set_promo_message('FEEDBACK7', '', '') as r`)
  listed = (await one(db, `select public.admin_list_promos() as r`))[0]
  assert.equal(listed.message_uk, null)

  await signInAs(db, USER)
  const r = await one(db, `select public.redeem_promo('FEEDBACK7') as r`)
  assert.equal(r.ok, true)
  assert.equal(r.message_uk, null)
})

test('only an admin may set a message; unknown codes and very long texts are refused', async () => {
  const db = await setup()
  const missing = await one(db, `select public.admin_set_promo_message('NOPE', 'x', 'x') as r`)
  assert.deepEqual(missing, { ok: false, error: 'not_found' })
  const long = await one(db, `select public.admin_set_promo_message('FEEDBACK7', repeat('a', 1001), '') as r`)
  assert.deepEqual(long, { ok: false, error: 'too_long' })

  await signInAs(db, USER)
  await assert.rejects(db.query(`select public.admin_set_promo_message('FEEDBACK7', 'hack', '')`), /forbidden/)
  await signInAs(db, ADMIN)
})

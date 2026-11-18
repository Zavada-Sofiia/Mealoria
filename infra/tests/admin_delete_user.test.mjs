import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, USER, freshDatabase, signInAs, withUsers } from './harness.mjs'

async function setup() {
  const db = await freshDatabase()
  await withUsers(db)
  // the user has a dish, a pre-order and a message on the help page
  await db.exec(`
    insert into public.dishes (user_id, name) values ('${USER}', 'Test soup');
    insert into public.preorders (user_id) values ('${USER}');
  `)
  await signInAs(db, USER)
  await db.query(`select public.submit_feedback('idea', 'A message from a test account', '/help')`)
  await signInAs(db, ADMIN)
  return db
}

const json = async (db, sql, params = []) => JSON.parse(JSON.stringify((await db.query(sql, params)).rows[0].r))
const remove = (db, email) => json(db, 'select public.admin_delete_user($1) as r', [email])
const count = async (db, table) => (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n

test('an admin deletes an account with everything it had; the message stays without the email', async () => {
  const db = await setup()
  assert.equal((await remove(db, '  USER@x.ua ')).ok, true, 'the email is matched without case and spaces')
  assert.equal(await count(db, `auth.users where id = '${USER}'`), 0)
  assert.equal(await count(db, 'public.dishes'), 0)
  assert.equal(await count(db, 'public.preorders'), 0)
  const row = (await db.query('select user_id, email, message from public.feedback')).rows[0]
  assert.deepEqual({ ...row }, { user_id: null, email: null, message: 'A message from a test account' })
})

test('unknown emails and admins are refused', async () => {
  const db = await setup()
  assert.equal((await remove(db, 'nobody@x.ua')).error, 'user_not_found')
  assert.equal((await remove(db, 'admin@x.ua')).error, 'is_admin', 'an admin cannot delete themselves')
  assert.equal(await count(db, 'auth.users'), 2)
})

test('a regular user cannot delete anybody', async () => {
  const db = await setup()
  await signInAs(db, USER)
  await assert.rejects(() => remove(db, 'admin@x.ua'), /forbidden/)
  assert.equal(await count(db, 'auth.users'), 2)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, USER, freshDatabase, signInAs, withUsers } from './harness.mjs'

async function setup() {
  const db = await freshDatabase()
  await withUsers(db)
  await signInAs(db, USER)
  return db
}

const json = async (db, sql, params = []) => JSON.parse(JSON.stringify((await db.query(sql, params)).rows[0].r))
const send = (db, category, message, page = '/help') =>
  json(db, 'select public.submit_feedback($1, $2, $3) as r', [category, message, page])

test('a message is saved with the sender and the page', async () => {
  const db = await setup()
  assert.equal((await send(db, 'bug', '  The calendar does not open  ', '/calendar')).ok, true)
  const row = (await db.query('select email, category, message, page, status from public.feedback')).rows[0]
  assert.deepEqual({ ...row }, { email: 'user@x.ua', category: 'bug', message: 'The calendar does not open', page: '/calendar', status: 'new' })
})

test('too short, too long and unknown categories are refused', async () => {
  const db = await setup()
  assert.equal((await send(db, 'bug', 'short')).error, 'too_short')
  assert.equal((await send(db, 'bug', '         padded          ')).error, 'too_short', 'spaces do not count')
  assert.equal((await send(db, 'bug', 'x'.repeat(2001))).error, 'too_long')
  assert.equal((await send(db, 'spam', 'a perfectly long message')).error, 'bad_category')
  assert.equal((await db.query('select count(*)::int as n from public.feedback')).rows[0].n, 0)
})

test('five messages a day, then a pause; another user is not affected', async () => {
  const db = await setup()
  for (let i = 0; i < 5; i++) assert.equal((await send(db, 'idea', `An idea number ${i} for the site`)).ok, true)
  assert.equal((await send(db, 'idea', 'One idea too many today')).error, 'too_many')
  await signInAs(db, ADMIN)
  assert.equal((await send(db, 'idea', 'A message from somebody else')).ok, true)
  await signInAs(db, USER)
  await db.query(`update public.feedback set created_at = now() - interval '25 hours' where user_id = '${USER}'`)
  assert.equal((await send(db, 'idea', 'A day later it works again')).ok, true)
})

test('signing in is required, and the page text is cut to 200 characters', async () => {
  const db = await setup()
  await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  await assert.rejects(() => send(db, 'bug', 'Nobody is signed in here'), /not signed in/)
  await signInAs(db, USER)
  await send(db, 'bug', 'A very long page address', '/x'.repeat(300))
  assert.equal((await db.query('select char_length(page) as n from public.feedback')).rows[0].n, 200)
})

test('only an admin can read the messages and mark them done', async () => {
  const db = await setup()
  await send(db, 'question', 'How do I change my plan?')
  await assert.rejects(() => db.query('select public.admin_feedback_list()'), /forbidden/)
  await assert.rejects(() => db.query(`select public.admin_set_feedback_status(gen_random_uuid(), 'done')`), /forbidden/)

  await signInAs(db, ADMIN)
  const list = await json(db, 'select public.admin_feedback_list() as r')
  assert.equal(list.new_count, 1)
  assert.equal(list.items[0].email, 'user@x.ua')
  const id = list.items[0].id
  assert.equal((await json(db, `select public.admin_set_feedback_status('${id}', 'done') as r`)).ok, true)
  assert.equal((await json(db, `select public.admin_set_feedback_status('${id}', 'weird') as r`)).error, 'bad_status')
  assert.equal((await json(db, `select public.admin_set_feedback_status(gen_random_uuid(), 'done') as r`)).ok, false)
  assert.equal((await json(db, 'select public.admin_feedback_list() as r')).new_count, 0)
})

test('open messages come first, newest first; deleting the user keeps the message', async () => {
  const db = await setup()
  await send(db, 'bug', 'The first message about a bug')
  await send(db, 'idea', 'The second message with an idea')
  await send(db, 'other', 'The third message about other things')
  await db.query(`update public.feedback set status = 'done' where message like 'The second%'`)
  await db.query(`update public.feedback set created_at = now() - interval '2 hours' where message like 'The first%'`)
  await signInAs(db, ADMIN)
  const order = (await json(db, 'select public.admin_feedback_list() as r')).items.map((i) => i.message.split(' ')[1])
  assert.deepEqual(order, ['third', 'first', 'second'])
  await db.query(`delete from auth.users where id = '${USER}'`)
  assert.equal((await db.query('select count(*)::int as n from public.feedback')).rows[0].n, 3)
})

test('deleting the account keeps the message but not the address', async () => {
  const db = await setup()
  await send(db, 'idea', 'Please add a dark theme for the PDF')
  await db.query('select public.delete_my_account()')
  const row = (await db.query('select user_id, email, message from public.feedback')).rows[0]
  assert.deepEqual({ ...row }, { user_id: null, email: null, message: 'Please add a dark theme for the PDF' })
})

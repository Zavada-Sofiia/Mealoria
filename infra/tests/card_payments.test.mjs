import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, USER, freshDatabase, signInAs, withUsers } from './harness.mjs'

const SECRET = 's'.repeat(40)

async function setup() {
  const db = await freshDatabase()
  await withUsers(db)
  await signInAs(db, ADMIN)
  await db.query('select public.admin_set_payment_secret($1)', [SECRET])
  await signInAs(db, USER)
  return db
}

const json = async (db, sql, params = []) => JSON.parse(JSON.stringify((await db.query(sql, params)).rows[0].r))
const order = (db, months) => json(db, 'select public.create_payment_order($1) as r', [months])
const confirm = (db, code, tx, kopecks, secret = SECRET) =>
  json(db, 'select public.confirm_card_payment($1, $2, $3, $4) as r', [secret, code, tx, kopecks])
const until = async (db) =>
  (await db.query(`select premium_until as u from public.subscriptions where user_id = '${USER}'`)).rows[0]?.u ?? null

test('an order gets a code and the price from the database', async () => {
  const db = await setup()
  const o = await order(db, 3)
  assert.equal(o.ok, true)
  assert.match(o.code, /^ML-[A-HJKMNP-Z2-9]{6}$/)
  assert.equal(o.amount_uah, 129)
  assert.equal((await order(db, 7)).error, 'bad_period')
})

test('the same pending order is returned again instead of a new one', async () => {
  const db = await setup()
  const a = await order(db, 1)
  assert.equal((await order(db, 1)).code, a.code)
  assert.notEqual((await order(db, 3)).code, a.code)
  assert.equal((await db.query('select count(*)::int as n from public.payment_orders')).rows[0].n, 2)
  await db.query(`update public.payment_orders set status = 'cancelled' where code = '${a.code}'`)
  assert.notEqual((await order(db, 1)).code, a.code, 'after cancelling, a new code is issued')
})

test('a matching payment adds the months and is logged as card', async () => {
  const db = await setup()
  const o = await order(db, 3)
  await signInAs(db, '00000000-0000-0000-0000-000000000000') // the backend has no signed-in user
  const r = await confirm(db, o.code.toLowerCase(), 'tx-1', 12900)
  assert.equal(r.ok, true)
  const end = await until(db)
  const expected = (await db.query(`select now() + interval '3 months' as t`)).rows[0].t
  assert.ok(Math.abs(new Date(end) - new Date(expected)) < 60000)
  const g = (await db.query(`select source, months, note from public.premium_grants`)).rows[0]
  assert.deepEqual({ ...g }, { source: 'card', months: 3, note: o.code })
  assert.equal((await db.query(`select status, paid_by from public.payment_orders`)).rows[0].status, 'paid')
})

test('a second payment adds to the first end date', async () => {
  const db = await setup()
  const a = await order(db, 1)
  await confirm(db, a.code, 'tx-a', 4900)
  const first = await until(db)
  const b = await order(db, 6)
  await confirm(db, b.code, 'tx-b', 23900)
  const second = (await db.query(`select ($1::timestamptz + interval '6 months') as t`, [first])).rows[0].t
  assert.ok(Math.abs(new Date(await until(db)) - new Date(second)) < 1000)
})

test('the same bank payment cannot be used twice, and a paid order cannot be paid again', async () => {
  const db = await setup()
  const a = await order(db, 1)
  assert.equal((await confirm(db, a.code, 'tx-1', 4900)).ok, true)
  const before = await until(db)
  assert.equal((await confirm(db, a.code, 'tx-1', 4900)).error, 'already_used')
  assert.equal((await confirm(db, a.code, 'tx-2', 4900)).error, 'no_order')
  assert.equal(await until(db) <= before && (await until(db)) >= before, true)
})

test('a payment that is too small or has an unknown code gives nothing', async () => {
  const db = await setup()
  const a = await order(db, 12)
  const small = await confirm(db, a.code, 'tx-1', 4900)
  assert.equal(small.error, 'amount_too_low')
  assert.equal(small.expected_kopecks, 44900)
  assert.equal((await confirm(db, 'ML-ZZZZZZ', 'tx-2', 44900)).error, 'no_order')
  assert.equal(await until(db), null)
  assert.equal((await db.query(`select status from public.payment_orders`)).rows[0].status, 'pending')
  assert.equal((await confirm(db, a.code, 'tx-3', 50000)).ok, true, 'paying more than the price is accepted')
})

test('the wrong or an empty secret is refused', async () => {
  const db = await setup()
  const a = await order(db, 1)
  await assert.rejects(() => confirm(db, a.code, 'tx-1', 4900, 'x'.repeat(40)), /forbidden/)
  await assert.rejects(() => confirm(db, a.code, 'tx-1', 4900, ''), /forbidden/)
  assert.equal(await until(db), null)
})

test('nothing is accepted before an admin has set the secret', async () => {
  const db = await freshDatabase()
  await withUsers(db)
  await signInAs(db, USER)
  const a = await order(db, 1)
  await assert.rejects(() => confirm(db, a.code, 'tx-1', 4900), /forbidden/)
})

test('the secret is stored hashed and only an admin can set or check it', async () => {
  const db = await setup()
  const stored = (await db.query('select secret_hash from public.payment_secret')).rows[0].secret_hash
  assert.notEqual(stored, SECRET)
  assert.equal(stored.length, 64)
  await assert.rejects(() => db.query(`select public.admin_set_payment_secret('${'y'.repeat(40)}')`), /forbidden/)
  await assert.rejects(() => db.query(`select public.admin_check_payment_secret('${SECRET}')`), /forbidden/)
  await signInAs(db, ADMIN)
  assert.equal((await json(db, `select public.admin_set_payment_secret('short') as r`)).error, 'too_short')
  assert.equal((await db.query(`select public.admin_check_payment_secret('${SECRET}') as r`)).rows[0].r, true)
  assert.equal((await db.query(`select public.admin_check_payment_secret('nope') as r`)).rows[0].r, false)
})

test('an admin can confirm an order by hand, once', async () => {
  const db = await setup()
  const a = await order(db, 6)
  await assert.rejects(() => db.query(`select public.admin_confirm_order('${a.code}')`), /forbidden/)
  await signInAs(db, ADMIN)
  assert.equal((await json(db, `select public.admin_confirm_order('${a.code}', 'no comment') as r`)).ok, true)
  assert.equal((await json(db, `select public.admin_confirm_order('${a.code}') as r`)).error, 'no_order')
  const list = await json(db, 'select public.admin_payment_orders() as r')
  assert.equal(list[0].status, 'paid')
  assert.equal(list[0].paid_by, 'admin')
  const status = await json(db, 'select public.admin_payment_status() as r')
  assert.deepEqual(status, { secret_set: true, pending: 0, paid: 1, paid_uah: 239 })
})

test('a user sees only their own orders and can cancel a pending one', async () => {
  const db = await setup()
  const a = await order(db, 1)
  await signInAs(db, ADMIN)
  await order(db, 3)
  await signInAs(db, USER)
  const mine = await json(db, 'select public.my_payment_orders() as r')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].code, a.code)
  assert.equal((await json(db, `select public.cancel_payment_order('${a.code}') as r`)).ok, true)
  await signInAs(db, '00000000-0000-0000-0000-000000000000')
  assert.equal((await confirm(db, a.code, 'tx-1', 4900)).error, 'no_order')
})

test('an old order is no longer confirmed automatically', async () => {
  const db = await setup()
  const a = await order(db, 1)
  await db.query(`update public.payment_orders set created_at = now() - interval '31 days'`)
  assert.equal((await confirm(db, a.code, 'tx-1', 4900)).error, 'no_order')
})

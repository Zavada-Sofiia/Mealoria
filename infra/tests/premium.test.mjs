import test from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, USER, freshDatabase, signInAs, withUsers } from './harness.mjs'

async function setup() {
  const db = await freshDatabase()
  await withUsers(db)
  return db
}

const grant = (db, months, days = 0, unlimited = false) =>
  db.query('select public.admin_grant_premium($1, $2, $3, $4) as r', ['user@x.ua', months, days, unlimited]).then((r) => r.rows[0].r)

const until = async (db) =>
  (await db.query(`select premium_until as u from public.subscriptions where user_id = '${USER}'`)).rows[0]?.u ?? null

/** How many whole seconds apart two moments are */
const apart = (a, b) => Math.abs(new Date(a) - new Date(b)) / 1000

const inMonths = async (db, base, n) =>
  (await db.query(`select ($1::timestamptz + make_interval(months => $2)) as t`, [base, n])).rows[0].t

test('3, then 6, then 12 months: each period is added to the end date, not counted from today', async () => {
  const db = await setup()

  const first = await grant(db, 3)
  assert.equal(first.ok, true)
  assert.equal(first.was_active, false)
  const afterThree = await until(db)
  const threeMonths = (await db.query(`select now() + interval '3 months' as t`)).rows[0].t
  assert.ok(apart(afterThree, threeMonths) < 60, 'first grant: about 3 months from now')

  const second = await grant(db, 6)
  assert.equal(second.was_active, true)
  const afterSix = await until(db)
  assert.ok(apart(afterSix, await inMonths(db, afterThree, 6)) < 1, '6 months are added to the previous end')

  await grant(db, 12)
  const afterYear = await until(db)
  assert.ok(apart(afterYear, await inMonths(db, afterSix, 12)) < 1, '12 months are added to the previous end')

  const total = (await db.query(`select now() + interval '21 months' as t`)).rows[0].t
  assert.ok(apart(afterYear, total) < 60, '3 + 6 + 12 months give about 21 months from today')
})

test('the same grants are written to the history with the old and the new end date', async () => {
  const db = await setup()
  await grant(db, 3)
  const mid = await until(db)
  await grant(db, 6)
  const end = await until(db)

  const rows = JSON.parse(JSON.stringify((await db.query('select public.admin_premium_history() as h')).rows[0].h))
  assert.equal(rows.length, 2)
  // newest first
  assert.equal(rows[0].months, 6)
  assert.equal(rows[0].email, 'user@x.ua')
  assert.equal(rows[0].source, 'admin')
  assert.equal(rows[0].was_active, true)
  assert.ok(apart(rows[0].previous_until, mid) < 1)
  assert.ok(apart(rows[0].new_until, end) < 1)
  assert.equal(rows[1].months, 3)
  assert.equal(rows[1].was_active, false)
  assert.equal(rows[1].previous_until, null)
})

test('Premium that has already expired starts again from today', async () => {
  const db = await setup()
  await grant(db, 1)
  await db.exec(`update public.subscriptions set premium_until = now() - interval '10 days' where user_id = '${USER}'`)
  assert.equal((await db.query(`select public.internal_plan('${USER}') as p`)).rows[0].p, 'free')

  const r = await grant(db, 3)
  assert.equal(r.was_active, false)
  const expected = (await db.query(`select now() + interval '3 months' as t`)).rows[0].t
  assert.ok(apart(await until(db), expected) < 60)
  assert.equal((await db.query(`select public.internal_plan('${USER}') as p`)).rows[0].p, 'premium')
})

test('days can be added too, and Premium without an end stays without an end', async () => {
  const db = await setup()
  await grant(db, 0, 10)
  const first = await until(db)
  await grant(db, 0, 20)
  assert.ok(apart(await until(db), (await db.query(`select $1::timestamptz + interval '20 days' as t`, [first])).rows[0].t) < 1)

  await grant(db, 0, 0, true) // unlimited
  assert.equal(await until(db), null)
  const again = await grant(db, 12)
  assert.equal(again.unlimited, true)
  assert.equal(await until(db), null, 'adding a period to unlimited Premium does not end it')
})

test('a promo code adds its days to the end date and shows up in the history', async () => {
  const db = await setup()
  await grant(db, 3)
  const before = await until(db)
  await db.query(`select public.admin_create_promo('FRIENDS30', 30, 2)`)

  await signInAs(db, USER)
  const r = (await db.query(`select public.redeem_promo('friends30') as r`)).rows[0].r
  assert.equal(r.ok, true)
  assert.ok(apart(await until(db), (await db.query(`select $1::timestamptz + interval '30 days' as t`, [before])).rows[0].t) < 1)

  const again = (await db.query(`select public.redeem_promo('FRIENDS30') as r`)).rows[0].r
  assert.deepEqual([again.ok, again.error], [false, 'already_used'])

  await signInAs(db, ADMIN)
  const history = (await db.query('select public.admin_premium_history() as h')).rows[0].h
  assert.equal(history[0].source, 'promo')
  assert.equal(history[0].note, 'FRIENDS30')
  assert.equal(history[0].days, 30)
})

test('the older plan tool adds days too instead of replacing the end date', async () => {
  const db = await setup()
  await db.query(`select public.admin_set_plan('user@x.ua', 'premium', 30)`)
  await db.query(`select public.admin_set_plan('user@x.ua', 'premium', 90)`)
  const expected = (await db.query(`select now() + interval '120 days' as t`)).rows[0].t
  assert.ok(apart(await until(db), expected) < 60, '30 + 90 days = 120 days from today')
})

test('switching a user back to the free plan is recorded', async () => {
  const db = await setup()
  await grant(db, 6)
  const had = await until(db)
  const r = (await db.query(`select public.admin_set_plan('user@x.ua', 'free', null) as r`)).rows[0].r
  assert.equal(r.ok, true)
  assert.equal((await db.query(`select public.internal_plan('${USER}') as p`)).rows[0].p, 'free')
  const last = (await db.query('select public.admin_premium_history(1) as h')).rows[0].h[0]
  assert.equal(last.source, 'reset')
  assert.ok(apart(last.previous_until, had) < 1)
})

test('only admins can grant Premium or read the history', async () => {
  const db = await setup()
  await signInAs(db, USER)
  await assert.rejects(() => grant(db, 3), /forbidden/)
  await assert.rejects(() => db.query('select public.admin_premium_history()'), /forbidden/)
  await assert.rejects(() => db.query(`select public.admin_preorders_by_period()`), /forbidden/)
})

test('bad input is refused and nothing is written', async () => {
  const db = await setup()
  assert.equal((await grant(db, 0, 0)).error, 'bad_period')
  assert.equal((await grant(db, 500)).error, 'bad_period')
  const unknown = (await db.query(`select public.admin_grant_premium('nobody@x.ua', 3, 0, false) as r`)).rows[0].r
  assert.equal(unknown.error, 'user_not_found')
  assert.equal(await until(db), null)
  assert.equal((await db.query('select count(*)::int as n from public.premium_grants')).rows[0].n, 0)
})

test('pre-orders are counted by the period the person chose', async () => {
  const db = await setup()
  await db.exec(`
    insert into auth.users (id, email) values
      ('33333333-3333-3333-3333-333333333333', 'a@x.ua'), ('44444444-4444-4444-4444-444444444444', 'b@x.ua');
    insert into public.preorders (user_id, months) values
      ('${USER}', 3), ('33333333-3333-3333-3333-333333333333', 3), ('44444444-4444-4444-4444-444444444444', 12);
  `)
  const rows = (await db.query('select public.admin_preorders_by_period() as r')).rows[0].r
  assert.deepEqual(rows, [{ months: 3, count: 2 }, { months: 12, count: 1 }])
  await assert.rejects(() => db.exec(`insert into public.preorders (user_id, months) values ('${ADMIN}', 5)`), /check/)
})

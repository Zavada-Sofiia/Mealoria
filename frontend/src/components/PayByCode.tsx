import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { formatDate } from '../plan/context'
import { t } from '../i18n'

export type PayInfo = { enabled: boolean; card: string; prices: Record<string, number> }
type Order = { code: string; months: number; amount_uah: number; status: 'pending' | 'paid' | 'cancelled'; paid_at: string | null }

const json = { 'Content-Type': 'application/json' }

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      // clipboard blocked: the text is still on the screen to select by hand
    }
  }
  return (
    <button type="button" onClick={() => void copy()} aria-label={label}>
      {done ? t('Скопійовано ✓') : t('Копіювати')}
    </button>
  )
}

/** Pay for Premium by a bank transfer with a personal code in the comment; Premium arrives by itself. */
export default function PayByCode({ info, months, onPaid }: { info: PayInfo; months: number; onPaid: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(
    () => apiFetch<Order[]>('/api/payments/orders').then(setOrders).catch(() => {}),
    [],
  )
  const pending = orders?.find((o) => o.status === 'pending' && o.months === months)
  const justPaid = orders?.find((o) => o.status === 'paid' && Date.now() - Date.parse(o.paid_at ?? '') < 10 * 60 * 1000)
  const waiting = orders?.some((o) => o.status === 'pending') ?? false

  useEffect(() => {
    void load()
  }, [load])

  // while an order is open, look for the payment every 10 seconds
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => void load(), 10000)
    return () => clearInterval(timer)
  }, [waiting, load])

  const paidCode = justPaid?.code
  useEffect(() => {
    if (paidCode) onPaid()
  }, [paidCode, onPaid])

  async function create() {
    setBusy(true)
    setMessage('')
    try {
      await apiFetch('/api/payments/orders', { method: 'POST', headers: json, body: JSON.stringify({ months }) })
      await load()
    } catch {
      setMessage(t('Не вдалося створити замовлення. Спробуйте ще раз.'))
    } finally {
      setBusy(false)
    }
  }

  async function cancel(code: string) {
    try {
      await apiFetch(`/api/payments/orders/${code}`, { method: 'DELETE' })
      await load()
    } catch {
      setMessage(t('Не вдалося скасувати замовлення.'))
    }
  }

  const amount = info.prices[String(months)]

  return (
    <div>
      {justPaid && (
        <p className="status">
          {t('Оплату отримано, дякуємо! Преміум активовано на {n} міс.', { n: justPaid.months })}
          {justPaid.paid_at ? ` (${formatDate(justPaid.paid_at)})` : ''}
        </p>
      )}
      {pending ? (
        <div className="card" style={{ margin: '12px 0' }}>
          <strong>{t('Як оплатити')}</strong>
          <ol style={{ paddingLeft: 20 }}>
            <li>
              {t('Переведіть {amount} грн на картку:', { amount: pending.amount_uah })}
              <div className="actions" style={{ marginTop: 6 }}>
                <code style={{ fontSize: '1.1em' }}>{info.card}</code>
                <CopyButton text={info.card.replace(/\s/g, '')} label={t('Копіювати номер картки')} />
              </div>
            </li>
            <li>
              {t('У коментарі до переказу обов’язково вкажіть код:')}
              <div className="actions" style={{ marginTop: 6 }}>
                <code style={{ fontSize: '1.3em', fontWeight: 700 }}>{pending.code}</code>
                <CopyButton text={pending.code} label={t('Копіювати код')} />
              </div>
            </li>
            <li>{t('Преміум активується сам за хвилину-дві після переказу. Сторінку можна не закривати.')}</li>
          </ol>
          <p className="muted">
            {t('Сума має бути не меншою за {amount} грн. Якщо забули код у коментарі, напишіть нам: підтвердимо оплату вручну.', {
              amount: pending.amount_uah,
            })}
          </p>
          <button type="button" onClick={() => void cancel(pending.code)}>{t('Скасувати замовлення')}</button>
        </div>
      ) : (
        <>
          <button onClick={() => void create()} disabled={busy || orders === null}>
            {amount ? t('Оплатити {amount} грн за {n} міс', { amount, n: months }) : t('Оплатити {n} міс', { n: months })}
          </button>
          <p>
            <small>{t('Оплата переказом на картку. Код замовлення покажемо на наступному кроці.')}</small>
          </p>
        </>
      )}
      {message && <p className="status">{message}</p>}
    </div>
  )
}

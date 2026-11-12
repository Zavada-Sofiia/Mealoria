import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { autoPlanMessage, autoPlanWeek } from '../autoplan'
import { mondayOf } from '../dates'
import { t } from '../i18n'

type Props = { hasProfile: boolean; onDismiss: () => void }

/**
 * For people whose week is still empty. Without a profile: two steps (profile, then a filled week).
 * With a profile: just the offer to fill the week.
 */
export default function GettingStarted({ hasProfile, onDismiss }: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function fillWeek() {
    setBusy(true)
    setMessage('')
    try {
      const r = await autoPlanWeek(mondayOf(new Date()))
      if (r.added > 0) navigate('/calendar')
      else setMessage(autoPlanMessage(r))
    } catch {
      setMessage(t('Не вдалося заповнити тиждень'))
    } finally {
      setBusy(false)
    }
  }

  const fillButton = (
    <button type="button" onClick={() => void fillWeek()} disabled={busy || !hasProfile}>
      {busy ? t('Підбираємо страви…') : t('Заповнити тиждень')}
    </button>
  )

  return (
    <section className="card red" aria-label={t('Початок роботи')}>
      <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0 }}>{hasProfile ? t('Меню на цей тиждень ще не складено') : t('Почніть за 2 кроки')}</h3>
        <button type="button" onClick={onDismiss}>{t('Сховати')}</button>
      </div>
      {hasProfile ? (
        <>
          <p className="muted">
            {t('Одна кнопка підбере страви на кожен прийом їжі під ваш калораж. Потім можна все змінити вручну.')}
          </p>
          {fillButton}
        </>
      ) : (
        <ol className="plain" style={{ paddingLeft: 0, listStyle: 'none' }}>
          <li style={{ marginBottom: 12 }}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 22, color: 'var(--muted)' }}>1.</span>
            <strong>{t('Розкажіть про себе')}</strong>
            <div className="muted" style={{ marginLeft: 22 }}>
              {t('Вік, зріст, вага, мета, а також дієта й алергени: ми порахуємо калораж і підберемо підходящі страви.')}
            </div>
            <div style={{ marginLeft: 22, marginTop: 6 }}>
              <Link to="/profile"><button>{t('Заповнити профіль')}</button></Link>
            </div>
          </li>
          <li>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 22, color: 'var(--muted)' }}>2.</span>
            <strong>{t('Складіть меню на тиждень')}</strong>
            <div className="muted" style={{ marginLeft: 22 }}>
              {t('Одна кнопка підбере страви на кожен прийом їжі під ваш калораж. Потім можна все змінити вручну.')}
            </div>
            <div style={{ marginLeft: 22, marginTop: 6 }}>
              {fillButton} <small className="muted">{t('Спершу заповніть профіль')}</small>
            </div>
          </li>
        </ol>
      )}
      {message && <p className="status">{message}</p>}
    </section>
  )
}

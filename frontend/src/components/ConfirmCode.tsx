import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import { authErrorText } from '../authError'
import { t } from '../i18n'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

type Props = { email: string; onBack: () => void; sent?: boolean }

/** The second step of sign-up: the person types the code from the e-mail instead of opening a link. */
export default function ConfirmCode({ email, onBack, sent = true }: Props) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(sent ? '' : t('Email ще не підтверджено. Натисніть кнопку «Надіслати код ще раз», і ми надішлемо код.'))
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(sent ? RESEND_SECONDS : 0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  function show(text: string, isError: boolean) {
    setFailed(isError)
    setMessage(text)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (code.length < CODE_LENGTH) return show(t('Введіть код із листа: {n} цифр.', { n: CODE_LENGTH }), true)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
    setBusy(false)
    if (error) return show(authErrorText(error, 'code'), true)
    navigate('/profile')
  }

  async function resend() {
    if (wait > 0) return
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) return show(authErrorText(error), true)
    setWait(RESEND_SECONDS)
    setCode('')
    show(t('Новий код надіслано. Старий уже не діє.'), false)
  }

  return (
    <form onSubmit={submit} className="card narrow" noValidate>
      <h1>{t('Підтвердіть пошту')}</h1>
      <p>{t('Ми надіслали код на {email}. Введіть його нижче.', { email })}</p>
      <label>
        {t('Код із листа')}
        <input
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="000000"
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>{t('Підтвердити')}</button>
        <button type="button" className="secondary" onClick={() => void resend()} disabled={wait > 0}>
          {wait > 0 ? t('Надіслати ще раз ({n} с)', { n: wait }) : t('Надіслати код ще раз')}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>
        {t('Листа немає? Зазирніть у «Спам». Помилилися в пошті?')}{' '}
        <a href="#back" onClick={(e) => { e.preventDefault(); onBack() }}>{t('Змінити email')}</a>
      </p>
      {message && <p className={failed ? 'status error' : 'status'} role="alert" style={{ marginTop: 16 }}>{message}</p>}
    </form>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import { passwordProblems } from '../password'
import { t } from '../i18n'
import ConfirmCode from '../components/ConfirmCode'
import { authErrorText, authLinkError, clearAuthLinkError, EMAIL_PATTERN } from '../authError'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState(authLinkError)
  const [confirming, setConfirming] = useState<{ email: string; sent: boolean } | null>(null)
  const [failed, setFailed] = useState(() => authLinkError() !== '')
  const problems = mode === 'signup' ? passwordProblems(password, email) : []

  // a failed e-mail link or Google sign-in lands here with the reason in the address
  useEffect(() => clearAuthLinkError(), [])

  function fail(text: string) {
    setFailed(true)
    setMessage(text)
  }

  function note(text: string) {
    setFailed(false)
    setMessage(text)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    if (!email.trim()) return fail(t('Введіть email.'))
    if (!EMAIL_PATTERN.test(email.trim())) return fail(t('Перевірте, чи правильно введено email.'))
    if (!password) return fail(t('Введіть пароль.'))
    if (mode === 'signup') {
      if (problems.length) return fail(t('Придумайте надійніший пароль: {list}.', { list: problems.join('; ').toLowerCase() }))
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) return fail(authErrorText(error))
      if (!data.session) return setConfirming({ email: email.trim(), sent: true })
      return navigate('/profile')
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error?.code === 'email_not_confirmed') return setConfirming({ email: email.trim(), sent: false })
    if (error) return fail(authErrorText(error))
    navigate('/today')
  }

  async function forgotPassword() {
    setMessage('')
    if (!email.trim()) return fail(t('Спочатку введіть email у поле вище.'))
    if (!EMAIL_PATTERN.test(email.trim())) return fail(t('Перевірте, чи правильно введено email.'))
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    })
    if (error) fail(authErrorText(error))
    else note(t('Якщо такий акаунт є, ми надіслали лист із посиланням для нового пароля.'))
  }

  async function signInWithGoogle() {
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) fail(authErrorText(error))
  }

  if (confirming) {
    return <ConfirmCode email={confirming.email} sent={confirming.sent} onBack={() => setConfirming(null)} />
  }

  return (
    <form onSubmit={submit} className="card narrow" noValidate>
      <h1>{mode === 'signin' ? t('Вхід') : t('Реєстрація')}</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        {t('Пароль')}
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {problems.length > 0 && password && (
        <ul className="pw-hints">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {mode === 'signup' && !problems.length && password && <p className="pw-ok">{t('Пароль надійний')}</p>}
      {mode === 'signin' && (
        <p style={{ margin: '-4px 0 12px' }}>
          <a href="#forgot" onClick={(e) => { e.preventDefault(); void forgotPassword() }}>
            {t('Забули пароль?')}
          </a>
        </p>
      )}
      <div className="actions">
        <button type="submit">{mode === 'signin' ? t('Увійти') : t('Зареєструватися')}</button>
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? t('Створити акаунт') : t('Вже є акаунт')}
        </button>
      </div>
      <hr />
      <button type="button" onClick={signInWithGoogle} style={{ width: '100%' }}>
        {t('Увійти через Google')}
      </button>
      <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>
        {t('Продовжуючи, ви погоджуєтесь з')} <Link to="/terms">{t('Умовами')}</Link> {t('і')}{' '}
        <Link to="/privacy">{t('Політикою конфіденційності')}</Link>.
      </p>
      {message && <p className={failed ? 'status error' : 'status'} role="alert" style={{ marginTop: 16 }}>{message}</p>}
    </form>
  )
}

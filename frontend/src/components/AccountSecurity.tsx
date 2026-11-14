import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../api/supabase'
import { authErrorText, EMAIL_PATTERN } from '../authError'
import { passwordProblems } from '../password'
import { t } from '../i18n'
import PasswordInput from './PasswordInput'

type Result = { text: string; failed: boolean } | null

function Message({ result }: { result: Result }) {
  if (!result) return null
  return <p className={result.failed ? 'status error' : 'status'} role="alert" style={{ marginTop: 12 }}>{result.text}</p>
}

/** Change the password and the e-mail of the account. */
export default function AccountSecurity() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])
  if (!user) return null
  // a person who signed up with Google only has no password and no e-mail of their own to change
  const hasPassword = (user.app_metadata?.providers as string[] | undefined)?.includes('email') ?? false
  return (
    <>
      <PasswordCard user={user} hasPassword={hasPassword} />
      <EmailCard user={user} hasPassword={hasPassword} />
    </>
  )
}

function PasswordCard({ user, hasPassword }: { user: User; hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const problems = passwordProblems(next, user.email ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setResult(null)
    if (hasPassword && !current) return setResult({ text: t('Введіть поточний пароль.'), failed: true })
    if (!next) return setResult({ text: t('Введіть новий пароль.'), failed: true })
    if (problems.length)
      return setResult({ text: t('Придумайте надійніший пароль: {list}.', { list: problems.join('; ').toLowerCase() }), failed: true })
    setBusy(true)
    if (hasPassword) {
      // the current password is asked again, so a stranger at an unlocked device cannot take the account over
      const { error } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password: current })
      if (error) {
        setBusy(false)
        const wrong = error.code === 'invalid_credentials'
        return setResult({ text: wrong ? t('Поточний пароль неправильний.') : authErrorText(error), failed: true })
      }
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (error) return setResult({ text: authErrorText(error), failed: true })
    setCurrent('')
    setNext('')
    setResult({ text: hasPassword ? t('Пароль змінено.') : t('Пароль встановлено. Тепер можна входити й за email.'), failed: false })
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>{hasPassword ? t('Змінити пароль') : t('Встановити пароль')}</h2>
      {!hasPassword && <p className="muted">{t('Ви входите через Google. Можна додати пароль, щоб входити й за email.')}</p>}
      <form onSubmit={submit} noValidate>
        {hasPassword && (
          <label>
            {t('Поточний пароль')}
            <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <label>
          {t('Новий пароль')}
          <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        {problems.length > 0 && next && (
          <ul className="pw-hints">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {!problems.length && next && <p className="pw-ok">{t('Пароль надійний')}</p>}
        <button type="submit" disabled={busy}>{hasPassword ? t('Змінити пароль') : t('Встановити пароль')}</button>
      </form>
      <Message result={result} />
    </section>
  )
}

function EmailCard({ user, hasPassword }: { user: User; hasPassword: boolean }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [pending, setPending] = useState(user.new_email ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setResult(null)
    const wanted = email.trim()
    if (!wanted) return setResult({ text: t('Введіть новий email.'), failed: true })
    if (!EMAIL_PATTERN.test(wanted)) return setResult({ text: t('Перевірте, чи правильно введено email.'), failed: true })
    if (wanted.toLowerCase() === (user.email ?? '').toLowerCase())
      return setResult({ text: t('Це вже ваш поточний email.'), failed: true })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: wanted })
    setBusy(false)
    if (error) return setResult({ text: authErrorText(error), failed: true })
    setPending(wanted)
    setEmail('')
    setResult({
      text: t('Ми надіслали лист на {email}. Відкрийте його й підтвердіть зміну. Якщо лист прийде й на поточну пошту, підтвердьте й там.', { email: wanted }),
      failed: false,
    })
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>{t('Змінити email')}</h2>
      <p className="muted">{t('Поточний email: {email}', { email: user.email ?? '' })}</p>
      {!hasPassword ? (
        <p className="muted">{t('Ви входите через Google, тому email акаунта змінюється в самому Google.')}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <label>
            {t('Новий email')}
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>{t('Змінити email')}</button>
        </form>
      )}
      {pending && !result && <p className="status" style={{ marginTop: 12 }}>{t('Очікуємо підтвердження нового email: {email}', { email: pending })}</p>}
      <Message result={result} />
    </section>
  )
}

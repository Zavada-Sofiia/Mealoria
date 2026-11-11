import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'
import { passwordProblems } from '../password'
import { t } from '../i18n'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [waited, setWaited] = useState(false)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const problems = passwordProblems(password, '')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true))
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    const timer = setTimeout(() => setWaited(true), 4000)
    return () => {
      data.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (problems.length) return setMessage(t('Придумайте надійніший пароль: {list}.', { list: problems.join('; ').toLowerCase() }))
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setMessage(error.message)
    navigate('/today')
  }

  if (!ready) {
    return (
      <div className="card narrow">
        <h1>{t('Новий пароль')}</h1>
        {waited ? (
          <p>
            {t('Посилання недійсне або застаріло.')} <Link to="/auth">{t('Запросіть нове на сторінці входу')}</Link>.
          </p>
        ) : (
          <p className="status">{t('Перевіряємо посилання…')}</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card narrow">
      <h1>{t('Новий пароль')}</h1>
      <label>
        {t('Пароль')}
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {problems.length > 0 && password && (
        <ul className="pw-hints">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {!problems.length && password && <p className="pw-ok">{t('Пароль надійний')}</p>}
      <button type="submit">{t('Зберегти пароль')}</button>
      {message && <p className="status" style={{ marginTop: 16 }}>{message}</p>}
    </form>
  )
}

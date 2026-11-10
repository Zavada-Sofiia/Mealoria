import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../api/supabase'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return setMessage(error.message)
      if (!data.session) return setMessage('Перевірте пошту, щоб підтвердити email.')
      return navigate('/profile')
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMessage(error.message)
    navigate('/today')
  }

  async function signInWithGoogle() {
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setMessage(error.message)
  }

  return (
    <form onSubmit={submit} className="card narrow">
      <h1>{mode === 'signin' ? 'Вхід' : 'Реєстрація'}</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Пароль
        <input
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </label>
      <div className="actions">
        <button type="submit">{mode === 'signin' ? 'Увійти' : 'Зареєструватися'}</button>
        <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Створити акаунт' : 'Вже є акаунт'}
        </button>
      </div>
      <hr />
      <button type="button" onClick={signInWithGoogle} style={{ width: '100%' }}>
        Увійти через Google
      </button>
      {message && <p className="status" style={{ marginTop: 16 }}>{message}</p>}
    </form>
  )
}

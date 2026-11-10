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
    navigate('/')
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
    <form onSubmit={submit}>
      <h1>{mode === 'signin' ? 'Вхід' : 'Реєстрація'}</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={6}
        required
      />
      <button type="submit">{mode === 'signin' ? 'Увійти' : 'Зареєструватися'}</button>
      <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Створити акаунт' : 'Вже є акаунт'}
      </button>
      <hr />
      <button type="button" onClick={signInWithGoogle}>
        Увійти через Google
      </button>
      {message && <p>{message}</p>}
    </form>
  )
}

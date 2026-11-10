import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { supabase } from '../api/supabase'

export default function Placeholder({ title }: { title: string }) {
  const [status, setStatus] = useState('Підключаємося до сервера…')

  useEffect(() => {
    apiFetch<{ user_id: string }>('/api/me')
      .then(() => setStatus('Сервер підключено'))
      .catch(() => setStatus('Сервер недоступний'))
  }, [])

  return (
    <div>
      <h1>{title}</h1>
      <p>{status}</p>
      <Link to="/profile">Профіль</Link>
      <button onClick={() => supabase.auth.signOut()}>Вийти</button>
    </div>
  )
}

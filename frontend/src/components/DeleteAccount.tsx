import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { supabase } from '../api/supabase'

const WORD = 'ВИДАЛИТИ'

export default function DeleteAccount() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setBusy(true)
    setError('')
    try {
      await apiFetch<void>('/api/account', { method: 'DELETE' })
      await supabase.auth.signOut()
      navigate('/')
    } catch {
      setError('Не вдалося видалити акаунт. Спробуйте ще раз або напишіть нам.')
      setBusy(false)
    }
  }

  return (
    <section className="card red" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Видалити акаунт</h2>
      <p className="muted">
        Назавжди видалимо профіль, страви, фото, меню в календарі, список продуктів і журнал ваги. Це не
        можна скасувати.
      </p>
      {!open ? (
        <button type="button" className="danger" onClick={() => setOpen(true)}>
          Видалити акаунт
        </button>
      ) : (
        <div>
          <label>
            Щоб підтвердити, введіть слово {WORD}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="actions">
            <button type="button" className="danger" disabled={typed.trim() !== WORD || busy} onClick={remove}>
              {busy ? 'Видаляємо…' : 'Видалити назавжди'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped('') }} disabled={busy}>
              Скасувати
            </button>
          </div>
        </div>
      )}
      {error && <p className="status" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  )
}

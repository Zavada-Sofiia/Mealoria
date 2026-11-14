import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { supabase } from '../api/supabase'
import { t } from '../i18n'
import { expectSignOut } from '../sessionBackup'

export default function DeleteAccount() {
  const WORD = t('ВИДАЛИТИ')
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
      expectSignOut()
      await supabase.auth.signOut()
      navigate('/')
    } catch {
      setError(t('Не вдалося видалити акаунт. Спробуйте ще раз або напишіть нам.'))
      setBusy(false)
    }
  }

  return (
    <section className="card red" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>{t('Видалити акаунт')}</h2>
      <p className="muted">
        {t('Назавжди видалимо профіль, страви, фото, меню в календарі, список продуктів і журнал ваги. Це не можна скасувати.')}
      </p>
      {!open ? (
        <button type="button" className="danger" onClick={() => setOpen(true)}>
          {t('Видалити акаунт')}
        </button>
      ) : (
        <div>
          <label>
            {t('Щоб підтвердити, введіть слово {word}', { word: WORD })}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          <div className="actions">
            <button type="button" className="danger" disabled={typed.trim().toUpperCase() !== WORD || busy} onClick={remove}>
              {busy ? t('Видаляємо…') : t('Видалити назавжди')}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped('') }} disabled={busy}>
              {t('Скасувати')}
            </button>
          </div>
        </div>
      )}
      {error && <p className="status" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  )
}

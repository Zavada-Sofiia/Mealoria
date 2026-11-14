import { useState, type InputHTMLAttributes } from 'react'
import { t } from '../i18n'

/** A password field with an eye button that shows or hides what was typed. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <span className="password-field">
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        className="eye"
        aria-label={shown ? t('Сховати пароль') : t('Показати пароль')}
        title={shown ? t('Сховати пароль') : t('Показати пароль')}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  )
}

import { useState } from 'react'
import { flushSync } from 'react-dom'
import { applyTheme, currentTheme } from '../theme'
import { t } from '../i18n'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={next === 'dark' ? t('Темна тема') : t('Світла тема')}
      title={next === 'dark' ? t('Темна тема') : t('Світла тема')}
      onClick={(e) => {
        const swap = () => {
          applyTheme(next)
          flushSync(() => setTheme(next))
        }
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        if (!document.startViewTransition || calm) return swap()
        // the new theme spreads in a circle from the button
        const x = e.clientX || window.innerWidth - 40
        const y = e.clientY || 30
        const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        document.documentElement.classList.add('theme-switching')
        const transition = document.startViewTransition(swap)
        transition.ready
          .then(() =>
            document.documentElement.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
              { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
            ),
          )
          .catch(() => {})
        transition.finished.finally(() => document.documentElement.classList.remove('theme-switching'))
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === 'dark' ? (
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  )
}

import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { usePlan } from '../plan/context'
import { askConfirm } from '../confirm'
import { t } from '../i18n'
import LangToggle from './LangToggle'
import ThemeToggle from './ThemeToggle'

const ICONS: Record<string, string> = {
  '/today': 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  '/calendar': 'M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5',
  '/dishes': 'M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v8a3 3 0 0 1-3 3M17 21V3c-2.5 1.5-3.5 5-3.5 8H17',
  '/shopping': 'M3 4h2.5l2 11h10l2-8H7M9.5 19.5h.01M16.5 19.5h.01',
  '/photo': 'M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8ZM12 9.3a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}
// the photo tab sits in the middle as a big round camera button
const TABS = [
  ['/today', 'Сьогодні'],
  ['/calendar', 'Календар'],
  ['/photo', 'Порахувати'],
  ['/shopping', 'Продукти'],
]
const MORE = [
  ['/dishes', 'Мої страви'],
  ['/recipes', 'Рецепти'],
  ['/calories', 'Калорії й вода'],
  ['/ai', 'Що приготувати'],
  ['/profile', 'Профіль'],
  ['/settings', 'Налаштування'],
  ['/pricing', 'Тарифи'],
  ['/help', 'Допомога'],
  ['/support', 'Підтримати'],
]

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={name === 'more' ? 3.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}
const MAIN = [
  ['/today', 'Сьогодні'],
  ['/photo', 'Порахувати калорії'],
  ['/calendar', 'Календар'],
  ['/dishes', 'Мої страви'],
  ['/recipes', 'Рецепти'],
  ['/shopping', 'Список продуктів'],
  ['/calories', 'Калорії й вода'],
  ['/ai', 'Що приготувати'],
]
const RIGHT = [
  ['/profile', 'Профіль'],
  ['/settings', 'Налаштування'],
  ['/pricing', 'Тарифи'],
  ['/help', 'Допомога'],
  ['/support', 'Підтримати'],
]

async function signOut() {
  const ok = await askConfirm({
    title: t('Точно хочете вийти?'),
    text: t('Щоб користуватися сайтом далі, вам потрібно буде увійти знову.'),
    confirmLabel: t('Вийти'),
    cancelLabel: t('Лишитися'),
  })
  if (ok) await supabase.auth.signOut()
}

export default function Nav() {
  const { me } = usePlan()
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const inMore = MORE.some(([to]) => pathname.startsWith(to))
  useEffect(() => {
    document.body.classList.add('has-tabbar')
    return () => document.body.classList.remove('has-tabbar')
  }, [])

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo" end>
            Mealoria<span>.</span>
          </NavLink>
          <NavLink to="/" end className="about-link desktop-only">
            {t('Про сайт')}
          </NavLink>
          <span style={{ flex: 1 }} />
          <nav className="nav-links right desktop-only">
            {RIGHT.map(([to, label]) => (
              <NavLink key={to} to={to} viewTransition>
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <LangToggle />
          <ThemeToggle />
          {me && (
            <NavLink to="/pricing" className={`plan-badge${me.plan === 'premium' ? ' premium' : ''}`}>
              {me.plan === 'premium' ? t('Преміум') : t('Безкоштовний')}
              <span className="desktop-only">{me.plan === 'premium' ? '' : ` ${t('тариф')}`}</span>
            </NavLink>
          )}
          <button className="secondary desktop-only" onClick={() => signOut()}>
            {t('Вийти')}
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          {MAIN.map(([to, label]) => (
            <NavLink key={to} to={to} viewTransition className={to === '/photo' ? 'nav-photo' : undefined}>
              {t(label)}
              {to === '/photo' && <span className="nav-badge">{t('ШІ')}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <nav className="tabbar">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to} viewTransition className={to === '/photo' ? 'tab-photo' : undefined}>
            <Icon name={to} />
            {t(label)}
          </NavLink>
        ))}
        <button
          type="button"
          className={`tab-more${inMore || moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
        >
          <Icon name="more" />
          {t('Ще')}
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="sheet more-sheet" role="dialog" aria-label={t('Меню')} onClick={() => setMoreOpen(false)}>
            {MORE.map(([to, label]) => (
              <NavLink key={to} to={to} viewTransition>
                {t(label)}
              </NavLink>
            ))}
            <button type="button" className="secondary" onClick={() => signOut()}>
              {t('Вийти')}
            </button>
            <p className="sheet-legal">
              <NavLink to="/terms">{t('Умови')}</NavLink> · <NavLink to="/privacy">{t('Конфіденційність')}</NavLink>
            </p>
          </div>
        </>
      )}
    </>
  )
}

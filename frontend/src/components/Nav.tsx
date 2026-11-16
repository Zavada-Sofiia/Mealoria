import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { usePlan } from '../plan/context'
import { askConfirm } from '../confirm'
import { expectSignOut } from '../sessionBackup'
import { t } from '../i18n'
import LangToggle from './LangToggle'
import ThemeToggle from './ThemeToggle'
import { useEscape } from '../useEscape'

const ICONS: Record<string, string> = {
  '/today': 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  '/calendar': 'M4 6.5h16V20H4zM4 11h16M8.5 3.5v5M15.5 3.5v5',
  '/dishes': 'M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v8a3 3 0 0 1-3 3M17 21V3c-2.5 1.5-3.5 5-3.5 8H17',
  '/shopping': 'M3 4h2.5l2 11h10l2-8H7M9.5 19.5h.01M16.5 19.5h.01',
  '/photo': 'M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8ZM12 9.3a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  '/recipes': 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7.5h6M9 11h6',
  '/calories': 'M12 3c3 3.6 6 6.9 6 10.5a6 6 0 0 1-12 0c0-2.1 1-3.9 2.4-5.4.3 1.8 1.1 3 2.4 3.6C10.5 8.7 11 5.7 12 3Z',
  '/ai': 'M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7L12 3.5ZM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z',
  '/profile': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  '/settings': 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-2l-1.6-1.2 1.8-3.1 1.9.7a7 7 0 0 1 1.7-1l.3-2h3.6l.3 2a7 7 0 0 1 1.7 1l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 2Z',
  '/pricing': 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  '/help': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8M12 17.2h.01',
  '/support': 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z',
}
// the photo tab sits in the middle as a big round camera button
const TABS = [
  ['/today', 'Сьогодні'],
  ['/calendar', 'Календар'],
  ['/photo', 'Порахувати'],
  ['/shopping', 'Продукти'],
]
// in the "More" sheet the first four are big tiles with a short hint, the rest a compact list
const MORE_TILES = [
  ['/dishes', 'Мої страви', 'Ваші рецепти й КБЖВ'],
  ['/recipes', 'Рецепти', 'Каталог готових страв'],
  ['/calories', 'Калорії й вода', 'День, вага, графіки'],
  ['/ai', 'Що приготувати', 'Ідеї від ШІ'],
]
const MORE = [
  ...MORE_TILES.map(([to, label]) => [to, label]),
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
  if (ok) {
    expectSignOut()
    await supabase.auth.signOut()
  }
}

export default function Nav() {
  const { me } = usePlan()
  const [moreOpen, setMoreOpen] = useState(false)
  useEscape(moreOpen, () => setMoreOpen(false))
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
        {/* on a narrower desktop the top bar has no room for these, so they move here */}
        <nav className="sidebar-more">
          {RIGHT.map(([to, label]) => (
            <NavLink key={to} to={to} viewTransition>
              {t(label)}
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
            <span className="sheet-grip" aria-hidden="true" />
            <div className="more-tiles">
              {MORE_TILES.map(([to, label, hint]) => (
                <NavLink key={to} to={to} viewTransition className="more-tile">
                  <span className="more-icon">
                    <Icon name={to} />
                  </span>
                  <strong>{t(label)}</strong>
                  <small>{t(hint)}</small>
                </NavLink>
              ))}
            </div>
            <div className="more-list">
              {MORE.slice(MORE_TILES.length).map(([to, label]) => (
                <NavLink key={to} to={to} viewTransition>
                  <Icon name={to} />
                  <span>{t(label)}</span>
                  <span className="more-chevron" aria-hidden="true">›</span>
                </NavLink>
              ))}
            </div>
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

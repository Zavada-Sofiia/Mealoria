import { NavLink } from 'react-router-dom'
import { t } from '../i18n'
import LangToggle from './LangToggle'
import ThemeToggle from './ThemeToggle'

export default function PublicNav() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="logo" end>
          Mealoria<span>.</span>
        </NavLink>
        <span style={{ flex: 1 }} />
        <nav className="nav-links right desktop-only">
          <NavLink to="/pricing">{t('Тарифи')}</NavLink>
          <NavLink to="/support">{t('Підтримати')}</NavLink>
        </nav>
        <LangToggle />
        <ThemeToggle />
        <NavLink to="/auth">
          <button>{t('Увійти')}</button>
        </NavLink>
      </div>
    </header>
  )
}

import { NavLink } from 'react-router-dom'
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
          <NavLink to="/pricing">Тарифи</NavLink>
          <NavLink to="/support">Підтримати</NavLink>
        </nav>
        <ThemeToggle />
        <NavLink to="/auth">
          <button>Увійти</button>
        </NavLink>
      </div>
    </header>
  )
}

import { NavLink } from 'react-router-dom'

export default function PublicNav() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="logo">
          Mealoria<span>.</span>
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/pricing">Тарифи</NavLink>
          <NavLink to="/support">Підтримати</NavLink>
        </nav>
        <NavLink to="/auth">
          <button>Увійти</button>
        </NavLink>
      </div>
    </header>
  )
}

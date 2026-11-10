import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../api/supabase'

const TABS = [
  ['/today', 'Сьогодні'],
  ['/calendar', 'Календар'],
  ['/dishes', 'Страви'],
  ['/shopping', 'Продукти'],
  ['/profile', 'Профіль'],
]
const MAIN = [
  ['/today', 'Сьогодні'],
  ['/calendar', 'Календар'],
  ['/dishes', 'Мої страви'],
  ['/recipes', 'Рецепти'],
  ['/shopping', 'Список продуктів'],
  ['/calories', 'Калорії'],
]
const RIGHT = [
  ['/profile', 'Профіль'],
  ['/pricing', 'Тарифи'],
  ['/support', 'Підтримати'],
]

export default function Nav() {
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
            Про сайт
          </NavLink>
          <span style={{ flex: 1 }} />
          <nav className="nav-links right desktop-only">
            {RIGHT.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            Вийти
          </button>
        </div>
      </header>
      <aside className="sidebar">
        <nav>
          {MAIN.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <nav className="tabbar">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to}>
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

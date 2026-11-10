import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../api/supabase'

const TABS = [
  ['/', 'Календар'],
  ['/dishes', 'Страви'],
  ['/shopping', 'Продукти'],
  ['/calories', 'Калорії'],
  ['/profile', 'Профіль'],
]
const DESKTOP = [
  ['/', 'Календар'],
  ['/dishes', 'Мої страви'],
  ['/recipes', 'Рецепти'],
  ['/shopping', 'Продукти'],
  ['/calories', 'Калорії'],
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
          <NavLink to="/" className="logo">
            Mealoria<span>.</span>
          </NavLink>
          <nav className="nav-links desktop-only">
            {DESKTOP.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            Вийти
          </button>
        </div>
      </header>
      <nav className="tabbar">
        {TABS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

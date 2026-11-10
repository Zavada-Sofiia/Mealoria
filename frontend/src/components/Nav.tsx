import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../api/supabase'

const TABS = [
  ['/', 'Головна'],
  ['/calendar', 'Календар'],
  ['/dishes', 'Страви'],
  ['/shopping', 'Продукти'],
  ['/profile', 'Профіль'],
]
const MAIN = [
  ['/', 'Головна'],
  ['/calendar', 'Календар'],
  ['/dishes', 'Мої страви'],
  ['/recipes', 'Рецепти'],
  ['/shopping', 'Список продуктів'],
  ['/calories', 'Калорії'],
]
const MORE = [
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
          <span style={{ flex: 1 }} />
          <button className="secondary" onClick={() => supabase.auth.signOut()}>
            Вийти
          </button>
        </div>
      </header>
      <aside className="sidebar">
        {[MAIN, MORE].map((group, i) => (
          <nav key={i}>
            {group.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>
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

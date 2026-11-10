import { Link } from 'react-router-dom'
import { supabase } from '../api/supabase'

export default function Nav() {
  return (
    <nav>
      <Link to="/">Календар</Link> · <Link to="/dishes">Мої страви</Link> ·{' '}
      <Link to="/recipes">Рецепти</Link> ·{' '}
      <Link to="/shopping">Продукти</Link> ·{' '}
      <Link to="/profile">Профіль</Link> ·{' '}
      <Link to="/pricing">Тарифи</Link> ·{' '}
      <Link to="/support">Підтримати</Link> ·{' '}
      <button onClick={() => supabase.auth.signOut()}>Вийти</button>
    </nav>
  )
}

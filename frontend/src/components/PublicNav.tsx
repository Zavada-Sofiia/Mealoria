import { Link } from 'react-router-dom'

export default function PublicNav() {
  return (
    <nav>
      <Link to="/">Головна</Link> · <Link to="/pricing">Тарифи</Link> ·{' '}
      <Link to="/support">Підтримати</Link> · <Link to="/auth">Увійти</Link>
    </nav>
  )
}

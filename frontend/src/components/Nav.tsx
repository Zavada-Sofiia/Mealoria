import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav>
      <Link to="/">Календар</Link> · <Link to="/dishes">Мої страви</Link> ·{' '}
      <Link to="/profile">Профіль</Link>
    </nav>
  )
}

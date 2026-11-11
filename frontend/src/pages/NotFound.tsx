import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="narrow">
      <h1>Сторінку не знайдено</h1>
      <p className="muted">Можливо, адресу введено з помилкою або сторінку видалено.</p>
      <Link to="/">
        <button>На головну</button>
      </Link>
    </div>
  )
}

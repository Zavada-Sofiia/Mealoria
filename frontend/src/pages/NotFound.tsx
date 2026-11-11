import { Link } from 'react-router-dom'
import { t } from '../i18n'

export default function NotFound() {
  return (
    <div className="narrow">
      <h1>{t('Сторінку не знайдено')}</h1>
      <p className="muted">{t('Можливо, адресу введено з помилкою або сторінку видалено.')}</p>
      <Link to="/">
        <button>{t('На головну')}</button>
      </Link>
    </div>
  )
}

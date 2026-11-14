import MealPhotoCard from '../components/MealPhotoCard'
import { t } from '../i18n'

/** The main feature on its own page: take a photo of a plate and get its calories. */
export default function Photo() {
  return (
    <div>
      <p className="greeting">{t('ШІ')}</p>
      <h1>{t('Калорії по фото')}</h1>
      <p className="muted lead-small">{t('Зробіть фото тарілки: за кілька секунд ШІ оцінить калорії, білки, жири, вуглеводи та інгредієнти. Страву можна одразу зберегти й додати в меню.')}</p>
      <MealPhotoCard standalone />
    </div>
  )
}

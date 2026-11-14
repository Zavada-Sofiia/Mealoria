import { useSearchParams } from 'react-router-dom'
import DishCalculator from '../components/DishCalculator'
import MealPhotoCard from '../components/MealPhotoCard'
import { t } from '../i18n'

const MODES = [
  ['photo', 'По фото'],
  ['calc', 'Продукти й штрихкод'],
] as const

/** The main feature: count a dish's calories from a photo (AI) or from its products and barcodes. */
export default function Photo() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'calc' ? 'calc' : 'photo'

  return (
    <div>
      <p className="greeting">{t('ШІ')}</p>
      <h1>{t('Порахувати калорії')}</h1>
      <p className="muted lead-small">
        {mode === 'photo'
          ? t('Зробіть фото тарілки: за кілька секунд ШІ оцінить калорії, білки, жири, вуглеводи та інгредієнти. Страву можна одразу зберегти й додати в меню.')
          : t('Відскануйте штрихкод на упаковці або знайдіть продукт за назвою, вкажіть грами, і калькулятор складе калорії та БЖВ усієї страви.')}
      </p>
      <div className="mode-switch" role="tablist" aria-label={t('Спосіб')}>
        {MODES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={mode === key ? 'on' : undefined}
            onClick={() => setParams(key === 'calc' ? { mode: 'calc' } : {}, { replace: true })}
          >
            {key === 'photo' ? '📷 ' : '🔍 '}
            {t(label)}
          </button>
        ))}
      </div>
      {mode === 'photo' ? <MealPhotoCard standalone /> : <DishCalculator />}
    </div>
  )
}

import { useLang } from '../i18n/context'
import { t } from '../i18n'

export default function LangToggle() {
  const { lang, changeLang } = useLang()
  const next = lang === 'uk' ? 'en' : 'uk'
  return (
    <button
      type="button"
      className="theme-toggle lang-toggle"
      aria-label={t('Змінити мову')}
      title={next === 'en' ? 'English' : 'Українська'}
      onClick={() => changeLang(next)}
    >
      {next === 'en' ? 'EN' : 'UA'}
    </button>
  )
}

import { useLang } from '../i18n/context'
import { t } from '../i18n'

export default function LangToggle() {
  const { lang, changeLang } = useLang()
  const next = lang === 'uk' ? 'en' : 'uk'
  const code = next === 'en' ? 'EN' : 'UA'
  return (
    <button
      type="button"
      className="theme-toggle lang-toggle"
      // the spoken name starts with what is written on the button, so voice control finds it by "EN"
      aria-label={t('{code}: змінити мову', { code })}
      title={next === 'en' ? 'English' : 'Українська'}
      onClick={() => changeLang(next)}
    >
      {code}
    </button>
  )
}

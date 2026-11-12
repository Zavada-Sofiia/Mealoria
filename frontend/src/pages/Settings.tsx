import { Link } from 'react-router-dom'
import { currentTheme, applyTheme } from '../theme'
import { useLang } from '../i18n/context'
import { convertAmount, feetInches, heightUnit, num, showHeight, showWeight, weightUnit, type Units } from '../units'
import { t } from '../i18n'
import { useState } from 'react'

const OPTIONS: [Units, string, string][] = [
  ['metric', 'Метричні', 'кг, см, грами, мілілітри'],
  ['imperial', 'Імперські (США)', 'фунти, дюйми, унції, рідкі унції'],
]

export default function Settings() {
  const { lang, changeLang, units, changeUnits } = useLang()
  const [theme, setTheme] = useState(currentTheme)

  return (
    <div className="narrow settings">
      <p>
        <Link to="/profile">← {t('До профілю')}</Link>
      </p>
      <h1>{t('Налаштування')}</h1>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{t('Одиниці виміру')}</h2>
        <p className="muted">
          {t('Одиниці виміру показуються на сайті так, як вам зручно. Дані зберігаються точно, тому ви можете перемикатись у будь-який момент.')}
        </p>
        <div className="choice-cards" role="radiogroup" aria-label={t('Одиниці виміру')}>
          {OPTIONS.map(([key, title, hint]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={units === key}
              className={units === key ? 'on' : ''}
              onClick={() => changeUnits(key)}
            >
              <strong>{t(title)}</strong>
              <small>{t(hint)}</small>
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t('Вага: {value} · зріст: {height}', {
            value: `${num(showWeight(62))} ${weightUnit()}`,
            height: `${showHeight(168)} ${heightUnit()} (${feetInches(168)})`,
          })}
          <br />
          {t('Приклад: 150 г = {amount}', { amount: convertAmount('150 г') })}
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>{t('Мова')}</h2>
        <div className="seg">
          {(['uk', 'en'] as const).map((l) => (
            <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => changeLang(l)}>
              {l === 'uk' ? 'Українська' : 'English'}
            </button>
          ))}
        </div>
        <h2>{t('Тема')}</h2>
        <div className="seg">
          {(['light', 'dark'] as const).map((th) => (
            <button
              key={th}
              type="button"
              className={theme === th ? 'on' : ''}
              onClick={() => {
                applyTheme(th)
                setTheme(th)
              }}
            >
              {th === 'light' ? t('Світла') : t('Темна')}
            </button>
          ))}
        </div>
      </section>

      <p className="muted">
        <small>{t('Налаштування зберігаються в цьому браузері.')}</small>
      </p>
    </div>
  )
}

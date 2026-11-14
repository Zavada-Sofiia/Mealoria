import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CONTACT_EMAIL } from '../config'
import { usePageMeta } from '../seo'
import { canInstall, isInstalled, onInstallChange, promptInstall } from '../pwa'
import { t } from '../i18n'

const STEPS = [
  ['1', 'Розкажіть про себе', 'Вік, зріст, вага, мета й вподобання. Ми порахуємо ваш калораж і врахуємо дієту та алергії.'],
  ['2', 'Складіть меню на тиждень', 'Додайте свої страви або візьміть готові з каталогу й перетягніть їх у календар.'],
  ['3', 'Купуйте за списком', 'Список продуктів збереться з календаря сам. Те, що вже є вдома, відніметься.'],
]
const FEATURES = [
  ['Профіль і норма калорій', 'Вік, зріст, вага, мета й активність: рахуємо вашу норму калорій. Дієта, алергени, кухні, час і бюджет враховуються в рецептах.'],
  ['Календар на тиждень', 'Перетягуйте страви на день мишею чи пальцем, на телефоні працює день за днем. Повторіть минулий тиждень одним дотиком, роздрукуйте меню в PDF або додайте його в календар телефона.'],
  ['Мої страви', 'Власні страви з інгредієнтами, рецептом, фото, калоріями, БЖВ і клітковиною. Вкажіть, на скільки порцій каструля й для якого прийому їжі страва. Є пошук, сортування й улюблені.'],
  ['Каталог рецептів', 'Готові рецепти з фільтром за вашими вподобаннями. Додайте їх у свої страви чи в календар і змініть кількість людей, щоб перерахувати інгредієнти.'],
  ['Список продуктів', 'Збирається з календаря сам, частками за порціями. Додавайте свої продукти без календаря, позначайте, що вже є вдома, і купуйте за списком.'],
  ['Калорії, БЖВ і клітковина', 'Підсумок за день проти вашої цілі, графіки за тиждень і місяць, журнал ваги та калькулятор страви. ШІ оцінює калорії по фото.'],
  ['Що приготувати', 'Підбирає рецепти під ваш профіль і з того, що є в холодильнику. У преміумі сам рахує калорії ваших страв, пише рецепт з інгредієнтами та малює фото страви.'],
  ['Зручність', 'Темна тема, українська й англійська мови, друк і експорт тижня. Встановіть сайт як застосунок на телефон чи комп’ютер.'],
]

const INSTALL_STEPS = [
  [
    'iPhone та iPad (Safari)',
    [
      'Торкніться кнопки «Поділитися» (квадрат зі стрілкою). У новому Safari вона в меню ≡ ліворуч в адресному полі.',
      'Прокрутіть вниз і виберіть «На екран "Додому"».',
      'Натисніть «Додати»: іконка Mealoria з’явиться на головному екрані.',
    ],
  ],
  [
    'Android (Chrome)',
    [
      'Відкрийте меню ⋮ у верхньому правому куті.',
      'Виберіть «Установити застосунок» (або «Додати на головний екран»).',
      'Підтвердьте: іконка з’явиться серед ваших застосунків.',
    ],
  ],
  [
    'Комп’ютер (Chrome, Edge)',
    [
      'У правій частині адресного рядка натисніть значок встановлення (екран зі стрілкою вниз).',
      'Або відкрийте меню браузера й виберіть «Установити Mealoria».',
      'У Safari на Mac: «Файл» → «Додати в Dock».',
    ],
  ],
] as const

function InstallApp() {
  const [, refresh] = useState(0)
  useEffect(() => onInstallChange(() => refresh((n) => n + 1)), [])

  return (
    <>
      <h2>{t('Встановіть Mealoria як застосунок')}</h2>
      <p>
        {t('Сайт можна додати на головний екран телефона чи в Dock комп’ютера: він відкриватиметься в окремому вікні, як звичайний застосунок, без адресного рядка, і працюватиме швидше.')}
      </p>
      {isInstalled() ? (
        <p className="status">{t('Застосунок уже встановлено на цьому пристрої.')}</p>
      ) : (
        canInstall() && (
          <p>
            <button type="button" className="big add-dish" onClick={() => void promptInstall()}>
              {t('Встановити застосунок')}
            </button>
          </p>
        )
      )}
      <div className="grid">
        {INSTALL_STEPS.map(([title, steps]) => (
          <section key={title} className="card">
            <h3>{t(title)}</h3>
            <ol>
              {steps.map((step) => (
                <li key={step}>{t(step)}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  )
}

const PREVIEW_MEALS = [
  ['Сніданок', 'Сирники з ягодами', 380],
  ['Обід', 'Курячий суп з локшиною', 420],
  ['Вечеря', 'Лосось з овочами', 440],
] as const

/** A live-looking picture of the app for the home page: it floats and leans towards the pointer. */
function HeroPreview() {
  const eaten = 1240
  const goal = 1580
  const ring = 2 * Math.PI * 42
  return (
    <div className="hero-preview tilt" aria-hidden="true">
      <div className="preview-card main">
        <div className="preview-head">
          <strong>{t('Сьогодні')}</strong>
        </div>
        <div className="preview-ring">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="ring-track" />
            <circle cx="50" cy="50" r="42" className="ring-value" strokeDasharray={ring} style={{ ['--ring-to' as string]: `${ring * (1 - eaten / goal)}` }} />
          </svg>
          <div>
            <b>{eaten}</b>
            <small>/ {goal} {t('ккал')}</small>
          </div>
        </div>
        <ul>
          {PREVIEW_MEALS.map(([meal, dish, kcal], i) => (
            <li key={meal} style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
              <small>{t(meal)}</small>
              <span>{t(dish)}</span>
              <em>{kcal}</em>
            </li>
          ))}
        </ul>
      </div>
      <div className="preview-card float-a">
        <strong>{t('Список продуктів')}</strong>
        <span className="tick">✓ {t('Яйця')}</span>
        <span className="tick">✓ {t('Броколі')}</span>
        <span>○ {t('Лосось')}</span>
      </div>
      <div className="preview-card float-b">
        <span className="pulse-dot" />
        {t('Тиждень заплановано')}
      </div>
    </div>
  )
}

export default function Home({ signedIn }: { signedIn: boolean }) {
  usePageMeta(
    t('Mealoria: тижневе меню, калорії та список продуктів'),
    t('Плануйте харчування на тиждень, рахуйте калорії по фото страви за кілька секунд і отримуйте список продуктів автоматично. Безкоштовно, з ШІ-підбором рецептів.'),
  )
  return (
    <div>
      <section className="hero">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="hero-text">
          <h1>
            <span className="shine-text">{t('Тижневе меню без клопоту')}</span>
            <span className="dot">.</span>
          </h1>
          <p className="lead">
            {t('Mealoria допомагає планувати харчування на тиждень: складайте меню в календарі, рахуйте калорії й отримуйте список продуктів автоматично. Для тих, хто готує для себе або невеликої родини.')}
          </p>
          <div className="actions">
            {signedIn ? (
              <Link to="/today">
                <button className="big glow">{t('Відкрити застосунок')}</button>
              </Link>
            ) : (
              <Link to="/auth">
                <button className="big glow">{t('Спробувати безкоштовно')}</button>
              </Link>
            )}
            <Link to="/pricing">{t('Тарифи')}</Link>
          </div>
        </div>
        <HeroPreview />
      </section>

      <section className="photo-spotlight">
        <div className="spot-text">
          <span className="badge paid">{t('Головна фішка')}</span>
          <h2>{t('Калорії по фото за секунди')}</h2>
          <p className="muted">
            {t('Сфотографуйте тарілку: ШІ впізнає страву, оцінить калорії, білки, жири, вуглеводи та інгредієнти. Одним дотиком збережіть її у свої страви й додайте в меню.')}
          </p>
          <Link to={signedIn ? '/photo' : '/auth'}>
            <button className="big glow">{t('Спробувати калорії по фото')}</button>
          </Link>
        </div>
        <div className="spot-visual tilt" aria-hidden="true">
          <div className="spot-photo">
            <span className="plate">🥗</span>
            <span className="scan-line" />
          </div>
          <div className="spot-chip c1">{t('Грецький салат')}</div>
          <div className="spot-chip c2">
            <b>260</b> {t('ккал')}
          </div>
          <div className="spot-chip c3">{t('Б 6 · Ж 21 · В 12')}</div>
        </div>
      </section>

      <h2>{t('Як це працює')}</h2>
      <div className="grid">
        {STEPS.map(([n, title, text]) => (
          <section key={n} className="card tilt step-card">
            <span className="step-num" aria-hidden="true">{n}</span>
            <span className="badge">{t('Крок {n}', { n })}</span>
            <h3 style={{ marginTop: 10 }}>{t(title)}</h3>
            <p className="muted">{t(text)}</p>
          </section>
        ))}
      </div>

      <h2>{t('Що всередині')}</h2>
      <div className="grid bento">
        {FEATURES.map(([title, text]) => (
          <section key={title} className="card red tilt">
            <h3>{t(title)}</h3>
            <p className="muted">{t(text)}</p>
          </section>
        ))}
      </div>

      <InstallApp />

      <h2>{t('Безкоштовно та преміум')}</h2>
      <p>
        {t('Планування, свої страви, каталог рецептів і список продуктів безкоштовні. Розумний помічник на штучному інтелекті (підбір рецептів за вашим профілем і з того, що є в холодильнику, калорії по фото) доступний безкоштовно з денним лімітом, а для більшого ліміту готуємо преміум.')}{' '}
        <Link to="/pricing">{t('Докладніше про тарифи')}</Link>
      </p>

      <footer className="site-footer">
        <Link to="/pricing">{t('Тарифи')}</Link> · <Link to="/support">{t('Підтримати проєкт')}</Link>
        {!signedIn && (
          <>
            {' '}
            · <Link to="/auth">{t('Увійти')}</Link>
          </>
        )}
        <br />
        <Link to="/terms">{t('Умови')}</Link> · <Link to="/privacy">{t('Конфіденційність')}</Link>
        <br />
        {t('Питання й відгуки:')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </footer>
    </div>
  )
}

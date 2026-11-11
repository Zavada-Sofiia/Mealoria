import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../config'
import { t } from '../i18n'

const STEPS = [
  ['1', 'Розкажіть про себе', 'Вік, зріст, вага, мета й вподобання. Ми порахуємо ваш калораж і врахуємо дієту та алергії.'],
  ['2', 'Складіть меню на тиждень', 'Додайте свої страви або візьміть готові з каталогу й перетягніть їх у календар.'],
  ['3', 'Купуйте за списком', 'Список продуктів збереться з календаря сам. Те, що вже є вдома, відніметься.'],
]
const FEATURES = [
  ['Календар на тиждень', 'Перетягуйте страви на потрібний день мишею чи пальцем. Калорії за день видно під кожною колонкою.'],
  ['Мої страви й рецепти', 'Власні страви з рецептом та інгредієнтами або готові з каталогу, відфільтровані за вашими вподобаннями.'],
  ['Список продуктів', 'Інгредієнти однакових страв сумуються, куплене можна відзначати.'],
  ['Калорії', 'Порівняння з вашою ціллю на день і калькулятор страви за базою продуктів.'],
  ['ШІ-помічник', 'Підбирає рецепти під ваш профіль і оцінює калорії страви по фото.'],
]

export default function Home({ signedIn }: { signedIn: boolean }) {
  return (
    <div>
      <section className="hero">
        <h1>
          {t('Тижневе меню без клопоту')}<span className="dot">.</span>
        </h1>
        <p className="lead">
          {t('Mealoria допомагає планувати харчування на тиждень: складайте меню в календарі, рахуйте калорії й отримуйте список продуктів автоматично. Для тих, хто готує для себе або невеликої родини.')}
        </p>
        <div className="actions">
          {signedIn ? (
            <Link to="/today">
              <button className="big">{t('Відкрити застосунок')}</button>
            </Link>
          ) : (
            <Link to="/auth">
              <button className="big">{t('Спробувати безкоштовно')}</button>
            </Link>
          )}
          <Link to="/pricing">{t('Тарифи')}</Link>
        </div>
      </section>

      <h2>{t('Як це працює')}</h2>
      <div className="grid">
        {STEPS.map(([n, title, text]) => (
          <section key={n} className="card">
            <span className="badge">{t('Крок {n}', { n })}</span>
            <h3 style={{ marginTop: 10 }}>{t(title)}</h3>
            <p className="muted">{t(text)}</p>
          </section>
        ))}
      </div>

      <h2>{t('Що всередині')}</h2>
      <div className="grid">
        {FEATURES.map(([title, text]) => (
          <section key={title} className="card red">
            <h3>{t(title)}</h3>
            <p className="muted">{t(text)}</p>
          </section>
        ))}
      </div>

      <h2>{t('Безкоштовно та преміум')}</h2>
      <p>
        {t('Планування, свої страви, каталог рецептів і список продуктів безкоштовні. Розумний помічник на штучному інтелекті (підбір рецептів за вашим профілем, калорії по фото) доступний безкоштовно з денним лімітом, а для більшого ліміту готуємо преміум.')}{' '}
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

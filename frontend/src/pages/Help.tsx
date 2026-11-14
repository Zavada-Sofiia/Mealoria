import { useEffect, useMemo, useState, type FormEvent } from 'react'
import StatusLine from '../components/StatusLine'
import { Link, useSearchParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { ApiError, apiFetch } from '../api/client'
import { CONTACT_EMAIL } from '../config'
import { usePageMeta } from '../seo'
import { t } from '../i18n'

type Faq = { q: string; a: string; to?: string; link?: string }

const faqs = (): Faq[] => [
  {
    q: t('З чого почати?'),
    a: t('Заповніть профіль: вік, зріст, вагу, мету, дієту й алергени. Ми порахуємо ваш калораж. Потім на екрані «Сьогодні» натисніть «Заповнити тиждень», і меню складеться саме. Усе можна змінити вручну.'),
    to: '/profile',
    link: t('Відкрити профіль'),
  },
  {
    q: t('Як працює «Заповнити тиждень»?'),
    a: t('Кнопка підбирає страви на кожен прийом їжі під ваш денний калораж, не повторює одну страву два дні поспіль і не чіпає те, що ви вже запланували. Якщо власних страв мало, додає рецепти з каталогу за вашими вподобаннями. Це працює без ШІ.'),
    to: '/calendar',
    link: t('Відкрити календар'),
  },
  {
    q: t('Чим відрізняється безкоштовний тариф від преміум?'),
    a: t('Безкоштовний тариф має ліміти на кількість власних страв, запитів до ШІ за добу та днів наперед у календарі. У преміумі ліміти більші, а ШІ ще й сам рахує калорії та пише рецепти за назвою страви. Точні числа показано на сторінці тарифів.'),
    to: '/pricing',
    link: t('Тарифи'),
  },
  {
    q: t('Як оплатити преміум?'),
    a: t('На сторінці тарифів оберіть період і натисніть «Оплатити». Ми покажемо картку й особистий код замовлення. Переведіть суму на картку й обов’язково впишіть код у коментар. Преміум активується сам за хвилину-дві й додається до того, що у вас уже є. Якщо забули код у коментарі, напишіть нам, і ми підтвердимо оплату вручну.'),
    to: '/pricing',
    link: t('Тарифи'),
  },
  {
    q: t('Де ввести промокод?'),
    a: t('На сторінці тарифів у блоці «Маєте промокод?». Преміум активується на вказану кількість днів і додається до вашого терміну.'),
    to: '/pricing',
    link: t('Тарифи'),
  },
  {
    q: t('Скільки калорій мені потрібно?'),
    a: t('Ми рахуємо за формулою Міффліна й Сан-Жеора з урахуванням активності та мети. У профілі можна вказати власний калораж, якщо вам радив інший лікар чи дієтолог. Це орієнтир, а не медична порада.'),
    to: '/profile',
    link: t('Відкрити профіль'),
  },
  {
    q: t('Що означає «ШІ зараз перевантажений»?'),
    a: t('Безкоштовні ресурси, на яких працює ШІ, мають денні обмеження. Коли їх багато використано, запит може не пройти. Спробуйте за кілька хвилин або пізніше. Такий запит із вашого ліміту не списується.'),
  },
  {
    q: t('Як установити Mealoria на телефон?'),
    a: t('На iPhone відкрийте сайт у Safari, натисніть «Поділитися» і «На початковий екран». На Android у Chrome відкрийте меню й оберіть «Установити застосунок». Після цього Mealoria відкривається як звичайна програма.'),
  },
  {
    q: t('Як змінити мову, одиниці чи формат дати?'),
    a: t('У профілі натисніть «Налаштування». Там мова, тема, метричні або імперські одиниці, кілоджоулі замість калорій і формат дати.'),
    to: '/settings',
    link: t('Налаштування'),
  },
  {
    q: t('Я забув(ла) пароль'),
    a: t('На сторінці входу натисніть «Забули пароль?» і введіть пошту. Ми надішлемо лист із посиланням для нового пароля. Якщо листа немає, зазирніть у «Спам».'),
    to: '/auth',
    link: t('Вхід'),
  },
  {
    q: t('Як видалити акаунт і дані?'),
    a: t('У профілі внизу натисніть «Видалити акаунт». Буде видалено всі ваші дані: профіль, страви, меню, список продуктів і журнал ваги. Це не можна скасувати.'),
    to: '/profile',
    link: t('Відкрити профіль'),
  },
  {
    q: t('Що ви робите з моїми даними?'),
    a: t('Дані про здоров’я ми використовуємо лише для розрахунків і підбору рецептів і не передаємо третім особам для реклами. Докладно описано в політиці конфіденційності.'),
    to: '/privacy',
    link: t('Конфіденційність'),
  },
]

const CATEGORIES = [
  ['bug', 'Щось не працює'],
  ['idea', 'Ідея чи побажання'],
  ['question', 'Питання'],
  ['other', 'Інше'],
] as const

const MIN = 10
const MAX = 2000

function FeedbackForm() {
  const [params] = useSearchParams()
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('bug')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)
  const length = message.trim().length

  async function send(e: FormEvent) {
    e.preventDefault()
    if (length < MIN || busy) return
    setBusy(true)
    setStatus('')
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim(), page: params.get('from') ?? '' }),
      })
      setSent(true)
      setMessage('')
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : ''
      setStatus(
        detail === 'feedback_too_many'
          ? t('Сьогодні ви вже надіслали кілька повідомлень. Спробуйте завтра або напишіть нам на пошту.')
          : detail === 'feedback_too_short'
            ? t('Опишіть трохи докладніше, щонайменше {n} символів.', { n: MIN })
            : t('Не вдалося надіслати. Спробуйте ще раз або напишіть нам на пошту.'),
      )
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div>
        <p className="status">{t('Дякуємо! Ми прочитаємо ваше повідомлення.')}</p>
        <button type="button" onClick={() => setSent(false)}>{t('Надіслати ще одне')}</button>
      </div>
    )
  }

  return (
    <form onSubmit={send}>
      <label>
        {t('Про що ви пишете')}
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>{t(label)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('Повідомлення')}
        <textarea value={message} maxLength={MAX} rows={6}
          placeholder={t('Що сталося або що б ви хотіли покращити? Якщо щось не працює, напишіть, на якій сторінці та що ви робили.')}
          onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="muted" style={{ margin: '4px 0 10px' }}>
        <small>{length}/{MAX}</small>
      </p>
      <button type="submit" disabled={busy || length < MIN}>
        {busy ? t('Надсилаємо…') : t('Надіслати')}
      </button>
      <StatusLine text={status} />
    </form>
  )
}

export default function Help({ session }: { session: Session | null }) {
  usePageMeta(
    t('Допомога Mealoria: часті запитання'),
    t('Відповіді на часті запитання про Mealoria: тарифи й оплата, ШІ, калорії, установка на телефон, пароль і видалення акаунта. Тут же можна написати нам.'),
  )
  const items = useMemo(faqs, [])

  // the questions are also described for search engines
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'faq-jsonld'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
  }, [items])

  return (
    <div className="narrow">
      <h1>{t('Допомога')}</h1>
      <section className="card">
        {items.map((f) => (
          <details key={f.q} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <summary><strong>{f.q}</strong></summary>
            <p style={{ marginTop: 8 }}>{f.a}</p>
            {f.to && <p><Link to={f.to}>{f.link} →</Link></p>}
          </details>
        ))}
      </section>

      <section className="card red" id="feedback">
        <h2 style={{ marginTop: 0 }}>{t('Не знайшли відповідь? Напишіть нам')}</h2>
        {session ? (
          <FeedbackForm />
        ) : (
          <p>
            {t('Щоб надіслати повідомлення, будь ласка, увійдіть.')} <Link to="/auth">{t('Увійти')}</Link>
          </p>
        )}
        <p className="muted" style={{ marginTop: 18 }}>
          {t('Або напишіть на пошту:')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </div>
  )
}

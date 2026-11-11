import { CONTACT_EMAIL } from '../config'

// A public monobank jar link. VITE_DONATION_URL overrides it without a code change.
const DONATION_URL =
  (import.meta.env.VITE_DONATION_URL as string | undefined) || 'https://send.monobank.ua/jar/AeUzaYD5jJ'

export default function Support() {
  return (
    <div className="narrow">
      <h1>Підтримати проєкт</h1>
      <section className="card red">
        <p>
          Mealoria робить невелика команда. Якщо сервіс став вам у пригоді, ви можете підтримати
          його добровільним донатом у будь-якій сумі.
        </p>
        {DONATION_URL ? (
          <a href={DONATION_URL} target="_blank" rel="noreferrer">
            <button className="big">Підтримати</button>
          </a>
        ) : (
          <p className="status">Посилання для донатів скоро з'явиться.</p>
        )}
      </section>
      <p className="muted">
        Питання, ідеї чи знайшли помилку? Напишіть нам:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </div>
  )
}

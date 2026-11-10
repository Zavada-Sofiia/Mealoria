const DONATION_URL = import.meta.env.VITE_DONATION_URL as string | undefined

export default function Support() {
  return (
    <div>
      <h1>Підтримати проєкт</h1>
      <p>
        Mealoria робить невелика команда. Якщо сервіс став вам у пригоді, ви можете підтримати
        його добровільним донатом у будь-якій сумі.
      </p>
      {DONATION_URL ? (
        <p>
          <a href={DONATION_URL} target="_blank" rel="noreferrer">
            <button>Підтримати</button>
          </a>
        </p>
      ) : (
        <p>Посилання для донатів скоро з'явиться.</p>
      )}
    </div>
  )
}

import { Link } from 'react-router-dom'

const FEATURES = [
  ['Календар на тиждень', 'Перетягуйте страви на потрібний день мишею чи пальцем. Калорії за день видно під кожною колонкою.'],
  ['Мої страви й рецепти', 'Додавайте власні страви з рецептом та інгредієнтами або беріть готові з каталогу.'],
  ['Список продуктів', 'Збирається з календаря сам. Те, що вже є вдома, відніметься, а куплене можна відзначати.'],
  ['Калорії та вподобання', 'Калораж за вашими даними й метою. Дієта та алергії враховуються під час вибору рецептів.'],
]

export default function Home() {
  return (
    <div>
      <section className="hero">
        <h1>
          Тижневе меню без клопоту<span className="dot">.</span>
        </h1>
        <p className="lead">
          Плануйте страви в календарі, рахуйте калорії й отримуйте список продуктів автоматично.
          Для тих, хто готує для себе або невеликої родини.
        </p>
        <div className="actions">
          <Link to="/auth">
            <button className="big">Спробувати безкоштовно</button>
          </Link>
          <Link to="/pricing">Тарифи</Link>
        </div>
      </section>

      <div className="grid">
        {FEATURES.map(([title, text]) => (
          <section key={title} className="card red">
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </section>
        ))}
      </div>
    </div>
  )
}

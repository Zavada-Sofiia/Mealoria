import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import DeleteAccount from '../components/DeleteAccount'
import RangeField from '../components/RangeField'
import { estimateCalories } from '../calories'
import { t } from '../i18n'
import { feetInches, heightUnit, isImperial, showHeight, showWeight, storeHeight, storeWeight, weightUnit } from '../units'

type ProfileData = {
  first_name: string
  last_name: string
  sex: 'male' | 'female'
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  activity: 'sedentary' | 'light' | 'moderate' | 'active'
  goal: 'lose' | 'maintain' | 'gain'
  meals_per_day: number
  target_calories: number | null
  diet: string
  allergens: string[]
  cuisines: string[]
  cook_time: string
  budget: string
  preferences: string
  allergies: string
}

type ProfileResponse = { profile: ProfileData | null; recommended_calories: number | null }

const EMPTY: ProfileData = {
  first_name: '',
  last_name: '',
  sex: 'female',
  age: null,
  height_cm: null,
  weight_kg: null,
  activity: 'light',
  goal: 'maintain',
  meals_per_day: 3,
  target_calories: null,
  diet: 'any',
  allergens: [],
  cuisines: [],
  cook_time: 'any',
  budget: 'any',
  preferences: '',
  allergies: '',
}

const DIETS = [
  ['any', 'Їм усе'],
  ['vegetarian', 'Вегетаріанське'],
  ['vegan', 'Веганське'],
  ['pescatarian', 'Пескетаріанське (з рибою)'],
]
const ALLERGENS = [
  ['gluten', 'Глютен'],
  ['lactose', 'Лактоза'],
  ['nuts', 'Горіхи'],
  ['peanuts', 'Арахіс'],
  ['eggs', 'Яйця'],
  ['fish', 'Риба'],
  ['seafood', 'Морепродукти'],
  ['soy', 'Соя'],
  ['sesame', 'Кунжут'],
  ['mustard', 'Гірчиця'],
  ['celery', 'Селера'],
  ['honey', 'Мед'],
  ['citrus', 'Цитрусові'],
  ['berries', 'Ягоди'],
  ['cocoa', 'Какао та шоколад'],
  ['mushrooms', 'Гриби'],
  ['corn', 'Кукурудза'],
  ['legumes', 'Бобові'],
  ['tomatoes', 'Томати'],
]
const CUISINES = [
  ['ukrainian', 'Українська'],
  ['italian', 'Італійська'],
  ['asian', 'Азійська'],
  ['georgian', 'Грузинська'],
  ['mediterranean', 'Середземноморська'],
]
const COOK_TIMES = [
  ['15', 'До 15 хвилин'],
  ['30', 'До 30 хвилин'],
  ['60', 'До години'],
  ['any', 'Не важливо'],
]
const BUDGETS = [
  ['low', 'Економно'],
  ['medium', 'Середній'],
  ['any', 'Не важливо'],
]

function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: string[][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend>{t(legend)}</legend>
      {options.map(([key, label]) => (
        <label key={key}>
          <input type="radio" name={legend} checked={value === key} onChange={() => onChange(key)} />{' '}
          {t(label)}{' '}
        </label>
      ))}
    </fieldset>
  )
}

function Multi({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: string[][]
  value: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <fieldset>
      <legend>{t(legend)}</legend>
      {options.map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value.includes(key)}
            onChange={() =>
              onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])
            }
          />{' '}
          {t(label)}{' '}
        </label>
      ))}
    </fieldset>
  )
}

export default function Profile() {
  const [form, setForm] = useState<ProfileData>(EMPTY)
  const [status, setStatus] = useState(t('Завантаження…'))
  // null = follow the live recommendation; a string = the user's own target
  const [targetText, setTargetText] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<ProfileResponse>('/api/profile')
      .then((r) => {
        if (r.profile) {
          setForm(r.profile)
          setTargetText(r.profile.target_calories ? String(r.profile.target_calories) : null)
        }
        setStatus('')
      })
      .catch(() => setStatus(t('Не вдалося завантажити профіль')))
  }, [])

  function set<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const estimate = estimateCalories(form)
  const recommended = estimate?.recommended ?? null
  const ownTarget = targetText === null || targetText === '' ? null : Number(targetText)
  const customTarget = ownTarget !== null && ownTarget !== recommended

  async function save(e: FormEvent) {
    e.preventDefault()
    if (form.age === null || form.height_cm === null || form.weight_kg === null) {
      setStatus(t('Вкажіть вік, зріст і вагу'))
      return
    }
    if (ownTarget !== null && (ownTarget < 800 || ownTarget > 6000)) {
      setStatus(t('Бажаний калораж має бути від 800 до 6000 ккал'))
      return
    }
    setStatus(t('Зберігаємо…'))
    try {
      await apiFetch<ProfileResponse>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, target_calories: ownTarget }),
      })
      setStatus(t('Збережено'))
    } catch {
      setStatus(t('Не вдалося зберегти'))
    }
  }

  return (
    <>
    <form onSubmit={save}>
      <div className="profile-head">
        <h1>{t('Профіль')}</h1>
        <Link to="/settings">
          <button type="button" className="secondary">⚙ {t('Налаштування')}</button>
        </Link>
      </div>

      <section className="card">
      <h2 style={{ marginTop: 0 }}>{t('Про вас')}</h2>
      <div className="row">
        <label>
          {t("Ім'я")}
          <input value={form.first_name ?? ''} maxLength={60} autoComplete="given-name"
            onChange={(e) => set('first_name', e.target.value)} />
        </label>
        <label>
          {t('Прізвище')}
          <input value={form.last_name ?? ''} maxLength={60} autoComplete="family-name"
            onChange={(e) => set('last_name', e.target.value)} />
        </label>
      </div>
      <label>
        {t('Стать')}
        <select value={form.sex} onChange={(e) => set('sex', e.target.value as ProfileData['sex'])}>
          <option value="female">{t('Жінка')}</option>
          <option value="male">{t('Чоловік')}</option>
        </select>
      </label>
      <RangeField label={t('Вік')} unit={t('років')} min={10} max={100} value={form.age}
        placeholder="—" onChange={(v) => set('age', v)} />
      <RangeField label={t('Зріст')} unit={heightUnit()} min={showHeight(100)} max={showHeight(250)}
        value={form.height_cm === null ? null : showHeight(form.height_cm)}
        placeholder="—" onChange={(v) => set('height_cm', v === null ? null : storeHeight(v))} />
      {isImperial() && form.height_cm !== null && (
        <p className="muted" style={{ margin: '-8px 0 12px' }}>
          <small>{t('≈ {value}', { value: feetInches(form.height_cm) })}</small>
        </p>
      )}
      <RangeField label={t('Вага')} unit={weightUnit()} min={Math.ceil(showWeight(30))} max={Math.floor(showWeight(200))}
        value={form.weight_kg === null ? null : showWeight(form.weight_kg)}
        placeholder="—" decimals onChange={(v) => set('weight_kg', v === null ? null : storeWeight(v))} />
      <label>
        {t('Активність')}
        <select value={form.activity}
          onChange={(e) => set('activity', e.target.value as ProfileData['activity'])}>
          <option value="sedentary">{t('Сидячий спосіб життя')}</option>
          <option value="light">{t('Легка (1–3 тренування на тиждень)')}</option>
          <option value="moderate">{t('Помірна (3–5 тренувань)')}</option>
          <option value="active">{t('Висока (6–7 тренувань)')}</option>
        </select>
      </label>
      <label>
        {t('Мета')}
        <select value={form.goal} onChange={(e) => set('goal', e.target.value as ProfileData['goal'])}>
          <option value="lose">{t('Схуднути')}</option>
          <option value="maintain">{t('Підтримувати вагу')}</option>
          <option value="gain">{t('Набрати вагу')}</option>
        </select>
      </label>
      <RangeField label={t('Прийомів їжі на день')} unit={t('разів')} min={1} max={8}
        value={form.meals_per_day}
        onChange={(v) => set('meals_per_day', v ?? 3)} />
      <div className="calc">
        {estimate ? (
          <>
            <div className="calc-main">
              <span className="calc-num">{ownTarget ?? estimate.recommended}</span>
              <span>{t('ккал на добу')}{customTarget ? t(' (ваша ціль)') : ''}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {t('Рекомендовано {rec} ккал: базовий обмін {bmr} ккал × активність {act} = {tdee} ккал{goal}. Розрахунок за формулою Міффліна–Сан-Жеора.', {
                rec: estimate.recommended,
                bmr: estimate.bmr,
                act: estimate.activityFactor,
                tdee: estimate.tdee,
                goal: estimate.goalFactor !== 1 ? t(', мета ×{n}', { n: estimate.goalFactor }) : '',
              })}
            </p>
            {customTarget && (
              <button type="button" style={{ marginTop: 10 }}
                onClick={() => setTargetText(null)}>
                {t('Повернути рекомендований ({n})', { n: estimate.recommended })}
              </button>
            )}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            {t('Вкажіть вік, зріст і вагу, і ми одразу порахуємо вашу норму калорій.')}
          </p>
        )}
      </div>
      <label>
        {t('Бажаний калораж, ккал на добу')}
        <input type="number" inputMode="numeric" min={800} max={6000}
          className={customTarget ? undefined : 'auto-value'}
          value={targetText ?? (recommended ?? '')}
          placeholder={t('Автоматично')}
          onChange={(e) => setTargetText(e.target.value)}
          onBlur={() => targetText === '' && setTargetText(null)} />
      </label>
      <p className="muted" style={{ marginTop: -6 }}>
        <small>
          {customTarget
            ? t('Це ваша власна ціль. Збережемо саме її.')
            : t('Підставлено автоматично за розрахунком вище і змінюється разом із вашими даними. Змініть число, якщо хочете свою ціль.')}
        </small>
      </p>
      </section>

      <section className="card red">
      <h2 style={{ marginTop: 0 }}>{t('Вподобання')}</h2>
      <Choice legend={t('Тип харчування')} options={DIETS} value={form.diet}
        onChange={(v) => set('diet', v)} />
      <Multi legend={t('Алергії та непереносимість')} options={ALLERGENS} value={form.allergens}
        onChange={(v) => set('allergens', v)} />
      <Multi legend={t('Улюблені кухні')} options={CUISINES} value={form.cuisines}
        onChange={(v) => set('cuisines', v)} />
      <Choice legend={t('Скільки часу готуєте')} options={COOK_TIMES} value={form.cook_time}
        onChange={(v) => set('cook_time', v)} />
      <Choice legend={t('Бюджет')} options={BUDGETS} value={form.budget}
        onChange={(v) => set('budget', v)} />
      <label>
        {t('Що не любите чи не їсте')}
        <textarea maxLength={1000} value={form.preferences}
          onChange={(e) => set('preferences', e.target.value)} />
      </label>
      <label>
        {t('Інші алергії')}
        <textarea maxLength={1000} value={form.allergies}
          onChange={(e) => set('allergies', e.target.value)} />
      </label>

      </section>

      <div className="actions">
      <button type="submit" className="big">{t('Зберегти')}</button>
      </div>
      {status && <p className="status" style={{ marginTop: 16 }}>{status}</p>}
      <p style={{ marginTop: 16 }}>
        <Link to="/pricing">{t('Тариф і оплата')}</Link> · <Link to="/support">{t('Підтримати проєкт')}</Link>
      </p>
    </form>
    <DeleteAccount />
    </>
  )
}

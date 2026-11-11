import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlan } from '../plan/context'

/** Shown whenever the server refuses something because of the free plan's limits. */
export default function PlanLimitBanner() {
  const { me, table } = usePlan()
  const [reason, setReason] = useState<string | null>(null)

  useEffect(() => {
    const onLimit = (e: Event) => setReason((e as CustomEvent<string>).detail)
    window.addEventListener('plan-limit', onLimit)
    return () => window.removeEventListener('plan-limit', onLimit)
  }, [])

  if (!reason) return null
  const free = table?.free
  const text =
    reason === 'plan_limit:dishes'
      ? `Досягнуто ліміт безкоштовного тарифу${free ? `: ${free.dishes} власних страв` : ''}. Видаліть зайві страви або перейдіть на преміум.`
      : reason === 'plan_limit:plan_days'
        ? `Безкоштовний тариф дозволяє планувати лише${free ? ` на ${free.plan_days_ahead} днів` : ''} уперед. У преміумі можна планувати на рік.`
        : 'Це обмеження безкоштовного тарифу.'

  return (
    <div className="limit-banner" role="alert">
      <span>{me?.plan === 'free' || !me ? text : 'Досягнуто ліміт вашого тарифу.'}</span>{' '}
      <Link to="/pricing" onClick={() => setReason(null)}>
        Дивитись тарифи
      </Link>
      <button type="button" aria-label="Закрити" onClick={() => setReason(null)}>
        ×
      </button>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlan } from '../plan/context'
import { t } from '../i18n'

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
    reason === 'premium_required'
      ? t('Створення фото страв від ШІ доступне в преміум-тарифі.')
      : reason === 'plan_limit:dishes'
      ? t('Досягнуто ліміт безкоштовного тарифу{limit}. Видаліть зайві страви або перейдіть на преміум.', {
            limit: free ? t(': {n} власних страв', { n: free.dishes }) : '',
          })
      : reason === 'plan_limit:plan_days'
        ? t('Безкоштовний тариф дозволяє планувати лише{days} уперед. У преміумі можна планувати на рік.', {
            days: free ? t(' на {n} днів', { n: free.plan_days_ahead }) : '',
          })
        : t('Це обмеження безкоштовного тарифу.')

  return (
    <div className="limit-banner" role="alert">
      <span>{me?.plan === 'free' || !me ? text : t(t('Досягнуто ліміт вашого тарифу.'))}</span>{' '}
      <Link to="/pricing" onClick={() => setReason(null)}>
        {t('Дивитись тарифи')}
      </Link>
      <button type="button" aria-label={t('Закрити')} onClick={() => setReason(null)}>
        ×
      </button>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from '../api/client'
import { PlanContext, type MyPlan, type PlanTable } from './context'

export default function PlanProvider({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: ReactNode
}) {
  const [me, setMe] = useState<MyPlan | null>(null)
  const [table, setTable] = useState<PlanTable | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    apiFetch<PlanTable>('/api/plans').then(setTable).catch(() => {})
  }, [])

  useEffect(() => {
    if (!signedIn) return
    apiFetch<MyPlan>('/api/plan').then(setMe).catch(() => {})
  }, [signedIn, version])

  return (
    <PlanContext.Provider
      value={{ me: signedIn ? me : null, table, refresh: () => setVersion((v) => v + 1) }}
    >
      {children}
    </PlanContext.Provider>
  )
}

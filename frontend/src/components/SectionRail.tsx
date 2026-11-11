import { useEffect, useState, type CSSProperties } from 'react'
import { t } from '../i18n'

export type RailItem = { id: string; label: string }

/** Tabs that stay under the header: the highlighted one is the block you are on, a tap jumps to another block. */
export default function SectionRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')

  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)
        const first = items.find((i) => seen.get(i.id))
        if (first) setActive(first.id)
      },
      // a block counts as current while it crosses the middle band of the screen
      { rootMargin: '-30% 0px -60% 0px' },
    )
    for (const i of items) {
      const el = document.getElementById(i.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  const index = Math.max(0, items.findIndex((i) => i.id === active))

  return (
    <nav className="section-tabs" aria-label={t('Блоки сторінки')}>
      <span
        className="section-tabs-thumb"
        aria-hidden="true"
        style={{ '--n': items.length, transform: `translateX(${index * 100}%)` } as CSSProperties}
      />
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          className={i.id === active ? 'on' : ''}
          aria-current={i.id === active ? 'true' : undefined}
          onClick={() => go(i.id)}
        >
          {t(i.label)}
        </button>
      ))}
    </nav>
  )
}

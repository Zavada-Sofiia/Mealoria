import { useEffect, useState } from 'react'
import { t } from '../i18n'

export type RailItem = { id: string; label: string }

/** A slider on the right edge of the page: shows which block you are on and jumps to another one. */
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
      { rootMargin: '-35% 0px -55% 0px' },
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

  return (
    <nav className="rail" aria-label={t('Блоки сторінки')}>
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          className={i.id === active ? 'on' : ''}
          aria-current={i.id === active ? 'true' : undefined}
          aria-label={t(i.label)}
          onClick={() => go(i.id)}
        >
          <span>{t(i.label)}</span>
        </button>
      ))}
    </nav>
  )
}

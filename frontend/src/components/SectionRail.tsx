import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../i18n'

export type RailItem = { id: string; label: string }

/** Tabs that stay under the header: the highlighted one is the block you are on, a tap jumps to another block. */
export default function SectionRail({ items, side = false }: { items: RailItem[]; side?: boolean }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const [thumb, setThumb] = useState({ left: 4, width: 0 })
  const bar = useRef<HTMLElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

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
    // a short last block never reaches the middle band: at the very bottom it is the current one
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        setActive(items[items.length - 1].id)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [items])

  // the indicator follows the active tab, and the tab bar scrolls so that tab stays in view
  useLayoutEffect(() => {
    const el = buttons.current.get(active)
    const container = bar.current
    if (!el || !container) return
    setThumb({ left: el.offsetLeft, width: el.offsetWidth })
    const target = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [active, items])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <>
    <nav className={`section-tabs${side ? ' has-side' : ''}`} aria-label={t('Блоки сторінки')} ref={bar}>
      <span
        className="section-tabs-thumb"
        aria-hidden="true"
        style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
      />
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          ref={(el) => {
            if (el) buttons.current.set(i.id, el)
          }}
          className={i.id === active ? 'on' : ''}
          aria-current={i.id === active ? 'true' : undefined}
          onClick={() => go(i.id)}
        >
          {t(i.label)}
        </button>
      ))}
    </nav>
    {side && (
      <nav className="side-rail" aria-label={t('Блоки сторінки')}>
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
    )}
    </>
  )
}

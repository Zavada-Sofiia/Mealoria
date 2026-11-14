// Small visual effects. All of them stay off for people who asked for less motion.
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A soft ripple from the point of the press on any button. */
function ripple(e: PointerEvent) {
  const button = (e.target as Element | null)?.closest?.('button')
  if (!button || (button as HTMLButtonElement).disabled || button.classList.contains('star')) return
  const box = button.getBoundingClientRect()
  const size = Math.max(box.width, box.height) * 2
  const dot = document.createElement('span')
  dot.className = 'ripple'
  dot.style.width = dot.style.height = `${size}px`
  dot.style.left = `${e.clientX - box.left - size / 2}px`
  dot.style.top = `${e.clientY - box.top - size / 2}px`
  button.appendChild(dot)
  dot.addEventListener('animationend', () => dot.remove(), { once: true })
}

/** A light follows the pointer over cards (desktop only). */
function spotlight(e: PointerEvent) {
  const card = (e.target as Element | null)?.closest?.<HTMLElement>('ul.cards > li, .grid > .card, .preview-card')
  if (!card) return
  const box = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - box.left}px`)
  card.style.setProperty('--my', `${e.clientY - box.top}px`)
}

/** Cards marked .tilt lean towards the pointer, as if they were a sheet of glass. */
let tilted: HTMLElement | null = null
function tilt(e: PointerEvent) {
  const card = (e.target as Element | null)?.closest?.<HTMLElement>('.tilt') ?? null
  if (tilted && tilted !== card) {
    tilted.style.removeProperty('--rx')
    tilted.style.removeProperty('--ry')
  }
  tilted = card
  if (!card) return
  const box = card.getBoundingClientRect()
  const x = (e.clientX - box.left) / box.width - 0.5
  const y = (e.clientY - box.top) / box.height - 0.5
  const strength = card.classList.contains('hero-preview') ? 10 : 5
  card.style.setProperty('--rx', `${(-y * strength).toFixed(2)}deg`)
  card.style.setProperty('--ry', `${(x * strength).toFixed(2)}deg`)
}

export function initEffects() {
  if (calm()) return
  document.addEventListener('pointerdown', ripple, { passive: true })
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', spotlight, { passive: true })
    document.addEventListener('pointermove', tilt, { passive: true })
  }
}

/** A short burst of confetti, for a finished week. */
export function confetti() {
  if (calm()) return
  const colors = ['var(--teal)', 'var(--red)', '#2c9ba8', 'var(--ink)']
  const layer = document.createElement('div')
  layer.className = 'confetti'
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 46; i++) {
    const bit = document.createElement('i')
    bit.style.left = `${Math.random() * 100}%`
    bit.style.background = colors[i % colors.length]
    bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`)
    bit.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`)
    bit.style.animationDelay = `${Math.random() * 0.25}s`
    bit.style.animationDuration = `${1.3 + Math.random() * 0.9}s`
    layer.appendChild(bit)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 2800)
}

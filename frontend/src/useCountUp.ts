import { useEffect, useRef, useState } from 'react'

/** A number that glides to its new value; with "reduce motion" it just jumps. */
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    const begin = from.current
    let frame = 0
    const step = (now: number) => {
      const k = still ? 1 : Math.min(1, (now - start) / ms)
      const v = begin + (target - begin) * (1 - Math.pow(1 - k, 3))
      from.current = v
      setValue(v)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])
  return value
}

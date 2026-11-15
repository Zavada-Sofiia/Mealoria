/**
 * A progress bar. It looks like the old <progress>, but its moving fill is animated with transform, which the
 * GPU does, so the page is not repainted 60 times a second.
 */
export default function Meter({ value, max, over = false, water = false }: { value: number; max: number; over?: boolean; water?: boolean }) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <div
      className={`meter${over ? ' over' : ''}${water ? ' water' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(Math.min(value, max))}
    >
      <span style={{ width: `${share * 100}%` }} />
    </div>
  )
}

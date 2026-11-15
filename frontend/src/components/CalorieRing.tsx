import { useCountUp } from '../useCountUp'

/** Eaten against the goal as a ring that fills up; the arc turns red once the goal is passed. */
export default function CalorieRing({ value: target, goal, unit }: { value: number; goal: number; unit: string }) {
  // the glide lives here, so each frame re-renders only the ring
  const value = useCountUp(target)
  const r = 42
  const length = 2 * Math.PI * r
  const share = goal > 0 ? Math.min(value / goal, 1) : 0
  return (
    <div className={`calorie-ring${value > goal ? ' over' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle cx="50" cy="50" r={r} className="ring-arc" strokeDasharray={length} strokeDashoffset={length * (1 - share)} />
      </svg>
      <div className="ring-center">
        <b>{Math.round(value)}</b>
        <small>
          / {goal} {unit}
        </small>
      </div>
    </div>
  )
}

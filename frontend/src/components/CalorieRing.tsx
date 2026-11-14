/** Eaten against the goal as a ring; the arc turns red once the goal is passed. */
export default function CalorieRing({ value, goal, label, unit }: { value: number; goal: number; label: string; unit: string }) {
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
        <b>{label}</b>
        <small>
          / {goal} {unit}
        </small>
      </div>
    </div>
  )
}

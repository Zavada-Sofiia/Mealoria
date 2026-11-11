import { t } from '../i18n'

type Bar = { label: string; value: number }

const W = 320
const H = 150
const PAD = { l: 34, r: 8, t: 10, b: 22 }

const niceMax = (v: number) => {
  const step = v > 1000 ? 500 : v > 200 ? 100 : 10
  return Math.max(step, Math.ceil(v / step) * step)
}

/** Daily bars with an optional dashed target line. */
export function BarChart({ bars, target }: { bars: Bar[]; target?: number | null }) {
  const max = niceMax(Math.max(1, target ?? 0, ...bars.map((b) => b.value)))
  const w = (W - PAD.l - PAD.r) / bars.length
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max)
  const every = Math.ceil(bars.length / 7)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Калорії за днями')}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} className="chart-grid" />
          <text x={PAD.l - 4} y={y(max * f) + 3} textAnchor="end" className="chart-text">
            {Math.round(max * f)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const over = target != null && b.value > target
        return (
          <g key={i}>
            <rect
              x={PAD.l + i * w + w * 0.15}
              y={y(b.value)}
              width={w * 0.7}
              height={Math.max(0, H - PAD.b - y(b.value))}
              rx={2}
              className={over ? 'chart-bar over' : 'chart-bar'}
            >
              <title>{`${b.label}: ${b.value}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={PAD.l + i * w + w / 2} y={H - 6} textAnchor="middle" className="chart-text">
                {b.label}
              </text>
            )}
          </g>
        )
      })}
      {target != null && (
        <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className="chart-target" />
      )}
    </svg>
  )
}

/** A line through the points that have a value. */
export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const values = points.map((p) => p.value)
  const lo = Math.floor(Math.min(...values) - 1)
  const hi = Math.ceil(Math.max(...values) + 1)
  const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * (points.length === 1 ? 0.5 : i / (points.length - 1)))
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo))
  const every = Math.ceil(points.length / 5)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('Вага в часі')}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="chart-text">
            {Math.round(v * 10) / 10}
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        className="chart-line"
        points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={3} className="chart-dot">
            <title>{`${p.label}: ${p.value} ${t('кг')}`}</title>
          </circle>
          {i % every === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" className="chart-text">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

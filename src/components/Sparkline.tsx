'use client'
type Point = { weekStart: string; seconds: number }

/**
 * Compact 8-week trend line. The final point (current week) is emphasised with a dot.
 * Purely decorative reinforcement of the week-over-week delta — labelled for AT.
 */
export function Sparkline({ data, width = 240, height = 44, className }: { data: Point[]; width?: number; height?: number; className?: string }) {
  if (data.length < 2) return null
  const hours = data.map(d => d.seconds / 3600)
  const max = Math.max(...hours, 0.1)
  const pad = 4
  const w = width - pad * 2
  const h = height - pad * 2
  const x = (i: number) => pad + (i / (data.length - 1)) * w
  const y = (v: number) => pad + h - (v / max) * h

  const line = hours.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(hours.length - 1).toFixed(1)} ${pad + h} L ${x(0).toFixed(1)} ${pad + h} Z`
  const lastX = x(hours.length - 1)
  const lastY = y(hours[hours.length - 1])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      fill="none" role="img"
      aria-label={`Eight-week focus trend, ending at ${hours[hours.length - 1].toFixed(1)} hours`}
      className={`block h-auto w-full ${className ?? ''}`}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(232,176,75,0.22)" />
          <stop offset="100%" stopColor="rgba(232,176,75,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.6" fill="var(--amber-bright)" />
      <circle cx={lastX} cy={lastY} r="5" fill="none" stroke="var(--amber-bright)" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  )
}

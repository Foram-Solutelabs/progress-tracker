'use client'

const DAY_MS = 86_400_000

export function WeekPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const shift = (deltaWeeks: number) => {
    const d = new Date(value + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + deltaWeeks * 7)
    onChange(d.toISOString().split('T')[0])
  }

  const start = new Date(value + 'T00:00:00Z')
  const week = getISOWeek(start)
  const isCurrentOrFuture = start.getTime() >= mondayOf(new Date()).getTime()

  return (
    <div className="stepper" role="group" aria-label="Select week">
      <button type="button" onClick={() => shift(-1)} aria-label="Previous week">
        <Chevron dir="left" />
      </button>
      <span className="stepper__label" aria-live="polite">
        Week {String(week).padStart(2, '0')} · {start.getUTCFullYear()}
      </span>
      <button type="button" onClick={() => shift(1)} disabled={isCurrentOrFuture} aria-label="Next week">
        <Chevron dir="right" />
      </button>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function mondayOf(d: Date): Date {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = r.getUTCDay()
  r.setUTCDate(r.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return r
}
function getISOWeek(d: Date): number {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  r.setUTCDate(r.getUTCDate() + 4 - (r.getUTCDay() || 7))
  return Math.ceil(((r.getTime() - new Date(Date.UTC(r.getUTCFullYear(), 0, 1)).getTime()) / DAY_MS + 1) / 7)
}

'use client'
type Day = { date: string; seconds: number }
export function WeeklyChart({ days }: { days: Day[] }) {
  const max = Math.max(...days.map(d => d.seconds), 1)
  const letters = days.map(d => new Date(d.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short' })[0])
  return (
    <div>
      <div className="flex items-end gap-2.5 h-40 border-b border-line-strong">
        {days.map(day => {
          const h = (day.seconds / max) * 100
          const hasData = day.seconds > 0
          return (
            <div key={day.date} className="group flex flex-1 flex-col items-center justify-end h-full gap-2">
              <span className="font-mono text-[0.62rem] tabular text-faint transition-colors group-hover:text-amber-bright">
                {hasData ? `${(day.seconds / 3600).toFixed(1)}h` : ''}
              </span>
              <div
                className="w-full rounded-t-[3px] transition-all duration-300 group-hover:brightness-110"
                style={{
                  height: `${Math.max(h, hasData ? 4 : 0)}%`,
                  background: hasData ? 'linear-gradient(180deg, var(--amber-bright), var(--amber-deep))' : 'transparent',
                  boxShadow: hasData ? '0 0 18px -4px rgba(232,176,75,0.5)' : 'none',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2.5 mt-2.5">
        {letters.map((l, i) => (
          <span key={i} className="flex-1 text-center font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">{l}</span>
        ))}
      </div>
    </div>
  )
}

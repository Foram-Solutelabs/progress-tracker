'use client'
type Day = { date: string; seconds: number }

const todayISO = () => new Date().toISOString().split('T')[0]

function niceCeil(h: number): number {
  if (h <= 1) return 1
  if (h <= 2) return 2
  if (h <= 5) return 5
  if (h <= 10) return 10
  return Math.ceil(h / 5) * 5
}

export function WeeklyChart({ days }: { days: Day[] }) {
  const maxSeconds = Math.max(...days.map(d => d.seconds), 0)
  const maxHours = maxSeconds / 3600
  const axisMax = niceCeil(maxHours) // hours at the top gridline
  const today = todayISO()
  const fmt = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short' })
  const gridlines = [1, 0.75, 0.5, 0.25] // fractions of axisMax, top → bottom

  return (
    <figure className="m-0" aria-label="Daily focused hours for the selected week">
      <div className="flex gap-3">
        {/* y-axis scale */}
        <div className="relative h-40 w-7 shrink-0">
          {gridlines.map(f => (
            <span
              key={f}
              className="absolute right-0 -translate-y-1/2 font-mono text-[0.6rem] tabular text-faint"
              style={{ top: `${(1 - f) * 100}%` }}
            >
              {(axisMax * f).toFixed(axisMax >= 5 ? 0 : 1)}
            </span>
          ))}
          <span className="absolute bottom-0 right-0 translate-y-1/2 font-mono text-[0.6rem] tabular text-faint">0</span>
        </div>

        {/* plot */}
        <div className="relative h-40 flex-1">
          {/* gridlines */}
          {gridlines.map(f => (
            <div key={f} className="absolute left-0 right-0 h-px bg-line" style={{ top: `${(1 - f) * 100}%` }} />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-px bg-line-strong" />

          {/* bars */}
          <div className="absolute inset-0 flex items-end gap-2.5">
            {days.map(day => {
              const h = axisMax > 0 ? (day.seconds / 3600 / axisMax) * 100 : 0
              const hasData = day.seconds > 0
              const isToday = day.date === today
              return (
                <div key={day.date} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="font-mono text-[0.62rem] tabular text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        style={{ opacity: hasData ? undefined : 0 }}>
                    {hasData ? `${(day.seconds / 3600).toFixed(1)}h` : ''}
                  </span>
                  {/* ghost track — keeps the 7-slot grid legible even on empty days */}
                  <div className="relative flex w-full flex-1 items-end rounded-t-[3px]"
                       style={{ background: 'linear-gradient(180deg, rgba(232,176,75,0.05), transparent 70%)' }}>
                    <div
                      className="w-full rounded-t-[3px] transition-all duration-500 ease-out group-hover:brightness-110"
                      style={{
                        height: `${hasData ? Math.max(h, 3) : 0}%`,
                        background: 'linear-gradient(180deg, var(--amber-bright), var(--amber-deep))',
                        boxShadow: hasData ? '0 0 18px -4px rgba(232,176,75,0.55)' : 'none',
                      }}
                    />
                  </div>
                  {/* today marker */}
                  {isToday && <span className="absolute -bottom-[3px] h-1 w-1 rounded-full bg-amber-bright" aria-hidden />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* weekday labels */}
      <div className="mt-2.5 flex gap-2.5 pl-10">
        {days.map(day => {
          const isToday = day.date === today
          return (
            <span
              key={day.date}
              className={`flex-1 text-center font-mono text-[0.66rem] uppercase tracking-[0.1em] ${isToday ? 'text-amber-bright' : 'text-muted'}`}
            >
              {fmt(day.date)[0]}
            </span>
          )
        })}
      </div>

      {/* accessible data table — visually hidden */}
      <figcaption className="sr-only">
        <table>
          <thead><tr><th>Day</th><th>Hours focused</th></tr></thead>
          <tbody>
            {days.map(d => (
              <tr key={d.date}><td>{fmt(d.date)}</td><td>{(d.seconds / 3600).toFixed(1)} hours</td></tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  )
}

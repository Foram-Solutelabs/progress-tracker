'use client'
type Day = { date: string; seconds: number }
export function WeeklyChart({ days }: { days: Day[] }) {
  const max = Math.max(...days.map(d => d.seconds), 1)
  return (
    <div className="flex items-end gap-2 h-32">
      {days.map(day => {
        const h = (day.seconds / max) * 100
        const label = new Date(day.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'short' })
        return (
          <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-gray-500">{day.seconds > 0 ? `${(day.seconds/3600).toFixed(1)}h` : ''}</span>
            <div className="w-full rounded-t-md bg-indigo-600" style={{ height: `${Math.max(h, day.seconds > 0 ? 4 : 0)}%` }} />
            <span className="text-xs text-gray-400">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { WeeklyChart } from '@/components/WeeklyChart'
import { WeekPicker } from '@/components/WeekPicker'
import type { WeeklyAnalytics } from '@/lib/analytics'

function getThisMonday(): string {
  const d = new Date(), day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day)); d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [data, setData] = useState<WeeklyAnalytics | null>(null)
  useEffect(() => { setData(null); fetch(`/api/analytics/me?weekStart=${weekStart}`).then(r => r.json()).then(setData) }, [weekStart])

  const hours = data ? (data.totalSeconds / 3600) : 0
  const avg = data && data.activeDays > 0 ? data.totalSeconds / data.activeDays / 3600 : 0
  const topMax = Math.max(...(data?.topSites.map(s => s.seconds) ?? [1]), 1)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* header */}
      <header className="reveal d1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="kicker mb-2">Operator log</p>
          <h1 className="font-display text-4xl tracking-tight text-bone">My Learning</h1>
        </div>
        <div className="flex items-center gap-3">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
            className="btn-ghost px-4 py-2 text-xs uppercase tracking-[0.16em]"
          >Sign out</button>
        </div>
      </header>

      <div className="hairline my-8" />

      {/* hero figure */}
      <section className="reveal d2 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="label mb-2">Total focused this week</p>
          <p className="font-display tabular leading-none text-amber-bright" style={{ fontSize: 'clamp(4rem, 14vw, 7rem)' }}>
            {data ? hours.toFixed(1) : '·'}<span className="font-display text-3xl text-muted not-italic"> h</span>
          </p>
        </div>
        <div className="flex gap-10 pb-3">
          <Stat label="Active days" value={data ? String(data.activeDays) : '·'} />
          <Stat label="Avg / active day" value={data ? `${avg.toFixed(1)}h` : '·'} />
        </div>
      </section>

      {/* daily chart */}
      <section className="panel reveal d3 mt-10 p-7">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="label">Daily hours</h2>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-faint">Mon → Sun</span>
        </div>
        {data
          ? <WeeklyChart days={data.dailyBreakdown} />
          : <div className="grid h-44 place-items-center"><div className="aperture" /></div>}
      </section>

      {/* top sites */}
      {data && data.topSites.length > 0 && (
        <section className="panel reveal d4 mt-6 p-7">
          <h2 className="label mb-6">Top sites</h2>
          <ul className="space-y-4">
            {data.topSites.map((s, i) => (
              <li key={s.domain} className="group">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="flex items-baseline gap-3 min-w-0">
                    <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
                    <span className="truncate text-bone">{s.domain}</span>
                  </span>
                  <span className="font-mono tabular text-sm text-amber-bright shrink-0">{(s.seconds / 3600).toFixed(1)}h</span>
                </div>
                <div className="mt-2 h-px w-full bg-line">
                  <div
                    className="h-px transition-all duration-500"
                    style={{ width: `${(s.seconds / topMax) * 100}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-bright))', boxShadow: '0 0 8px rgba(232,176,75,0.5)' }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.totalSeconds === 0 && (
        <p className="reveal d4 mt-10 text-center text-sm text-muted">
          No activity recorded this week. Keep the extension running and your face in view.
        </p>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="font-display tabular text-4xl leading-none text-bone">{value}</p>
      <p className="label mt-2">{label}</p>
    </div>
  )
}

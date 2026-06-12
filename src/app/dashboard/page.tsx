'use client'
import { useEffect, useState } from 'react'
import { WeeklyChart } from '@/components/WeeklyChart'
import { WeekPicker } from '@/components/WeekPicker'
import { Sparkline } from '@/components/Sparkline'
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

  const hours = data ? data.totalSeconds / 3600 : 0
  const avg = data && data.activeDays > 0 ? data.totalSeconds / data.activeDays / 3600 : 0
  const topMax = Math.max(...(data?.topSites.map(s => s.seconds) ?? [1]), 1)

  // week-over-week delta (current week vs the one before, from the trend window)
  const trend = data?.trend ?? []
  const prevSeconds = trend.length >= 2 ? trend[trend.length - 2].seconds : 0
  const deltaSeconds = (data?.totalSeconds ?? 0) - prevSeconds
  const deltaHours = deltaSeconds / 3600

  return (
    <main className="mx-auto w-full max-w-3xl lg:max-w-6xl px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* header */}
      <header className="reveal d1 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker mb-2 flex items-center gap-2.5">
            <span className="live-dot inline-block" aria-hidden />Operator log
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-bone">My Learning</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
            className="btn-ghost whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.16em]"
          >Sign out</button>
        </div>
      </header>

      <div className="hairline my-7 sm:my-8" />

      {!data ? <DashboardSkeleton /> : (
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
          {/* hero — spans main column */}
          <section className="reveal d2 lg:col-span-2 lg:flex lg:flex-col lg:justify-center">
            <p className="label mb-2">Total focused this week</p>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <p className="font-display tabular leading-none text-amber-bright" style={{ fontSize: 'clamp(3.75rem, 13vw, 6.5rem)' }}>
                {hours.toFixed(1)}<span className="font-display text-3xl text-muted not-italic"> h</span>
              </p>
              <div className="mb-2 flex items-center gap-3">
                <DeltaChip deltaHours={deltaHours} hasBaseline={prevSeconds > 0} />
                <span className="font-mono text-[0.72rem] tracking-wide text-faint">vs last week</span>
              </div>
            </div>
          </section>

          {/* instrument panel — stats + trend (sidebar top on lg, under hero on mobile) */}
          <aside className="panel reveal d2 p-5 sm:p-6">
            {trend.length >= 2 && (
              <div className="mb-5">
                <p className="label mb-3">8-week trend</p>
                <Sparkline data={trend} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Stat label="Active days" value={String(data.activeDays)} />
              <Stat label="Avg / day" value={`${avg.toFixed(1)}h`} />
              <Stat label="Presence" value={`${data.facePresencePercent}%`} />
            </div>
          </aside>

          {/* daily chart — spans main column */}
          <section className="panel reveal d3 lg:col-span-2 p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="label">Daily hours</h2>
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-faint">Mon → Sun</span>
            </div>
            <WeeklyChart days={data.dailyBreakdown} />
          </section>

          {/* top sites — sidebar bottom on lg */}
          {data.topSites.length > 0 ? (
            <section className="panel reveal d4 p-5 sm:p-7">
              <h2 className="label mb-6">Top sites</h2>
              <ul className="space-y-5">
                {data.topSites.map((s, i) => {
                  const share = data.totalSeconds > 0 ? Math.round((s.seconds / data.totalSeconds) * 100) : 0
                  return (
                    <li key={s.domain} className="group">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="flex items-baseline gap-3 min-w-0">
                          <span className="font-mono text-xs text-faint tabular">{String(i + 1).padStart(2, '0')}</span>
                          <span className="truncate text-bone transition-colors group-hover:text-amber-bright">{s.domain}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2.5">
                          <span className="font-mono text-xs tabular text-faint">{share}%</span>
                          <span className="font-mono tabular text-sm text-amber-bright">{(s.seconds / 3600).toFixed(1)}h</span>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${(s.seconds / topMax) * 100}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-bright))', boxShadow: '0 0 10px rgba(232,176,75,0.45)' }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : data.totalSeconds === 0 ? (
            <section className="panel reveal d4 grid place-items-center p-8 text-center lg:col-span-1">
              <div>
                <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-line-strong">
                  <span className="live-dot" aria-hidden />
                </div>
                <p className="font-display text-xl text-bone">No focus recorded</p>
                <p className="mt-2 text-sm text-muted">Keep the extension running and your face in view — your hours will appear here.</p>
              </div>
            </section>
          ) : null}

          {/* footer — spans full width */}
          <footer className="reveal d5 mt-6 lg:col-span-3">
            <div className="hairline mb-5" />
            <div className="footer-strip justify-between">
              <span>Focus Instrument · No. 01</span>
              <span className="flex items-center gap-2.5">
                <span className="live-dot" aria-hidden /> Sync live <span className="sep">/</span> v1.0
              </span>
            </div>
          </footer>
        </div>
      )}
    </main>
  )
}

function DeltaChip({ deltaHours, hasBaseline }: { deltaHours: number; hasBaseline: boolean }) {
  if (!hasBaseline && deltaHours > 0) return <span className="delta delta-up">★ First tracked week</span>
  const rounded = Math.round(deltaHours * 10) / 10
  if (rounded === 0) return <span className="delta delta-flat">— No change</span>
  const up = rounded > 0
  return (
    <span className={`delta ${up ? 'delta-up' : 'delta-down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{rounded.toFixed(1)}h
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-display tabular text-3xl sm:text-4xl lg:text-3xl leading-none text-bone">{value}</p>
      <p className="label mt-2">{label}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your week" className="grid gap-5 sm:gap-6 lg:grid-cols-3 lg:items-start">
      <div className="lg:col-span-2 lg:pt-1">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton mt-4 h-24 w-48 max-w-full" />
        <div className="skeleton mt-4 h-6 w-44 rounded-full" />
      </div>
      <div className="panel p-5 sm:p-6">
        <div className="skeleton mb-5 h-10 w-full" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
      </div>
      <div className="panel lg:col-span-2 p-5 sm:p-7"><div className="skeleton h-44 w-full" /></div>
      <div className="panel p-5 sm:p-7 space-y-5">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-6 w-full" />)}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekPicker } from '@/components/WeekPicker'
type UserRow = { userId: string; name: string; analytics: { totalSeconds: number; activeDays: number } }
function getThisMonday(): string {
  const d = new Date(), day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day)); d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// shared column template — keeps the roster header and rows in lockstep
const ROW = 'grid grid-cols-[1.5rem_1fr_5.5rem_2.25rem] sm:grid-cols-[2rem_1fr_9rem_4rem] items-center gap-2 sm:gap-3 px-4 sm:px-6'

export default function AdminPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [users, setUsers] = useState<UserRow[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
    fetch(`/api/analytics/all?weekStart=${weekStart}`).then(r => r.json()).then(d => { setUsers(d.users ?? []); setLoaded(true) })
  }, [weekStart])

  const totalSeconds = users.reduce((s, u) => s + u.analytics.totalSeconds, 0)
  const activeUsers = users.filter(u => u.analytics.totalSeconds > 0).length
  const avgPerActive = activeUsers > 0 ? totalSeconds / 3600 / activeUsers : 0
  const maxSeconds = Math.max(...users.map(u => u.analytics.totalSeconds), 1)
  const ranked = [...users].sort((a, b) => b.analytics.totalSeconds - a.analytics.totalSeconds)

  return (
    <main className="mx-auto w-full max-w-3xl lg:max-w-6xl px-5 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* header */}
      <header className="reveal d1 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker mb-2 flex items-center gap-2.5">
            <span className="live-dot inline-block" aria-hidden />Control room
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-bone">Operator Overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <button onClick={() => router.push('/admin/register')} className="btn-amber whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.14em]">+ Enrol</button>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
            className="btn-ghost whitespace-nowrap px-4 py-3 text-xs uppercase tracking-[0.16em]"
          >Sign out</button>
        </div>
      </header>

      <div className="hairline my-7 sm:my-8" />

      {/* org figures */}
      <section className="reveal d2 grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-line bg-line">
        <Figure value={String(activeUsers)} of={String(users.length)} label="Operators active" />
        <Figure value={(totalSeconds / 3600).toFixed(1)} unit="h" label="Total focused hours" />
        <Figure value={avgPerActive.toFixed(1)} unit="h" label="Avg / active operator" />
      </section>

      {/* roster */}
      <section className="reveal d3 panel mt-5 sm:mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-line">
          <h2 className="label">Operator roster</h2>
          <span className="label">{ranked.length} enrolled</span>
        </div>

        {/* column header */}
        <div className={`${ROW} py-3 border-b border-line`}>
          <span className="label">#</span>
          <span className="label">Operator</span>
          <span className="label text-right">Focused</span>
          <span className="label text-right">Days</span>
        </div>

        {!loaded && (
          <div aria-busy="true" aria-label="Loading roster">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`${ROW} py-4 border-b border-line last:border-0`}>
                <div className="skeleton h-3 w-4" />
                <div className="skeleton h-3.5 w-32 max-w-full" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-6 justify-self-end" />
              </div>
            ))}
          </div>
        )}

        {loaded && ranked.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-muted">No operators enrolled yet.</p>
        )}

        {loaded && ranked.map((u, i) => {
          const h = u.analytics.totalSeconds / 3600
          const active = u.analytics.totalSeconds > 0
          return (
            <div key={u.userId} className={`${ROW} group py-4 border-b border-line transition-colors last:border-0 hover:bg-[rgba(232,176,75,0.04)]`}>
              <span className="font-mono text-xs tabular text-faint">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex items-center gap-3 min-w-0">
                <span className="live-dot shrink-0" style={{ background: active ? 'var(--amber)' : 'var(--faint)', animation: active ? undefined : 'none' }} />
                <span className="truncate text-bone transition-colors group-hover:text-amber-bright">{u.name}</span>
              </span>
              <span className="text-right">
                <span className="font-mono tabular text-sm text-amber-bright">{h.toFixed(1)}h</span>
                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${(u.analytics.totalSeconds / maxSeconds) * 100}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-bright))', boxShadow: active ? '0 0 10px rgba(232,176,75,0.4)' : 'none' }} />
                </span>
              </span>
              <span className="text-right font-mono tabular text-sm text-muted">{u.analytics.activeDays}</span>
            </div>
          )
        })}
      </section>

      {/* footer */}
      <footer className="reveal d4 mt-6">
        <div className="hairline mb-5" />
        <div className="footer-strip justify-between">
          <span>Control Room · No. 01</span>
          <span className="flex items-center gap-2.5">
            <span className="live-dot" aria-hidden /> Sync live <span className="sep">/</span> v1.0
          </span>
        </div>
      </footer>
    </main>
  )
}

function Figure({ value, unit, of, label }: { value: string; unit?: string; of?: string; label: string }) {
  return (
    <div className="bg-surface px-5 sm:px-7 py-6 sm:py-7">
      <p className="font-display tabular leading-none text-bone" style={{ fontSize: 'clamp(2.5rem, 7vw, 3.75rem)' }}>
        {value}
        {unit && <span className="text-2xl text-muted"> {unit}</span>}
        {of && <span className="text-2xl text-faint"> / {of}</span>}
      </p>
      <p className="label mt-3">{label}</p>
    </div>
  )
}

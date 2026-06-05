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
export default function AdminPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [users, setUsers] = useState<UserRow[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setLoaded(false)
    fetch(`/api/analytics/all?weekStart=${weekStart}`).then(r => r.json()).then(d => { setUsers(d.users ?? []); setLoaded(true) })
  }, [weekStart])

  const totalHours = users.reduce((s, u) => s + u.analytics.totalSeconds, 0)
  const activeUsers = users.filter(u => u.analytics.totalSeconds > 0).length
  const maxSeconds = Math.max(...users.map(u => u.analytics.totalSeconds), 1)
  const ranked = [...users].sort((a, b) => b.analytics.totalSeconds - a.analytics.totalSeconds)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* header */}
      <header className="reveal d1 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="kicker mb-2">Control room</p>
          <h1 className="font-display text-4xl tracking-tight text-bone">Operator Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <WeekPicker value={weekStart} onChange={setWeekStart} />
          <button onClick={() => router.push('/admin/register')} className="btn-amber px-4 py-2 text-xs uppercase tracking-[0.14em]">+ Enrol</button>
          <button
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}
            className="btn-ghost px-4 py-2 text-xs uppercase tracking-[0.16em]"
          >Sign out</button>
        </div>
      </header>

      <div className="hairline my-8" />

      {/* org figures */}
      <section className="reveal d2 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line">
        <Figure value={String(activeUsers)} of={String(users.length)} label="Operators active this week" />
        <Figure value={(totalHours / 3600).toFixed(1)} unit="h" label="Total focused hours" />
      </section>

      {/* roster */}
      <section className="reveal d3 panel mt-6 overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_8rem_4rem] items-center gap-3 px-6 py-3.5 border-b border-line">
          <span className="label">#</span>
          <span className="label">Operator</span>
          <span className="label text-right">Focused</span>
          <span className="label text-right">Days</span>
        </div>

        {!loaded && <div className="grid h-32 place-items-center"><div className="aperture" /></div>}

        {loaded && ranked.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted">No operators enrolled yet.</p>
        )}

        {loaded && ranked.map((u, i) => {
          const h = u.analytics.totalSeconds / 3600
          const active = u.analytics.totalSeconds > 0
          return (
            <div key={u.userId} className="group grid grid-cols-[2rem_1fr_8rem_4rem] items-center gap-3 px-6 py-4 border-b border-line transition-colors last:border-0 hover:bg-[rgba(232,176,75,0.04)]">
              <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex items-center gap-3 min-w-0">
                <span className="live-dot shrink-0" style={{ background: active ? 'var(--amber)' : 'var(--faint)', animation: active ? undefined : 'none' }} />
                <span className="truncate text-bone">{u.name}</span>
              </span>
              <span className="text-right">
                <span className="font-mono tabular text-sm text-amber-bright">{h.toFixed(1)}h</span>
                <span className="mt-1.5 block h-px w-full bg-line">
                  <span className="block h-px" style={{ width: `${(u.analytics.totalSeconds / maxSeconds) * 100}%`, background: 'linear-gradient(90deg, var(--amber-deep), var(--amber-bright))' }} />
                </span>
              </span>
              <span className="text-right font-mono tabular text-sm text-muted">{u.analytics.activeDays}</span>
            </div>
          )
        })}
      </section>
    </main>
  )
}

function Figure({ value, unit, of, label }: { value: string; unit?: string; of?: string; label: string }) {
  return (
    <div className="bg-surface px-7 py-7">
      <p className="font-display tabular leading-none text-bone" style={{ fontSize: 'clamp(2.5rem, 7vw, 3.75rem)' }}>
        {value}
        {unit && <span className="text-2xl text-muted"> {unit}</span>}
        {of && <span className="text-2xl text-faint"> / {of}</span>}
      </p>
      <p className="label mt-3">{label}</p>
    </div>
  )
}

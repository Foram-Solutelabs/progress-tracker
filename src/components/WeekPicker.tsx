'use client'
export function WeekPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return <input type="week" value={toWeekInput(value)} onChange={e => onChange(fromWeekInput(e.target.value))} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
}
function toWeekInput(iso: string): string {
  const d = new Date(iso); const y = d.getUTCFullYear()
  return `${y}-W${String(getISOWeek(d)).padStart(2,'0')}`
}
function fromWeekInput(w: string): string {
  const [y, wk] = w.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const start = new Date(jan4.getTime() - ((jan4.getUTCDay()||7)-1)*86400_000)
  return new Date(start.getTime() + (wk-1)*7*86400_000).toISOString().split('T')[0]
}
function getISOWeek(d: Date): number {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  r.setUTCDate(r.getUTCDate()+4-(r.getUTCDay()||7))
  return Math.ceil(((r.getTime()-new Date(Date.UTC(r.getUTCFullYear(),0,1)).getTime())/86400_000+1)/7)
}

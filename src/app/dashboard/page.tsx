'use client'
import { useEffect, useState } from 'react'
import { WeeklyChart } from '@/components/WeeklyChart'
import { WeekPicker } from '@/components/WeekPicker'
import type { WeeklyAnalytics } from '@/lib/analytics'
function getThisMonday(): string {
  const d = new Date(), day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate()+(day===0?-6:1-day)); d.setUTCHours(0,0,0,0)
  return d.toISOString().split('T')[0]
}
export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [data, setData] = useState<WeeklyAnalytics|null>(null)
  useEffect(() => { fetch(`/api/analytics/me?weekStart=${weekStart}`).then(r=>r.json()).then(setData) }, [weekStart])
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">My Learning</h1><WeekPicker value={weekStart} onChange={setWeekStart} /></div>
      <div className="grid grid-cols-3 gap-4">
        {[{label:'Total this week',value:data?`${(data.totalSeconds/3600).toFixed(1)}h`:'—',color:'text-indigo-400'},{label:'Active days',value:data?.activeDays??'—',color:'text-green-400'},{label:'Face present',value:data?`${data.facePresencePercent}%`:'—',color:'text-orange-400'}].map(s=>(
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 text-center"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-gray-500 mt-1">{s.label}</p></div>
        ))}
      </div>
      {data&&<div className="bg-gray-900 rounded-xl p-6 space-y-3"><h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Daily Hours</h2><WeeklyChart days={data.dailyBreakdown}/></div>}
      {data&&data.topSites.length>0&&<div className="bg-gray-900 rounded-xl p-6"><h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Top Sites</h2><div className="space-y-2">{data.topSites.map(s=><div key={s.domain} className="flex justify-between text-sm"><span className="text-gray-300">{s.domain}</span><span className="text-gray-500">{(s.seconds/3600).toFixed(1)}h</span></div>)}</div></div>}
      <div className="text-center"><button className="text-sm text-gray-500 hover:text-gray-300" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login'}}>Sign out</button></div>
    </main>
  )
}

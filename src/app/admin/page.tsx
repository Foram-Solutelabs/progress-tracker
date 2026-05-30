'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekPicker } from '@/components/WeekPicker'
type UserRow = { userId: string; name: string; analytics: { totalSeconds: number; facePresencePercent: number } }
function getThisMonday(): string {
  const d = new Date(), day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate()+(day===0?-6:1-day)); d.setUTCHours(0,0,0,0)
  return d.toISOString().split('T')[0]
}
export default function AdminPage() {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [users, setUsers] = useState<UserRow[]>([])
  useEffect(() => { fetch(`/api/analytics/all?weekStart=${weekStart}`).then(r=>r.json()).then(d=>setUsers(d.users??[])) }, [weekStart])
  const totalHours = users.reduce((s,u)=>s+u.analytics.totalSeconds,0)
  const activeUsers = users.filter(u=>u.analytics.totalSeconds>0).length
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-3"><WeekPicker value={weekStart} onChange={setWeekStart}/><button onClick={()=>router.push('/admin/register')} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">+ Register User</button></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-indigo-400">{activeUsers}</p><p className="text-xs text-gray-500 mt-1">Active users</p></div>
        <div className="bg-gray-900 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-400">{(totalHours/3600).toFixed(1)}h</p><p className="text-xs text-gray-500 mt-1">Total org hours</p></div>
      </div>
      <div className="bg-gray-900 rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-3 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800"><span>Name</span><span className="text-right">Hours</span><span className="text-right">Face %</span></div>
        {users.map(u=><div key={u.userId} className="grid grid-cols-3 px-4 py-3 border-b border-gray-800 hover:bg-gray-800"><span className="font-medium">{u.name}</span><span className="text-right text-indigo-400">{(u.analytics.totalSeconds/3600).toFixed(1)}h</span><span className="text-right text-green-400">{u.analytics.facePresencePercent}%</span></div>)}
      </div>
      <div className="text-center"><button className="text-sm text-gray-500 hover:text-gray-300" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.href='/login'}}>Sign out</button></div>
    </main>
  )
}

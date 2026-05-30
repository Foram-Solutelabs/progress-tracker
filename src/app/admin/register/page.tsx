'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FaceCapture } from '@/components/FaceCapture'
export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState(''), [phone, setPhone] = useState('')
  const [descriptor, setDescriptor] = useState<number[]|null>(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [success, setSuccess] = useState('')
  async function handleSubmit() {
    if (!name||!phone||!descriptor) { setError('Fill all fields and capture the user face.'); return }
    setLoading(true)
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,descriptor})})
    if (res.ok) { setSuccess(`${name} registered.`); setName(''); setPhone(''); setDescriptor(null) }
    else { const d = await res.json(); setError(d.error??'Registration failed') }
    setLoading(false)
  }
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-4"><button onClick={()=>router.push('/admin')} className="text-gray-400 hover:text-white">← Back</button><h1 className="text-2xl font-bold">Register User</h1></div>
      <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>
      <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500" placeholder="Phone number" value={phone} onChange={e=>setPhone(e.target.value)}/>
      <FaceCapture onDescriptor={d=>setDescriptor(d)} label={descriptor?'✓ Face captured':'Capture user face'}/>
      {error&&<p className="text-red-400 text-sm">{error}</p>}
      {success&&<p className="text-green-400 text-sm">{success}</p>}
      <button onClick={handleSubmit} disabled={loading} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium">{loading?'Registering…':'Register User'}</button>
    </main>
  )
}

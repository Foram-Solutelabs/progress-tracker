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
    setLoading(true); setError('')
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,descriptor})})
    if (res.ok) { setSuccess(`${name} enrolled.`); setName(''); setPhone(''); setDescriptor(null) }
    else { const d = await res.json(); setError(d.error??'Registration failed') }
    setLoading(false)
  }
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <button onClick={()=>router.push('/admin')} className="reveal d1 mb-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-amber">
        ← Control room
      </button>

      <header className="reveal d1 mb-9">
        <p className="kicker mb-3">Enrolment</p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-bone">
          Enrol a new<br /><span className="italic text-amber-bright">operator.</span>
        </h1>
        <p className="mt-4 text-sm text-muted">Their face scan becomes their key. Make sure it&apos;s well-lit and unobstructed.</p>
      </header>

      <div className="panel reveal d2 space-y-6 p-7">
        <div>
          <label className="label mb-2 block">Full name</label>
          <input className="field" placeholder="e.g. Saurin Shah" value={name} onChange={e=>setName(e.target.value)}/>
        </div>
        <div>
          <label className="label mb-2 block">Phone number</label>
          <input className="field tabular" placeholder="e.g. 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)}/>
        </div>

        <div className="hairline" />

        <FaceCapture onDescriptor={d=>setDescriptor(d)} label={descriptor?'Face captured':'Capture operator face'}/>

        {error&&<p className="text-sm text-rust">{error}</p>}
        {success&&<p className="flex items-center gap-2 text-sm" style={{color:'var(--sage)'}}><span className="live-dot" style={{background:'var(--sage)'}}/>{success}</p>}

        <button onClick={handleSubmit} disabled={loading} className="btn-amber w-full py-3.5 text-sm">
          {loading?'Enrolling…':'Enrol operator →'}
        </button>
      </div>
    </main>
  )
}

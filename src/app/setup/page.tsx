'use client'

import { useState, useEffect, useRef } from 'react'

export default function SetupPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const faceapiRef = useRef<typeof import('face-api.js') | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [descriptor, setDescriptor] = useState<number[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'captured' | 'error'>('loading')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let stopped = false
    async function init() {
      const faceapi = await import('face-api.js')
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      faceapiRef.current = faceapi

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
      })
      if (stopped || !videoRef.current) return
      videoRef.current.srcObject = stream
      await new Promise<void>(resolve => { videoRef.current!.onloadeddata = () => resolve() })
      await videoRef.current.play()
      if (!stopped) setStatus('ready')
    }
    init().catch(() => {
      setStatus('error')
      setError('Could not start camera or load models. Check browser permissions.')
    })
    return () => {
      stopped = true
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  async function capture() {
    const api = faceapiRef.current
    const video = videoRef.current
    if (!api || !video || video.readyState < 2) return
    setStatus('capturing')
    const detection = await api
      .detectSingleFace(video, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) {
      setStatus('ready')
      setError('No face detected — make sure your face is clearly visible.')
      return
    }
    setError('')
    setDescriptor(Array.from(detection.descriptor))
    setStatus('captured')
  }

  async function handleSubmit() {
    if (!name || !phone || !descriptor) {
      setError('Fill all fields and capture your face.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, descriptor }),
      })
      const data = await res.json()
      if (res.ok) {
        window.location.href = '/admin'
      } else {
        setError(data.error ?? 'Setup failed')
        setLoading(false)
      }
    } catch {
      setError('Server error — is the database running?')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left — editorial intro */}
      <section className="relative hidden lg:flex flex-col justify-between border-r border-line p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/3 h-[420px] w-[420px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(232,176,75,0.14), transparent 65%)' }}
        />
        <p className="kicker reveal d1">Initial calibration</p>
        <div className="reveal d2 max-w-md">
          <h1 className="font-display text-6xl leading-[0.92] tracking-tight text-bone">
            Establish the<br /><span className="italic text-amber-bright">first operator.</span>
          </h1>
          <p className="mt-6 text-muted leading-relaxed">
            This creates the founding <span className="text-bone">admin</span> account. Their face becomes
            the master key — they can then enrol everyone else into the instrument.
          </p>
        </div>
        <ol className="reveal d3 space-y-3">
          {['Enter operator details', 'Register a clear face scan', 'Enter the control room'].map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm text-muted">
              <span className="font-mono text-amber">0{i + 1}</span>
              <span className="hairline w-6" />
              {s}
            </li>
          ))}
        </ol>
      </section>

      {/* Right — form */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-7">
          <div className="reveal d1 lg:hidden">
            <p className="kicker mb-3">Initial calibration</p>
            <h1 className="font-display text-4xl tracking-tight text-bone">First-time setup</h1>
          </div>

          <div className="reveal d2 space-y-4">
            <div>
              <label className="label mb-2 block">Full name</label>
              <input className="field" placeholder="e.g. Manjula Parikh" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label mb-2 block">Phone number</label>
              <input className="field tabular" placeholder="e.g. 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="reveal d3 flex flex-col items-center gap-4">
            <div className="viewfinder w-[320px] max-w-full aspect-[4/3]">
              <video ref={videoRef} autoPlay muted playsInline width={320} height={240} />
              <div className="viewfinder__grid" />
              {(status === 'ready' || status === 'capturing') && <div className="viewfinder__beam" />}
              <span className="tick tick-tl" /><span className="tick tick-tr" />
              <span className="tick tick-bl" /><span className="tick tick-br" />
              {status === 'loading' && (
                <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]"><div className="aperture" /></div>
              )}
              {status === 'captured' && (
                <div className="absolute inset-0 grid place-items-center bg-black/45"><span className="font-display text-5xl" style={{ color: 'var(--sage)' }}>✓</span></div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="live-dot" style={{ background: status === 'captured' ? 'var(--sage)' : 'var(--amber)' }} />
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                {status === 'loading' && 'Loading models…'}
                {status === 'ready' && 'Camera ready — capture face'}
                {status === 'capturing' && 'Detecting face…'}
                {status === 'captured' && 'Face captured'}
                {status === 'error' && 'Camera unavailable'}
              </span>
            </div>
            {status === 'ready' && <button onClick={capture} className="btn-amber px-6 py-2.5 text-sm">Capture face</button>}
            {status === 'captured' && (
              <button onClick={() => { setStatus('ready'); setDescriptor(null) }} className="btn-ghost px-4 py-1.5 text-xs">Retake</button>
            )}
          </div>

          {error && <p className="reveal text-sm text-rust">{error}</p>}

          <button onClick={handleSubmit} disabled={loading || status === 'loading'} className="reveal d4 btn-amber w-full py-3.5 text-sm">
            {loading ? 'Creating admin…' : 'Create admin account →'}
          </button>
        </div>
      </section>
    </main>
  )
}

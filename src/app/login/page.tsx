'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const MODEL_LOAD_TIMEOUT_MS = 15_000 // a blocked/stalled /models fetch hangs forever — fail loudly instead

// Reject if `promise` doesn't settle within `ms`. Without this, an ad/content
// blocker that silently holds the /models requests open leaves loadFromUri
// pending forever and the screen stuck on "Booting sensor".
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export default function LoginPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const faceapiRef = useRef<typeof import('face-api.js') | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'matching' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDescriptor(descriptor: number[]) {
    setStatus('matching')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch('/api/auth/face-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMsg(data.error ?? 'Face not recognised. Try again.')
        setTimeout(() => setStatus('ready'), 2500)
        return
      }
      const { token, user } = await res.json()
      window.postMessage({ type: 'LT_SET_TOKEN', token, userName: user.name }, window.location.origin)
      window.location.href = user.role === 'ADMIN' ? '/admin' : '/dashboard'
    } catch (err) {
      clearTimeout(timeoutId)
      setStatus('error')
      setErrorMsg(
        err instanceof Error && err.name === 'AbortError'
          ? 'Server timeout — is the database running?'
          : 'Connection error. Try again.'
      )
      setTimeout(() => setStatus('ready'), 3000)
    }
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    let stopped = false

    async function init() {
      const faceapi = await import('face-api.js')
      // Independent fetches → load in parallel under one timeout budget.
      await withTimeout(
        Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]),
        MODEL_LOAD_TIMEOUT_MS,
        'models'
      )
      faceapiRef.current = faceapi

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
      })
      if (stopped || !videoRef.current) return
      // Register before setting srcObject — with autoPlay the event can fire before
      // the next microtask if the camera track is already live (e.g. extension in use).
      // onloadedmetadata fires earlier than onloadeddata and is reliable for MediaStreams.
      // Timeout ensures we never hang if Chrome grants the stream but never fires the event.
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(t); resolve() }
        const t = setTimeout(done, 3000) // bail after 3 s — camera is live enough to play
        videoRef.current!.onloadedmetadata = done
        videoRef.current!.srcObject = stream
      })
      await videoRef.current.play().catch(() => { /* autoPlay already started it */ })
      if (stopped) return
      setStatus('ready')

      interval = setInterval(async () => {
        const api = faceapiRef.current
        const video = videoRef.current
        if (!api || !video || video.readyState < 2 || video.paused) return
        const detection = await api
          .detectSingleFace(video, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (detection) {
          clearInterval(interval)
          handleDescriptor(Array.from(detection.descriptor))
        }
      }, 1500)
    }

    init().catch((err: unknown) => {
      setStatus('error')
      setErrorMsg(
        err instanceof Error && err.message.startsWith('timeout:')
          ? 'Timed out loading face models — disable ad/content blockers for localhost and retry.'
          : 'Could not start camera or load models.'
      )
    })

    return () => {
      stopped = true
      clearInterval(interval)
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const readout =
    status === 'loading' ? 'Calibrating optics…'
    : status === 'ready' ? 'Align your face within the frame'
    : status === 'matching' ? 'Verifying identity…'
    : 'Signal lost'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* localized warm glow behind the instrument */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(232,176,75,0.16), transparent 65%)' }}
      />

      <header className="reveal d1 text-center mb-9">
        <p className="kicker mb-4">Focus Instrument · No. 01</p>
        <h1 className="font-display text-[2.7rem] leading-[0.95] tracking-tight text-bone">
          Learning <span className="italic text-amber-bright">Tracker</span>
        </h1>
        <p className="mt-3 text-sm text-muted">Presence-verified sign in — no passwords.</p>
      </header>

      {/* viewfinder */}
      <div className="reveal d2 viewfinder w-[340px] max-w-[88vw] aspect-[4/3]">
        <video ref={videoRef} autoPlay muted playsInline width={320} height={240} />
        <div className="viewfinder__grid" />
        {status === 'ready' && <div className="viewfinder__beam" />}
        <span className="tick tick-tl" /><span className="tick tick-tr" />
        <span className="tick tick-bl" /><span className="tick tick-br" />

        {(status === 'loading' || status === 'matching') && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <div className="aperture" />
              <span className="label !text-amber">{status === 'loading' ? 'Booting sensor' : 'Matching'}</span>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 px-6 text-center">
            <p className="text-sm text-rust">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* readout strip */}
      <div className="reveal d3 mt-7 flex items-center gap-3">
        <span className="live-dot" style={{ background: status === 'error' ? 'var(--rust)' : 'var(--amber)' }} />
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted">{readout}</span>
      </div>

      {status === 'error' && (
        <button
          onClick={() => window.location.reload()}
          className="reveal btn-ghost mt-6 px-5 py-2 text-sm"
        >
          Retry signal
        </button>
      )}

      <p className="reveal d4 absolute bottom-6 label">CAM · 320×240 · SSD-MOBILENET v1</p>
    </main>
  )
}

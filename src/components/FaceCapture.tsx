'use client'
import { useEffect, useRef, useState } from 'react'
interface FaceCaptureProps { onDescriptor: (d: number[]) => void; autoCapture?: boolean; label?: string }
export function FaceCapture({ onDescriptor, autoCapture = false, label }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading'|'ready'|'detecting'|'captured'|'error'>('loading')
  const faceapiRef = useRef<typeof import('face-api.js') | null>(null)
  useEffect(() => {
    async function init() {
      const api = await import('face-api.js')
      await api.nets.ssdMobilenetv1.loadFromUri('/models')
      await api.nets.faceLandmark68Net.loadFromUri('/models')
      await api.nets.faceRecognitionNet.loadFromUri('/models')
      faceapiRef.current = api
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await new Promise<void>(resolve => {
            videoRef.current!.onloadeddata = () => resolve()
          })
          await videoRef.current.play()
          setStatus('ready')
        }
      } catch { setStatus('error') }
    }
    init()
    return () => { if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()) }
  }, [])
  async function detect() {
    const api = faceapiRef.current
    const video = videoRef.current
    if (!api || !video || video.readyState < 2 || video.paused) return null
    const d = await api.detectSingleFace(video, new api.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptor()
    return d ? Array.from(d.descriptor) : null
  }
  async function handleCapture() {
    setStatus('detecting'); const descriptor = await detect()
    if (!descriptor) { setStatus('ready'); return }
    setStatus('captured'); onDescriptor(descriptor)
  }
  useEffect(() => {
    if (!autoCapture || status !== 'ready') return
    const interval = setInterval(async () => { const d = await detect(); if (d) { clearInterval(interval); onDescriptor(d) } }, 1500)
    return () => clearInterval(interval)
  }, [status, autoCapture])
  const statusText = { loading:'Loading face models…', ready: autoCapture ? 'Position your face' : 'Camera ready', detecting:'Detecting…', captured:'Face captured', error:'Camera access denied' }[status]
  const captured = status === 'captured'
  return (
    <div className="flex flex-col items-center gap-4">
      {label && (
        <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: captured ? 'var(--sage)' : 'var(--muted)' }}>
          {label}
        </p>
      )}
      <div className="viewfinder w-[320px] max-w-full aspect-[4/3]">
        <video ref={videoRef} autoPlay muted playsInline width={320} height={240} />
        <div className="viewfinder__grid" />
        {(status === 'ready' || status === 'detecting') && <div className="viewfinder__beam" />}
        <span className="tick tick-tl" /><span className="tick tick-tr" />
        <span className="tick tick-bl" /><span className="tick tick-br" />
        {status === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[2px]">
            <div className="aperture" />
          </div>
        )}
        {captured && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <span className="font-display text-5xl" style={{ color: 'var(--sage)' }}>✓</span>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-black/65 px-4 text-center">
            <span className="text-sm text-rust">Camera access denied</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="live-dot" style={{ background: captured ? 'var(--sage)' : status === 'error' ? 'var(--rust)' : 'var(--amber)' }} />
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted">{statusText}</span>
      </div>
      {!autoCapture && status === 'ready' && (
        <button onClick={handleCapture} className="btn-amber px-6 py-2.5 text-sm">Capture face</button>
      )}
    </div>
  )
}

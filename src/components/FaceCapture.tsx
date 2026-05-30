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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) { videoRef.current.srcObject = stream; setStatus('ready') }
      } catch { setStatus('error') }
    }
    init()
    return () => { if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()) }
  }, [])
  async function detect() {
    const api = faceapiRef.current; if (!api || !videoRef.current) return null
    const d = await api.detectSingleFace(videoRef.current, new api.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptor()
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
  const statusText = { loading:'Loading face models…', ready: autoCapture ? 'Position your face' : 'Camera ready', detecting:'Detecting…', captured:'✓ Face captured', error:'Camera access denied' }[status]
  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-sm text-gray-400">{label}</p>}
      <video ref={videoRef} autoPlay muted playsInline width={320} height={240} className="rounded-xl border border-gray-700 bg-black" />
      <p className="text-sm text-gray-400">{statusText}</p>
      {!autoCapture && status === 'ready' && <button onClick={handleCapture} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Capture Face</button>}
    </div>
  )
}

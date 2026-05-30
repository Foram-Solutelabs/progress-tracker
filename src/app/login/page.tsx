'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'matching' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDescriptor(descriptor: number[]) {
    setStatus('matching')
    const res = await fetch('/api/auth/face-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor }),
    })
    if (!res.ok) {
      setStatus('error')
      setErrorMsg('Face not recognised. Try again.')
      setTimeout(() => setStatus('ready'), 2000)
      return
    }
    const { token, user } = await res.json()
    window.postMessage({ type: 'LT_SET_TOKEN', token, userName: user.name }, window.location.origin)
    router.push(user.role === 'ADMIN' ? '/admin' : '/dashboard')
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    async function init() {
      const faceapi = await import('face-api.js')
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      setStatus('ready')
      interval = setInterval(async () => {
        if (!videoRef.current) return
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor()
        if (detection) {
          clearInterval(interval)
          await handleDescriptor(Array.from(detection.descriptor))
        }
      }, 1500)
    }
    init().catch(() => setStatus('error'))
    return () => {
      clearInterval(interval)
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm w-full px-4">
        <div>
          <h1 className="text-3xl font-bold">Learning Tracker</h1>
          <p className="text-gray-400 mt-2">Look at the camera to sign in</p>
        </div>
        {status !== 'matching' && (
          <video ref={videoRef} autoPlay muted playsInline width={320} height={240}
            className="rounded-xl border border-gray-700 bg-black mx-auto block" />
        )}
        {status === 'loading' && <p className="text-gray-400 text-sm">Loading face models…</p>}
        {status === 'ready' && <p className="text-gray-400 text-sm">Position your face in the camera</p>}
        {status === 'matching' && <div className="py-10 text-indigo-400">Matching face…</div>}
        {status === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    </main>
  )
}

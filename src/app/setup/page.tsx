'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [descriptor, setDescriptor] = useState<number[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'captured'>('loading')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function init() {
      const faceapi = await import('face-api.js')
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStatus('ready')
      }
    }
    init().catch(() => setStatus('ready'))
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  async function capture() {
    if (!videoRef.current) return
    setStatus('capturing')
    const faceapi = await import('face-api.js')
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) { setStatus('ready'); return }
    setDescriptor(Array.from(detection.descriptor))
    setStatus('captured')
  }

  async function handleSubmit() {
    if (!name || !phone || !descriptor) {
      setError('Fill all fields and capture your face.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, descriptor }),
    })
    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Setup failed')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">First-Time Setup</h1>
          <p className="text-gray-400 text-sm mt-1">Create the admin account to get started.</p>
        </div>
        <input
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          placeholder="Full name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500"
          placeholder="Phone number"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <div className="flex flex-col items-center gap-3">
          <video ref={videoRef} autoPlay muted playsInline width={320} height={240}
            className="rounded-xl border border-gray-700 bg-black" />
          <p className="text-sm text-gray-400">
            {status === 'loading' && 'Loading models…'}
            {status === 'ready' && 'Camera ready'}
            {status === 'capturing' && 'Detecting face…'}
            {status === 'captured' && '✓ Face captured'}
          </p>
          {(status === 'ready') && (
            <button onClick={capture}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
              Capture Face
            </button>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium">
          {loading ? 'Creating admin…' : 'Create Admin Account'}
        </button>
      </div>
    </main>
  )
}

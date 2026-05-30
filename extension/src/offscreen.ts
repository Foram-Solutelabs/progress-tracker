import * as faceapi from 'face-api.js'

const VIDEO_ID = 'video'
const MODELS_URL = 'http://localhost:3000/models'
const CHECK_INTERVAL_MS = 5_000

let ready = false

async function init() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL)
  ready = true

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } })
  } catch {
    setInterval(() => chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: false }), CHECK_INTERVAL_MS)
    return
  }

  const video = document.getElementById(VIDEO_ID) as HTMLVideoElement
  video.srcObject = stream

  setInterval(async () => {
    if (!ready) return
    try {
      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      )
      chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: !!detection })
    } catch {
      chrome.runtime.sendMessage({ type: 'FACE_RESULT', present: false })
    }
  }, CHECK_INTERVAL_MS)
}

init()

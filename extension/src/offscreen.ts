import * as faceapi from 'face-api.js'

const VIDEO_ID = 'video'
const MODELS_URL = 'http://localhost:3000/models'
const CHECK_INTERVAL_MS = 5_000

const report = (status: string, detail?: string) =>
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_STATUS', status, detail })
const sendFace = (present: boolean) => chrome.runtime.sendMessage({ type: 'FACE_RESULT', present })

let ready = false

async function init() {
  // 1) Load the detector model from the web app's /models.
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL)
    ready = true
    report('models_ok')
  } catch (e) {
    report('models_failed', (e as Error)?.message ?? String(e))
    return
  }

  // 2) Acquire the camera. A background/offscreen document cannot show the
  //    permission prompt itself, so if this throws the service worker opens a
  //    permission page for us; we report the result so it can react.
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } })
    report('camera_ok')
  } catch (e) {
    report('camera_denied', (e as Error)?.name ?? String(e))
    // Keep emitting "absent" so tracking stays paused until the camera is granted.
    setInterval(() => sendFace(false), CHECK_INTERVAL_MS)
    return
  }

  const video = document.getElementById(VIDEO_ID) as HTMLVideoElement
  video.srcObject = stream
  try {
    await video.play()
  } catch {
    /* autoplay is muted; ignore */
  }

  // 3) Detect a face every few seconds.
  setInterval(async () => {
    if (!ready) return
    try {
      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
      )
      sendFace(!!detection)
    } catch {
      sendFace(false)
    }
  }, CHECK_INTERVAL_MS)
}

init()

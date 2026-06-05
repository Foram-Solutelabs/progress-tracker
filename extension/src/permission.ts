// Opened in a normal tab by the service worker when the camera is blocked.
// A visible page CAN show the camera prompt (an offscreen/background document
// cannot). Granting here persists for the whole extension origin, so the
// offscreen detector can then use the camera.

const msg = () => document.getElementById('msg')!

async function run() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach(t => t.stop()) // we only needed the permission grant
    chrome.runtime.sendMessage({ type: 'CAMERA_GRANTED' })
    const el = msg()
    el.textContent = '✅ Camera enabled — you can close this tab. Tracking will start automatically.'
    el.className = 'ok'
  } catch (e) {
    const el = msg()
    el.textContent =
      '❌ Camera was blocked. Click the camera icon in the address bar (or this page’s site settings), choose Allow, then reload this tab.'
    el.className = 'err'
    console.error('[learning-tracker] permission page getUserMedia failed:', e)
  }
}

run()

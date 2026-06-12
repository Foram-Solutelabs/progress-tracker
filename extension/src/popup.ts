type Status = { state: 'idle' | 'tracking' | 'paused_face' | 'paused_focus'; site: string }

async function render() {
  const { token, userName, status } = await chrome.storage.local.get(['token', 'userName', 'status'])
  const dot = document.getElementById('dot')!
  const statusText = document.getElementById('status-text')!
  const nameEl = document.getElementById('user-name')!
  const detailEl = document.getElementById('today-hours')!

  if (!token) {
    dot.className = 'dot gray'
    statusText.textContent = 'Not logged in'
    nameEl.textContent = 'Open the web app to sign in'
    detailEl.textContent = ''
    return
  }

  nameEl.textContent = userName ?? ''
  const s = (status as Status | undefined)?.state ?? 'idle'
  const site = (status as Status | undefined)?.site ?? ''

  if (s === 'tracking') {
    dot.className = 'dot green'
    statusText.textContent = 'Monitoring'
    detailEl.textContent = site ? `Tracking ${site}` : 'Tracking active tab'
  } else if (s === 'paused_face') {
    dot.className = 'dot yellow'
    statusText.textContent = 'Paused'
    detailEl.textContent = 'Face not detected — look at the screen'
  } else if (s === 'paused_focus') {
    dot.className = 'dot yellow'
    statusText.textContent = 'Paused'
    detailEl.textContent = 'Browser not in focus'
  } else {
    dot.className = 'dot gray'
    statusText.textContent = 'Idle'
    detailEl.textContent = 'Waiting for activity…'
  }
}

// Hold a live port for as long as the popup is open. The popup isn't a
// chrome.windows window, so this connection is how the background knows the user
// is in Chrome (it disconnects the instant the popup closes). Without it the popup
// would report "Paused — browser not in focus" the moment you open it.
chrome.runtime.connect({ name: 'popup' })

render()
// Reflect background state changes instantly, with a slow poll as a safety net.
chrome.storage.onChanged.addListener(render)
setInterval(render, 1500)

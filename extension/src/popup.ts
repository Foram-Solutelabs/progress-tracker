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

render()
// Keep the popup live while it's open (it re-reads the latest status from storage).
setInterval(render, 1500)

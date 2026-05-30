async function render() {
  const stored = await chrome.storage.local.get(['token', 'userName'])
  const dot = document.getElementById('dot')!
  const statusText = document.getElementById('status-text')!
  const userName = document.getElementById('user-name')!

  if (!stored.token) {
    dot.className = 'dot gray'
    statusText.textContent = 'Not logged in'
    userName.textContent = 'Open the web app to sign in'
    return
  }

  dot.className = 'dot green'
  statusText.textContent = 'Monitoring'
  userName.textContent = stored.userName ?? ''
}

render()

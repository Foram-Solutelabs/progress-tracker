import type { LogEntry, MessageToBackground } from './types'

const API_BASE = 'http://localhost:3000'
const BATCH_INTERVAL_MS = 30_000
const FACE_PAUSE_THRESHOLD_MS = 15_000

let token: string | null = null
let currentTab: { url: string; title: string; startedAt: number } | null = null
let faceLastSeen = Date.now()
let facePresent = true
let pendingLogs: LogEntry[] = []
let offscreenCreated = false

chrome.runtime.onStartup.addListener(init)
chrome.runtime.onInstalled.addListener(init)

async function init() {
  const stored = await chrome.storage.local.get('token')
  if (stored.token) {
    token = stored.token
    await ensureOffscreen()
  }
}

chrome.runtime.onMessage.addListener((msg: MessageToBackground) => {
  if (msg.type === 'SET_TOKEN') {
    token = msg.token
    chrome.storage.local.set({ token: msg.token, userName: msg.userName ?? '' })
    ensureOffscreen()
  }

  if (msg.type === 'FACE_RESULT') {
    if (msg.present) {
      faceLastSeen = Date.now()
      facePresent = true
    } else {
      facePresent = Date.now() - faceLastSeen < FACE_PAUSE_THRESHOLD_MS
    }
  }
})

async function ensureOffscreen() {
  if (offscreenCreated) return
  const existing = await chrome.offscreen.hasDocument?.()
  if (existing) { offscreenCreated = true; return }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
    justification: 'Face presence detection via camera',
  })
  offscreenCreated = true
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  closeCurrentWindow()
  const tab = await chrome.tabs.get(tabId)
  if (tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = { url: tab.url, title: tab.title ?? '', startedAt: Date.now() }
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (!tab.active) return
  closeCurrentWindow()
  if (tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = { url: tab.url, title: tab.title ?? '', startedAt: Date.now() }
  }
})

chrome.tabs.onRemoved.addListener(() => closeCurrentWindow())

function closeCurrentWindow() {
  if (!currentTab) return
  const now = Date.now()
  pendingLogs.push({
    url: currentTab.url,
    tabTitle: currentTab.title,
    startedAt: new Date(currentTab.startedAt).toISOString(),
    endedAt: new Date(now).toISOString(),
    facePresent,
  })
  currentTab = null
}

setInterval(async () => {
  if (!token) return

  if (currentTab && facePresent) {
    const now = Date.now()
    pendingLogs.push({
      url: currentTab.url,
      tabTitle: currentTab.title,
      startedAt: new Date(currentTab.startedAt).toISOString(),
      endedAt: new Date(now).toISOString(),
      facePresent: true,
    })
    currentTab = { ...currentTab, startedAt: now }
  }

  if (pendingLogs.length === 0) return

  const batch = [...pendingLogs]
  pendingLogs = []

  try {
    await fetch(`${API_BASE}/api/logs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logs: batch }),
    })
  } catch {
    pendingLogs = [...batch, ...pendingLogs]
  }
}, BATCH_INTERVAL_MS)

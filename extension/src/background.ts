import type { LogEntry, MessageToBackground } from './types'
import {
  decideAction,
  isFacePresent,
  segmentLongEnough,
  type Focus,
  type OpenSegment,
} from './tracking'

const API_BASE = 'http://localhost:3000'
const FLUSH_ALARM = 'lt-flush'
const FLUSH_PERIOD_MIN = 1 // Chrome clamps alarm periods to ~30–60s; 1 min is reliable everywhere.

// ---------------------------------------------------------------------------
// MV3: this service worker is killed after seconds of inactivity, so ALL state
// lives in chrome.storage.local and is read fresh in every handler. Tracking is
// a small state machine (see ./tracking.ts): a "view" accrues time ONLY while a
// real web tab is focused (focused Chrome window) AND the face is present
// (within a grace window). Any transition closes the open view and writes one
// record. Time while the face is absent or the browser is unfocused is never
// counted. The decision logic is pure and unit-tested; this file is just wiring.
// ---------------------------------------------------------------------------

async function read<T>(key: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(key)
  return (r[key] ?? fallback) as T
}
const write = (obj: Record<string, unknown>) => chrome.storage.local.set(obj)

// Serialize state mutations within a worker lifetime so rapid events don't race.
let chain: Promise<unknown> = Promise.resolve()
function queue(task: () => Promise<void>): Promise<unknown> {
  chain = chain.then(task).catch(err => console.error('[learning-tracker]', err))
  return chain
}

// Is our toolbar popup currently open? The popup is NOT a chrome.windows window,
// so it's invisible to getAll()/onFocusChanged — opening it reports WINDOW_ID_NONE
// with no window focused. The only reliable signal is the live port the popup
// holds while open (see chrome.runtime.onConnect below): it disconnects the moment
// the popup closes. A connected popup ALSO keeps this worker alive, so this
// in-memory flag is valid for exactly as long as it needs to be true.
let popupOpen = false

// ---- events ----
chrome.runtime.onStartup.addListener(() => void queue(bootstrap))
chrome.runtime.onInstalled.addListener(() => void queue(bootstrap))

chrome.runtime.onMessage.addListener((msg: MessageToBackground) => {
  if (msg.type === 'SET_TOKEN') void queue(() => onSetToken(msg.token, msg.userName))
  else if (msg.type === 'FACE_RESULT') void queue(() => onFace(msg.present))
  else if (msg.type === 'OFFSCREEN_STATUS') void queue(() => onOffscreenStatus(msg.status, msg.detail))
  else if (msg.type === 'CAMERA_GRANTED') void queue(onCameraGranted)
})

// The popup connects this port while open and it disconnects when the popup closes.
// While open → user is in Chrome → reconcile so its status is immediately correct.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'popup') return
  popupOpen = true
  void queue(reconcile)
  port.onDisconnect.addListener(() => {
    popupOpen = false
    void queue(reconcile)
  })
})

chrome.tabs.onActivated.addListener(info => void queue(() => onTabActivated(info.tabId)))
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (tab.active && (info.status === 'complete' || info.url)) void queue(() => setActiveTab(tab))
})
chrome.tabs.onRemoved.addListener(() => void queue(reseedActiveTab))
chrome.windows.onFocusChanged.addListener(id => void queue(() => onFocusChanged(id)))
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === FLUSH_ALARM) void queue(flush)
})

// ---- handlers ----
async function bootstrap() {
  await chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN })
  await write({ cameraPromptOpened: false })
  // Seed the active tab now — onActivated does NOT fire for the tab that was
  // already open when the worker (re)starts, so without this we'd have no tab.
  await reseedActiveTab()
  // Recover a view left open by a crash/shutdown: end it at the last known
  // presence time so we don't count the time the browser was closed.
  const open = await read<OpenSegment | null>('openSegment', null)
  if (open) {
    const faceLastSeen = await read<number>('faceLastSeen', open.startedAt)
    await bank(open, Math.max(open.startedAt, faceLastSeen))
    await write({ openSegment: null })
  }
  if (await read<string | null>('token', null)) await ensureOffscreen()
  await flush()
}

async function onSetToken(token: string, userName: string) {
  await write({ token, userName: userName ?? '' })
  await ensureOffscreen()
  await reconcile()
}

async function onFace(present: boolean) {
  if (present) await write({ faceLastSeen: Date.now() })
  const wasLogged = await read<boolean | null>('facePresentLogged', null)
  if (present !== wasLogged) {
    console.log('[learning-tracker] 👤 face', present ? 'detected' : 'NOT detected')
    await write({ facePresentLogged: present })
  }
  await reconcile()
}

// Offscreen detector reports its model/camera state. If the camera is blocked,
// open a visible permission page once (a background doc can't prompt itself).
async function onOffscreenStatus(
  status: 'models_ok' | 'models_failed' | 'camera_ok' | 'camera_denied',
  detail?: string
) {
  console.log('[learning-tracker] 🎥 offscreen:', status, detail ?? '')
  if (status === 'camera_ok') {
    await write({ cameraPromptOpened: false })
    return
  }
  if (status === 'camera_denied') {
    if (await read<boolean>('cameraPromptOpened', false)) return // already asked this session
    await write({ cameraPromptOpened: true })
    console.log('[learning-tracker] opening camera-permission page…')
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') })
    } catch (e) {
      console.warn('[learning-tracker] could not open permission page:', e)
    }
  }
}

// Permission page granted camera access → restart the detector so it retries
// getUserMedia (now permitted for the extension origin).
async function onCameraGranted() {
  console.log('[learning-tracker] ✅ camera granted → restarting detector')
  await write({ cameraPromptOpened: false })
  try {
    await chrome.offscreen.closeDocument()
  } catch {
    /* none open */
  }
  await ensureOffscreen()
}

type ActiveTab = { url: string; title: string }

// Store the active tab from events (we never live-query "the focused window",
// because while our popup is open the popup IS the focused window).
async function setActiveTab(tab: chrome.tabs.Tab) {
  if (tab.url && /^https?:/i.test(tab.url)) {
    await write({ activeTab: { url: tab.url, title: tab.title ?? '' } satisfies ActiveTab })
  } else {
    await write({ activeTab: null }) // chrome://, new-tab page, extension pages, etc.
  }
  await reconcile()
}

async function onTabActivated(tabId: number) {
  try {
    await setActiveTab(await chrome.tabs.get(tabId))
  } catch {
    await reconcile()
  }
}

// Re-derive the active tab by querying the last focused *normal* window.
// Safe to call when the popup is closed (bootstrap, tab close).
async function reseedActiveTab() {
  try {
    const tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
    if (tab) {
      await setActiveTab(tab)
      return
    }
  } catch {
    /* fall through */
  }
  await write({ activeTab: null })
  await reconcile()
}

// Focus moved between windows. We no longer cache a focused flag here (it gets
// stuck — see isChromeFocused); we just refresh the active tab when a *normal*
// window gains focus, then let reconcile() read live focus. Opening the popup
// never changes the active tab.
async function onFocusChanged(windowId: number) {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const win = await chrome.windows.get(windowId, { populate: true })
      if (win.type === 'normal') {
        const tab = win.tabs?.find(t => t.active)
        if (tab) {
          await setActiveTab(tab)
          return
        }
      }
    } catch {
      /* window vanished */
    }
  }
  await reconcile()
}

// The heart of it: bring the open view in line with live focus + face state.
async function reconcile() {
  const now = Date.now()
  const faceLastSeen = await read<number>('faceLastSeen', 0)
  const present = isFacePresent(faceLastSeen, now)
  const focused = await getFocusedWebTab()
  const open = await read<OpenSegment | null>('openSegment', null)

  const action = decideAction({ open, focused, present, now, faceLastSeen })
  if (action.kind === 'open') {
    await write({ openSegment: action.segment })
    console.log('[learning-tracker] ▶ start', action.segment.url)
  } else if (action.kind === 'close') {
    if (open) await bank(open, action.endedAt)
    await write({ openSegment: null })
    console.log('[learning-tracker] ⏸ pause', present ? '(left page/browser)' : '(face gone)')
  } else if (action.kind === 'switch') {
    if (open) await bank(open, action.endedAt)
    await write({ openSegment: action.segment })
    console.log('[learning-tracker] ↪ switch →', action.segment.url)
  }

  // Diagnostic: when paused, show WHY — Chrome focus vs a non-web active tab vs face.
  if (!focused || !present) {
    const cf = await isChromeFocused()
    const at = await read<ActiveTab | null>('activeTab', null)
    console.log(
      `[learning-tracker] · idle/paused: present=${present} chromeFocused=${cf} activeTab=${at?.url ?? 'null'}`
    )
  }

  await writeStatus(focused, present)
}

// Append one accurate record for a finished view (dropping sub-second noise).
async function bank(open: OpenSegment, endedAt: number) {
  if (!segmentLongEnough(open.startedAt, endedAt)) return
  const pending = await read<LogEntry[]>('pendingLogs', [])
  pending.push({
    url: open.url,
    tabTitle: open.title,
    startedAt: new Date(open.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    facePresent: true, // we only ever record present time
  })
  await write({ pendingLogs: pending })
  console.log('[learning-tracker] ⏺ recorded', open.url, `${Math.round((endedAt - open.startedAt) / 1000)}s`)
}

async function flush() {
  await reconcile() // safety net: closes a view if the face went stale with no event
  const token = await read<string | null>('token', null)
  if (!token) return
  await ensureOffscreen()

  const batch = await read<LogEntry[]>('pendingLogs', [])
  if (batch.length === 0) return
  await write({ pendingLogs: [] })
  try {
    const res = await fetch(`${API_BASE}/api/logs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ logs: batch }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    const since = await read<LogEntry[]>('pendingLogs', [])
    await write({ pendingLogs: [...batch, ...since] }) // re-queue for the next alarm
    console.warn('[learning-tracker] flush failed, will retry:', err)
  }
}

// ---- helpers ----
// The web tab we should be tracking. Null if Chrome isn't the foreground app or
// the active tab isn't a real web page.
//
// Focus is derived LIVE here rather than cached from chrome.windows.onFocusChanged.
// That event fires WINDOW_ID_NONE for transient in-Chrome focus shifts (opening
// our popup, clicking a devtools window) with no reliable paired "regained focus"
// event on Windows — so a cached flag gets permanently stuck false. reconcile()
// only ever asks at settled moments (every face result + every event), so a live
// query reads the truth with no race: if ANY Chrome window (normal/popup/devtools)
// is focused, Chrome is the foreground app and we should be tracking.
async function isChromeFocused(): Promise<boolean> {
  if (popupOpen) return true // our popup is open → user is in Chrome (windows API can't see it)
  try {
    const wins = await chrome.windows.getAll({
      windowTypes: ['normal', 'popup', 'panel', 'app', 'devtools'],
    })
    return wins.some(w => w.focused)
  } catch {
    return true // can't query → don't pause spuriously
  }
}

async function getFocusedWebTab(): Promise<Focus> {
  if (!(await isChromeFocused())) return null
  const t = await read<ActiveTab | null>('activeTab', null)
  if (!t || !/^https?:/i.test(t.url)) return null
  return { url: t.url, title: t.title }
}

// Status surfaced to the popup so the user can see live state at a glance.
async function writeStatus(focused: Focus, present: boolean) {
  const token = await read<string | null>('token', null)
  let state: 'idle' | 'tracking' | 'paused_face' | 'paused_focus'
  let site = ''
  if (!token) {
    state = 'idle'
  } else if (focused && present) {
    state = 'tracking'
    try {
      site = new URL(focused.url).hostname.replace(/^www\./, '')
    } catch {
      site = ''
    }
  } else if (!focused) {
    state = 'paused_focus'
  } else {
    state = 'paused_face'
  }
  await write({ status: { state, site } })
}

async function ensureOffscreen() {
  try {
    if (await chrome.offscreen.hasDocument()) return
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['USER_MEDIA' as chrome.offscreen.Reason],
      justification: 'Face presence detection via camera',
    })
    console.log('[learning-tracker] 📷 offscreen camera document created')
  } catch (e) {
    // A concurrent wake-up may create it first ("single offscreen document") — safe to ignore.
    console.warn('[learning-tracker] offscreen create skipped/failed:', e)
  }
}

import {
  decideAction,
  isFacePresent,
  segmentLongEnough,
  FACE_GRACE_MS,
  MIN_SEGMENT_MS,
  type OpenSegment,
} from '../../extension/src/tracking'

const NOW = 1_000_000
const tab = (url: string, title = url) => ({ url, title })
const seg = (url: string, startedAt: number): OpenSegment => ({ url, title: url, startedAt })

describe('isFacePresent', () => {
  test('present when seen within the grace window', () => {
    expect(isFacePresent(NOW - (FACE_GRACE_MS - 1), NOW)).toBe(true)
  })
  test('absent once the grace window has fully elapsed', () => {
    expect(isFacePresent(NOW - FACE_GRACE_MS, NOW)).toBe(false)
    expect(isFacePresent(NOW - FACE_GRACE_MS * 5, NOW)).toBe(false)
  })
})

describe('segmentLongEnough', () => {
  test('drops sub-minimum (junk / double-fire) segments', () => {
    expect(segmentLongEnough(NOW, NOW)).toBe(false)
    expect(segmentLongEnough(NOW, NOW + MIN_SEGMENT_MS - 1)).toBe(false)
  })
  test('keeps segments at or above the minimum', () => {
    expect(segmentLongEnough(NOW, NOW + MIN_SEGMENT_MS)).toBe(true)
  })
  test('treats negative/inverted spans as too short', () => {
    expect(segmentLongEnough(NOW, NOW - 5_000)).toBe(false)
  })
})

describe('decideAction', () => {
  const base = { now: NOW, faceLastSeen: NOW }

  test('idle: no focus, no open segment → nothing', () => {
    expect(decideAction({ ...base, open: null, focused: null, present: false }))
      .toEqual({ kind: 'none' })
  })

  test('starts a view when a focused tab has the face present', () => {
    const a = decideAction({ ...base, open: null, focused: tab('https://github.com'), present: true })
    expect(a).toEqual({ kind: 'open', segment: { url: 'https://github.com', title: 'https://github.com', startedAt: NOW } })
  })

  test('keeps the same view while on the same tab (one record per visit)', () => {
    expect(decideAction({ ...base, open: seg('https://github.com', NOW - 5000), focused: tab('https://github.com'), present: true }))
      .toEqual({ kind: 'none' })
  })

  test('switches when the focused URL changes (close old, open new)', () => {
    const a = decideAction({ ...base, open: seg('https://github.com', NOW - 5000), focused: tab('https://google.com'), present: true })
    expect(a).toEqual({ kind: 'switch', endedAt: NOW, segment: { url: 'https://google.com', title: 'https://google.com', startedAt: NOW } })
  })

  test('face lost: closes the open view ending at last-seen time (no absent time counted)', () => {
    const faceLastSeen = NOW - FACE_GRACE_MS - 5000 // face gone well past grace
    const a = decideAction({ open: seg('https://github.com', NOW - 60_000), focused: tab('https://github.com'), present: false, now: NOW, faceLastSeen })
    expect(a).toEqual({ kind: 'close', endedAt: faceLastSeen })
  })

  test('left the browser while present: closes the open view ending now', () => {
    const a = decideAction({ ...base, open: seg('https://github.com', NOW - 60_000), focused: null, present: true })
    expect(a).toEqual({ kind: 'close', endedAt: NOW })
  })

  test('paused and nothing open → nothing (does not record absence)', () => {
    expect(decideAction({ ...base, open: null, focused: tab('https://github.com'), present: false }))
      .toEqual({ kind: 'none' })
    expect(decideAction({ ...base, open: null, focused: null, present: true }))
      .toEqual({ kind: 'none' })
  })
})

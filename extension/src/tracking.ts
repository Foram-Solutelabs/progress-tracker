// Pure, dependency-free monitoring decision logic.
// No `chrome.*` here on purpose — this is unit-tested in tests/extension/tracking.test.ts.

export const FACE_GRACE_MS = 10_000 // brief look-aways under this don't pause tracking
export const MIN_SEGMENT_MS = 1_000 // drop sub-second junk (e.g. onActivated+onUpdated double-fire)

export type Focus = { url: string; title: string } | null
export type OpenSegment = { url: string; title: string; startedAt: number }

export type TrackAction =
  | { kind: 'none' }
  | { kind: 'open'; segment: OpenSegment }
  | { kind: 'close'; endedAt: number }
  | { kind: 'switch'; endedAt: number; segment: OpenSegment }

// Face counts as present if we've seen it within the grace window.
export function isFacePresent(faceLastSeen: number, now: number): boolean {
  return now - faceLastSeen < FACE_GRACE_MS
}

// Given live focus + face state, decide what to do with the currently-open segment.
// Tracking accrues ONLY while a real web tab is focused AND the face is present.
export function decideAction(args: {
  open: OpenSegment | null
  focused: Focus
  present: boolean
  now: number
  faceLastSeen: number
}): TrackAction {
  const { open, focused, present, now, faceLastSeen } = args
  const shouldTrack = focused !== null && present

  if (!shouldTrack) {
    if (open) {
      // End the record at the last moment the user was actually here:
      //  - `now` if they navigated away / left the browser while still present
      //  - `faceLastSeen` if tracking is stopping because the face was lost
      // We never count time during which the face was absent.
      return { kind: 'close', endedAt: present ? now : faceLastSeen }
    }
    return { kind: 'none' }
  }

  // shouldTrack === true → focused is non-null
  const f = focused as { url: string; title: string }
  if (!open) {
    return { kind: 'open', segment: { url: f.url, title: f.title, startedAt: now } }
  }
  if (open.url !== f.url) {
    return { kind: 'switch', endedAt: now, segment: { url: f.url, title: f.title, startedAt: now } }
  }
  return { kind: 'none' } // same tab, still present → keep accruing (one record per visit)
}

// A segment is only worth recording if it lasted at least MIN_SEGMENT_MS.
export function segmentLongEnough(startedAt: number, endedAt: number): boolean {
  return endedAt - startedAt >= MIN_SEGMENT_MS
}

export type LogEntry = {
  url: string
  tabTitle: string
  startedAt: string
  endedAt: string
  facePresent: boolean
}

export type MessageToBackground =
  | { type: 'FACE_RESULT'; present: boolean }
  | { type: 'SET_TOKEN'; token: string; userName: string }

export type MessageToOffscreen =
  | { type: 'START_DETECTION' }
  | { type: 'STOP_DETECTION' }

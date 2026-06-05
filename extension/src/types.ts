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
  | { type: 'OFFSCREEN_STATUS'; status: 'models_ok' | 'models_failed' | 'camera_ok' | 'camera_denied'; detail?: string }
  | { type: 'CAMERA_GRANTED' }

export type MessageToOffscreen =
  | { type: 'START_DETECTION' }
  | { type: 'STOP_DETECTION' }

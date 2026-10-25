import type { MainlineEchoLayout } from './mainlineEchoLayout'
import type { Point } from './sceneGeometry'

export type MainlineReadingPresentationSnapshot = {
  sessionKey: string
  anchorContextKey?: string
  position: Point
  cameraOffset: Point
  layout: MainlineEchoLayout
  maxWidthPx: number
  text: string
  overflowIndex: number
}

export type MainlineReadingPresentationPhase = 'active' | 'leaving' | 'inactive'

/** Keep the chosen legal display point across pages of one unchanged reading
 * session. A new session or changed viewport/scene context may choose again. */
export function mainlineReadingAnchorForSession(
  sessionKey: string,
  anchorContextKey: string,
  candidate: Point,
  retained: MainlineReadingPresentationSnapshot | null,
): Point {
  return retained?.sessionKey === sessionKey && retained.anchorContextKey === anchorContextKey
    ? retained.position
    : candidate
}

/**
 * Active reading uses the layout computed for the current line. During the
 * exit fade, retain that exact displayed layout; never fall back to the
 * authored/source anchor while the outgoing text is still visible.
 */
export function mainlineReadingPresentationForPhase(
  phase: MainlineReadingPresentationPhase,
  sessionKey: string | null,
  current: MainlineReadingPresentationSnapshot | null,
  retained: MainlineReadingPresentationSnapshot | null,
): MainlineReadingPresentationSnapshot | null {
  if (phase === 'active') return current?.sessionKey === sessionKey ? current : null
  if (phase === 'leaving' && sessionKey && retained?.sessionKey === sessionKey) return retained
  return null
}


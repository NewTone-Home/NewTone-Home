import type { MainlineEchoLayout } from './mainlineEchoLayout'
import type { Point } from './sceneGeometry'

export type MainlineReadingPresentationSnapshot = {
  sessionKey: string
  anchorSessionKey?: string
  anchorContextKey?: string
  position: Point
  cameraOffset: Point
  layout: MainlineEchoLayout
  maxWidthPx: number
  text: string
  overflowIndex: number
}

export type MainlineReadingPresentationPhase = 'active' | 'deleting' | 'leaving' | 'inactive'

export type MainlineDialogueHandoffPresentation = {
  id: number
  presentation: MainlineReadingPresentationSnapshot | null
}

/** Capture the renderer's last retained visible page once per speaker handoff. */
export function mainlineDialogueHandoffPresentationForId(
  id: number | null,
  previous: MainlineDialogueHandoffPresentation | null,
  retained: MainlineReadingPresentationSnapshot | null,
): MainlineDialogueHandoffPresentation | null {
  if (id === null) return null
  if (previous?.id === id) return previous
  return { id, presentation: retained }
}

/** Keep one dialogue line's fitted pages together, but let the next authored
 * line choose a fresh anchor against its own text envelope. */
export function mainlineDialogueReadingSessionKey(sceneId: string, triggerEntityId: string | undefined, lineId: string | undefined, lineIndex: number | null | undefined) {
  return `${sceneId}:dialogue:${triggerEntityId ?? ''}:line:${lineIndex ?? ''}:${lineId ?? ''}`
}

/** Context that can invalidate a fitted anchor. `cameraOffset` is the external
 * scene camera; reading-induced text pan is intentionally not part of this key. */
export function mainlineReadingAnchorContextKey(input: {
  sceneId: string
  viewport: { width: number; height: number; viewportWidth?: number }
  worldScale: number
  cameraOffset: Point
  source: Point
  protectedBoxes: readonly { x: number; y: number; width: number; height: number }[]
}) {
  return JSON.stringify([
    input.sceneId,
    input.viewport.width,
    input.viewport.height,
    input.viewport.viewportWidth ?? null,
    input.worldScale,
    input.cameraOffset.x,
    input.cameraOffset.y,
    input.source.x,
    input.source.y,
    ...input.protectedBoxes.flatMap(box => [box.x, box.y, box.width, box.height]),
  ])
}

/** Keep the chosen legal display point across pages of one unchanged reading
 * session. A new session or changed viewport/scene context may choose again. */
export function mainlineReadingAnchorForSession(
  sessionKey: string,
  anchorContextKey: string,
  candidate: Point,
  retained: MainlineReadingPresentationSnapshot | null,
): Point {
  return retained !== null
    && (retained.anchorSessionKey ?? retained.sessionKey) === sessionKey
    && retained.anchorContextKey === anchorContextKey
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
  if ((phase === 'deleting' || phase === 'leaving') && sessionKey && retained?.sessionKey === sessionKey) return retained
  return null
}


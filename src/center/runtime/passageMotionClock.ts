import { sceneDoorMotion } from './sceneDoorConfig'
import type { DoorPassagePhase } from './doorPassageModel'

/** Authoritative mechanism budget. No glyph, frame or DOM event owns passage completion. */
export function passageMotionDeadline(phase: DoorPassagePhase, startedAt: number) {
  if (phase === 'opening') return startedAt + sceneDoorMotion.openingMs
  if (phase === 'closing') return startedAt + sceneDoorMotion.closingMs
  return null
}

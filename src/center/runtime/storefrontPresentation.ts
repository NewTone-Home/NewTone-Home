import type { Point } from './sceneGeometry'
import { mainlineStorefrontApproach, type MainlineSceneDefinition, type MainlineStorefrontSlot } from './mainlineScenes'

/** Presentation-only state for a portal storefront. It never changes passage or collision state. */
export type StorefrontPresentationPhase = 'baseline' | 'retracting' | 'revealing' | 'revealed' | 'lingering' | 'restoring'

/** Shared duration for the storefront label's reveal and restoration motion. */
export const storefrontLabelRollDurationMs = 700

export const storefrontLingerDurationMs = 3000

export function storefrontRestoreDelayMs(departedAt: number, now: number) {
  return Math.max(0, storefrontLingerDurationMs - (now - departedAt))
}

/** The inward normal is independent of horizontal/vertical typography. */
export function storefrontRollDirection(edge: MainlineStorefrontSlot['edge']): Point {
  return edge === 'left' ? { x: -1, y: 0 } : edge === 'right' ? { x: 1, y: 0 }
    : edge === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 }
}

/** The label remains retracted throughout its leave grace period. */
export function storefrontPresentationRetractsFrame(phase: StorefrontPresentationPhase) {
  return phase !== 'baseline'
}

export type StorefrontPresentationEvent =
  | 'approach'
  | 'frame-retracted'
  | 'reveal-motion-complete'
  | 'leave'
  | 'linger-animation-complete'
  | 'restore-motion-complete'

export function nextStorefrontPresentationPhase(
  phase: StorefrontPresentationPhase,
  event: StorefrontPresentationEvent,
): StorefrontPresentationPhase {
  if (event === 'approach') return phase === 'baseline' ? 'retracting' : phase === 'restoring' ? 'revealing' : phase === 'lingering' ? 'revealed' : phase
  if (event === 'frame-retracted') return phase === 'retracting' ? 'revealing' : phase
  if (event === 'reveal-motion-complete') return phase === 'revealing' ? 'revealed' : phase
  if (event === 'leave') return phase === 'retracting' ? 'baseline' : phase === 'revealed' ? 'lingering' : phase
  if (event === 'linger-animation-complete') return phase === 'lingering' ? 'restoring' : phase
  return phase === 'restoring' ? 'baseline' : phase
}

/**
 * The authored storefront approach point is the presentation trigger. The
 * existing nearRadius remains a small visual tolerance around that entrance
 * approach; it is not a second routing or door rule.
 */
export function storefrontPresentationShouldReveal(
  scene: MainlineSceneDefinition,
  storefront: MainlineStorefrontSlot,
  position: Point,
) {
  if (!storefront.portalId) return false
  const approach = mainlineStorefrontApproach(scene, storefront)
  return Math.hypot(position.x - approach.x, position.y - approach.y) <= (storefront.nearRadius ?? 10)
}

/** A storefront label is always one visual slot, never a per-character reel. */
export function storefrontPresentationLabelSlots(label: string) {
  return [label] as const
}

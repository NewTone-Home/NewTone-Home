import type { Point } from './sceneGeometry'
import { mainlineStorefrontApproach, type MainlineSceneDefinition, type MainlineStorefrontSlot } from './mainlineScenes'

/** Presentation-only state for a portal storefront. It never changes passage or collision state. */
export type StorefrontPresentationPhase = 'baseline' | 'revealing' | 'revealed' | 'lingering' | 'restoring'

/** Matches EntryTextFlip's established translate3d motion contract. */
export const storefrontLabelRollDurationMs = 360

/** The label remains retracted throughout its leave grace period. */
export function storefrontPresentationRetractsFrame(phase: StorefrontPresentationPhase) {
  return phase === 'revealing' || phase === 'revealed' || phase === 'lingering'
}

export type StorefrontPresentationEvent =
  | 'approach'
  | 'reveal-motion-complete'
  | 'leave'
  | 'linger-animation-complete'
  | 'restore-motion-complete'

export function nextStorefrontPresentationPhase(
  phase: StorefrontPresentationPhase,
  event: StorefrontPresentationEvent,
): StorefrontPresentationPhase {
  if (event === 'approach') return phase === 'baseline' || phase === 'restoring' ? 'revealing' : phase === 'lingering' ? 'revealed' : phase
  if (event === 'reveal-motion-complete') return phase === 'revealing' ? 'revealed' : phase
  if (event === 'leave') return phase === 'baseline' || phase === 'restoring' ? phase : 'lingering'
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

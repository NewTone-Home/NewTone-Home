import type { DoorPassagePhase } from './doorPassageModel'

export type SceneDoorLeafSide = 'left' | 'right'
export type SceneDoorLeafCount = 'single' | 'double'
export type SceneDoorOpenLeaves = 'both' | SceneDoorLeafSide
export type SceneDoorVisualMode = 'fade' | 'static'

/** The shared visual motion budget for every door surface in the Center. */
export const sceneDoorMotion = {
  // Door presentation must not become a navigation lock. The focus frame
  // has its own slower stroke animation; this budget only gates the shared
  // passage lifecycle and keeps pathfinding responsive.
  openingMs: 240,
  closingMs: 240,
  clearHoldMs: 500,
} as const

/**
 * Shared door presentation contract. The scene owns this data; the renderer
 * only turns it into panels and opacity changes.
 */
export type SceneDoorBehavior = {
  leafCount: SceneDoorLeafCount
  openLeaves: SceneDoorOpenLeaves
  singleLeafSide?: SceneDoorLeafSide
  /** The mechanism can be automatic even when its glyph never animates. */
  visualMode?: SceneDoorVisualMode
}

export type SceneDoorRuntimePhase = DoorPassagePhase

export function sceneDoorVisualMode(behavior?: SceneDoorBehavior): SceneDoorVisualMode {
  return behavior?.visualMode ?? 'fade'
}

export function sceneDoorIsVisuallyOpen(behavior: SceneDoorBehavior | undefined, phase: SceneDoorRuntimePhase) {
  return sceneDoorVisualMode(behavior) !== 'static'
    && (phase === 'opening' || phase === 'open' || phase === 'crossing' || phase === 'holding')
}

export const defaultSceneDoorBehavior: SceneDoorBehavior = {
  leafCount: 'double',
  openLeaves: 'both',
}

export function sceneDoorLeafSides(_behavior: SceneDoorBehavior): readonly SceneDoorLeafSide[] {
  // A door is one object made from two side/radical panels. A single door
  // means only one panel is operable; its other panel remains as the fixed
  // side of the same glyph. Double doors make both panels operable.
  if (_behavior.leafCount === 'single' && _behavior.singleLeafSide === 'right') return ['right', 'left']
  return ['left', 'right']
}

export function sceneDoorLeafFadesOnOpen(behavior: SceneDoorBehavior, side: SceneDoorLeafSide) {
  return behavior.openLeaves === 'both' || behavior.openLeaves === side
}

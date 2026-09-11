import type { Point } from './sceneGeometry'
import type { SceneDoorBehavior } from './sceneDoorConfig'

/**
 * One spatial glyph in the scene. Walls, windows, and doors all occupy this
 * same visual grid; a door only adds behavior to the glyph that replaced one
 * wall position. Walls are always visible; distance reveal applies to the
 * non-wall labels that opt into it.
 */
export type SpatialLabel = {
  id: string
  x: number
  y: number
  baseline: boolean
  /** Whether this cell participates in the current whole-edge baseline projection. */
  baselineVisible?: boolean
  role: 'wall' | 'door' | 'feature' | 'opening' | 'counter' | 'window'
  /** Direction used to place this label along its wall/grid axis. */
  layoutOrientation: 'horizontal' | 'vertical'
  /** Direction used to render the glyph itself. */
  glyphOrientation: 'horizontal' | 'vertical'
  glyph: string
  /** Semantic name rendered by the owning door surface. */
  label?: string
  /** User-facing label projected without changing the semantic identity. */
  displayLabel?: string
  doorId?: string
  doorBehavior?: SceneDoorBehavior
  /** Logical interaction owner for a non-door wall feature. */
  interactionId?: string
  featureId?: string
  featureCellRole?: 'content' | 'flank'
  /** Shared wall-grid ownership metadata used by mainline projections. */
  boundaryId?: string
  gridIndex?: number
  openingId?: string
  structuralOpeningId?: string
  access?: 'open' | 'locked'
  lockedText?: string
}

export type SpatialLabelVisibility = 'hidden' | 'baseline' | 'near'

export const spatialLabelRevealRadius = 10
// Non-wall labels still sample the same wall lattice used by nearby labels.
// Every second lattice cell remains available for features and objects that
// intentionally use a low-density baseline projection.
export const spatialLabelBaselineEvery = 2

export function spatialLabelIsBaseline(index: number) {
  return index % spatialLabelBaselineEvery === 0
}

export function isSpatialLabelNear(position: Point, label: Pick<SpatialLabel, 'x' | 'y'>) {
  return Math.hypot(position.x - label.x, position.y - label.y) <= spatialLabelRevealRadius
}

export function resolveSpatialLabelVisibility(position: Point, label: Pick<SpatialLabel, 'x' | 'y' | 'baseline' | 'role'>): SpatialLabelVisibility {
  if (label.role === 'wall') return 'baseline'
  if (isSpatialLabelNear(position, label)) return 'near'
  return label.baseline ? 'baseline' : 'hidden'
}

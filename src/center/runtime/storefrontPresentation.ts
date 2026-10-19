import type { Point } from './sceneGeometry'
import { isMainlineStorefrontPresentationInRange, mainlineStorefrontApproach, type MainlineSceneDefinition, type MainlineSceneGeometryUnit, type MainlineStorefrontSlot } from './mainlineScenes'

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
  | 'handoff'
  | 'frame-retracted'
  | 'reveal-motion-complete'
  | 'leave'
  | 'linger-animation-complete'
  | 'restore-motion-complete'

export function nextStorefrontPresentationPhase(
  phase: StorefrontPresentationPhase,
  event: StorefrontPresentationEvent,
): StorefrontPresentationPhase {
  if (event === 'handoff') {
    if (phase === 'retracting') return 'baseline'
    if (phase === 'revealing' || phase === 'revealed' || phase === 'lingering') return 'restoring'
    return phase
  }
  if (event === 'approach') return phase === 'baseline' ? 'retracting' : phase === 'restoring' ? 'revealing' : phase === 'lingering' ? 'revealed' : phase
  if (event === 'frame-retracted') return phase === 'retracting' ? 'revealing' : phase
  if (event === 'reveal-motion-complete') return phase === 'revealing' ? 'revealed' : phase
  if (event === 'leave') return phase === 'retracting' ? 'baseline' : phase === 'revealed' ? 'lingering' : phase
  if (event === 'linger-animation-complete') return phase === 'lingering' ? 'restoring' : phase
  return phase === 'restoring' ? 'baseline' : phase
}

/** Choose one eligible switchable portal so only one storefront can own the entrance presentation. */
export function activeStorefrontPresentationOwner(
  scene: MainlineSceneDefinition,
  position: Point,
) {
  return scene.storefronts
    .filter((storefront) => storefront.portalId && storefront.characterSwitch
      && storefrontPresentationShouldReveal(scene, storefront, position))
    .map((storefront, index) => ({
      storefront,
      index,
      distance: Math.hypot(
        position.x - mainlineStorefrontApproach(scene, storefront).x,
        position.y - mainlineStorefrontApproach(scene, storefront).y,
      ),
    }))
    .sort((first, second) => first.distance - second.distance || first.index - second.index)[0]?.storefront.id ?? null
}

/** A grace-period presentation still owns the visual entrance after the player leaves its trigger. */
export function storefrontPresentationHandoffSource(
  phases: ReadonlyMap<string, StorefrontPresentationPhase>,
  incomingStorefrontId: string,
) {
  return [...phases].find(([storefrontId, phase]) => storefrontId !== incomingStorefrontId && phase !== 'baseline')?.[0] ?? null
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
  return isMainlineStorefrontPresentationInRange(scene, storefront, position)
}

/** Project a label onto the already-compiled real wall/door/wall cells. */
export function storefrontCharacterCells(
  scene: MainlineSceneDefinition,
  storefront: MainlineStorefrontSlot,
  geometryUnits: readonly MainlineSceneGeometryUnit[] = scene.geometry,
) {
  const roles = storefront.composition?.near ?? []
  const labels = Array.from(storefront.label)
  if (!storefront.characterSwitch || labels.length === 0 || !roles.includes('door')) return []

  const entries = geometryUnits.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
  const onStorefrontEdge = ({ unit }: typeof entries[number]) => unit.sourceWallId === storefront.wallId && unit.edge === storefront.edge
  const door = entries.find(entry => onStorefrontEdge(entry)
    && entry.cell.kind === 'door'
    && (entry.cell.entityId === storefront.portalId || entry.unit.entityId === storefront.portalId))
  // A narrow responsive lattice can leave only one reserved storefront cell.
  // The compiled passage unit still owns the real door center, while the
  // neighboring projected wall segments own the two flank glyph positions.
  const passageAnchor = door ? undefined : geometryUnits.find(unit => (
    unit.storefrontId === storefront.id && unit.navigation.passageId === storefront.portalId
  ))
  const resolvedDoor = door ?? (passageAnchor ? {
    unit: passageAnchor,
    cell: {
      id: `${storefront.id}-base-cell-1`,
      x: passageAnchor.x + passageAnchor.width / 2,
      y: passageAnchor.y + passageAnchor.height / 2,
      kind: 'door' as const,
      entityId: storefront.portalId,
    },
  } : undefined)
  if (!resolvedDoor) return []

  const vertical = storefront.edge === 'left' || storefront.edge === 'right'
  const tangent = ({ cell }: typeof resolvedDoor) => vertical ? cell.y : cell.x
  const normal = ({ cell }: typeof resolvedDoor) => vertical ? cell.x : cell.y
  const doorTangent = tangent(resolvedDoor)
  const doorNormal = normal(resolvedDoor)
  const adjacentWalls = entries.filter(entry => onStorefrontEdge(entry)
    && entry.cell.kind === 'wall'
    && Math.abs(normal(entry) - doorNormal) < .01)
  const before = adjacentWalls.filter(entry => tangent(entry) < doorTangent)
    .sort((first, second) => tangent(second) - tangent(first))[0]
  const after = adjacentWalls.filter(entry => tangent(entry) > doorTangent)
    .sort((first, second) => tangent(first) - tangent(second))[0]
  if (!before || !after) return []

  const anchors = [before, resolvedDoor, after]
  const doorIndex = Math.floor((labels.length - 1) / 2)
  return labels.map((baselineGlyph, index) => {
    const position = labels.length === 1 ? resolvedDoor
      : index <= doorIndex && doorIndex > 0
        ? interpolateStorefrontEntry(before, resolvedDoor, index / doorIndex)
        : interpolateStorefrontEntry(resolvedDoor, after, (index - doorIndex) / Math.max(1, labels.length - 1 - doorIndex))
    const role = index === doorIndex ? 'door' : 'wall'
    const nearest = anchors.reduce((best, entry) => {
      const distance = Math.hypot(entry.cell.x - position.cell.x, entry.cell.y - position.cell.y)
      const bestDistance = Math.hypot(best.cell.x - position.cell.x, best.cell.y - position.cell.y)
      return distance < bestDistance ? entry : best
    })
    return {
      id: `${storefront.id}-character-${index}`,
      x: position.cell.x,
      y: position.cell.y,
      role,
      baselineGlyph,
      glyph: role === 'door' ? (resolvedDoor.cell.glyph ?? '') : (nearest.cell.glyph ?? ''),
      ...(role === 'door' ? { entityId: resolvedDoor.cell.entityId ?? resolvedDoor.unit.entityId ?? storefront.portalId } : {}),
    }
  })
}

function interpolateStorefrontEntry<T extends { cell: { x: number; y: number } }>(start: T, end: T, progress: number): T {
  const t = Math.max(0, Math.min(1, progress))
  return { ...start, cell: { ...start.cell, x: start.cell.x + (end.cell.x - start.cell.x) * t, y: start.cell.y + (end.cell.y - start.cell.y) * t } }
}

/** All cells consume the same normalized animation clock. */
export function storefrontCharacterProgress(from: number, to: number, elapsed: number, duration: number) {
  const t = Math.max(0, Math.min(1, elapsed / Math.max(1, duration)))
  return from + (to - from) * t * t * (3 - 2 * t)
}

/** One visual window per character; identity and behavior remain outside. */
export function storefrontPresentationLabelSlots(label: string) {
  return Array.from(label)
}

import type { Point } from './sceneGeometry'
import { isMainlineStorefrontPresentationInRange, mainlineStorefrontApproach, type MainlineSceneDefinition, type MainlineSceneGeometryUnit, type MainlineStorefrontRole, type MainlineStorefrontSlot } from './mainlineScenes'

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

/** Fixed storefront grids animate only their four-cell entrance; outer panes and wall caps keep their authored colors. */
export function storefrontCellVisualState(
  storefront: MainlineStorefrontSlot | undefined,
  geometryVariant: 'baseline' | 'near' | undefined,
  role: MainlineStorefrontRole | undefined,
): 'baseline' | 'near' {
  if (!geometryVariant) return 'baseline'
  if (storefront?.composition?.fixedCellCount && role !== 'door') return 'baseline'
  return geometryVariant
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
  _scene: MainlineSceneDefinition,
  storefront: MainlineStorefrontSlot,
  geometryUnits: readonly MainlineSceneGeometryUnit[] = _scene.geometry,
) {
  const labels = Array.from(storefront.label)
  if (!storefront.characterSwitch || labels.length === 0 || !(storefront.composition?.near ?? []).includes('door')) return []

  const ownedEntries = geometryUnits.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
    .filter(({ unit }) => unit.storefrontId === storefront.id && unit.sourceWallId === storefront.wallId && unit.edge === storefront.edge)
  const vertical = storefront.edge === 'left' || storefront.edge === 'right'
  const tangentCenter = (cell: MainlineSceneGeometryUnit['visual']['cells'][number]) => {
    const start = cell.cellStart ?? (vertical ? cell.y : cell.x)
    const end = cell.cellEnd ?? (vertical ? cell.y : cell.x)
    return (start + end) / 2
  }
  const baselineSigns = ownedEntries
    .filter(({ unit, cell }) => unit.variant === 'baseline' && cell.kind === 'storefront' && cell.storefrontRole === 'sign')
    .sort((a, b) => tangentCenter(a.cell) - tangentCenter(b.cell))
  const door = ownedEntries.find(({ unit, cell }) => storefront.composition?.fixedCellCount
    ? unit.variant === 'near' && cell.kind === 'storefront' && cell.storefrontRole === 'door'
    : cell.kind === 'door' && (cell.entityId === storefront.portalId || unit.entityId === storefront.portalId))
  if (!door || baselineSigns.length < labels.length) return []

  const doorTangent = vertical ? door.cell.y : door.cell.x
  const doorIndex = baselineSigns.reduce((best, entry, index) => {
    const bestDistance = Math.abs(tangentCenter(baselineSigns[best]!.cell) - doorTangent)
    const distance = Math.abs(tangentCenter(entry.cell) - doorTangent)
    return distance < bestDistance ? index : best
  }, 0)
  const cafeComposition = storefront.composition?.baseline?.length === 1 && storefront.composition.baseline[0] === 'sign'
  const localEntryCells = ownedEntries
    .filter(({ unit, cell }) => unit.id.startsWith(`${storefront.id}-base-`) && (cell.kind === 'wall' || cell.kind === 'door'))
    .sort((a, b) => tangentCenter(a.cell) - tangentCenter(b.cell))
  const useCafeEntryAnchors = cafeComposition && labels.length === 3 && localEntryCells.length === 3
    && localEntryCells.some(entry => entry.cell.kind === 'door')

  return labels.map((baselineGlyph, index) => {
    const signCell = baselineSigns[index]!.cell
    const baselineTangent = tangentCenter(signCell)
    const baselineX = vertical ? signCell.x : baselineTangent
    const baselineY = vertical ? baselineTangent : signCell.y
    const entry = useCafeEntryAnchors ? localEntryCells[index] : undefined
    const role = entry?.cell.kind === 'door' ? 'door' : index === doorIndex ? 'door' : 'wall'
    const x = entry?.cell.x ?? (role === 'door' ? door.cell.x : baselineX)
    const y = entry?.cell.y ?? (role === 'door' ? door.cell.y : baselineY)
    return {
      id: `${storefront.id}-character-${index}`,
      baselineX,
      baselineY,
      x,
      y,
      role,
      baselineGlyph,
      glyph: role === 'door' ? (door.cell.glyph ?? '\u95e8') : (entry?.cell.kind === 'wall' ? (entry.cell.glyph ?? '\u5899') : '\u5899'),
      ...(role === 'door' ? {
        entityId: door.cell.entityId ?? door.unit.entityId ?? storefront.portalId,
        access: door.cell.access,
        lockedText: door.cell.lockedText,
      } : {}),
    }
  })
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

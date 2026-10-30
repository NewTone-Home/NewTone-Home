import type { CollisionBox, Point } from './sceneGeometry'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { MainlineContinuousStructure, MainlineSceneEntity, MainlineSceneNpc } from './mainlineSceneModel'
import { mainlineInteractionRoom, mainlineReadingBounds } from './mainlineTextReading'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineEchoLayout, type MainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineReadingFontSizePx } from './mainlineTextReading'
import { splitMainlineInteractionTextToFit } from './mainlineTextSegments'
import { mainlineProtectedVisualIdentityIds } from './mainlineVisualProtection'

export type MainlineReadingOverflowPageState = { sessionKey: string; key: string; index: number; sourceOffset?: number } | null

export function mainlineReadingOverflowPageForSession(state: MainlineReadingOverflowPageState, sessionKey: string | null): MainlineReadingOverflowPageState {
  return sessionKey && state?.sessionKey === sessionKey ? state : null
}

export function mainlineReadingOverflowPageIndex(state: MainlineReadingOverflowPageState, sessionKey: string | null, key: string) {
  return sessionKey && state?.sessionKey === sessionKey && state.key === key ? state.index : 0
}

/** Reflow keeps the page containing the first character that was visible. */
export function mainlineReadingPageIndexForSourceOffset(segments: readonly string[], offset: number) {
  let start = 0
  for (let index = 0; index < segments.length; index += 1) {
    const end = start + segments[index]!.length
    if (offset < end) return index
    start = end
  }
  return Math.max(0, segments.length - 1)
}

export function currentMainlineReadingTargetIds(input: {
  readingMode: boolean
  activeObjectId?: string | null
  sceneEchoEntityId?: string
  sceneActionEntityId?: string
  dialogueTriggerEntityId?: string
  objects?: readonly MainlineSceneEntity[]
  npcs?: readonly MainlineSceneNpc[]
  continuousStructures?: readonly MainlineContinuousStructure[]
  geometry?: readonly { id: string; ownerId: string; x: number; y: number; width: number; height: number; sourceWallId?: string; entityId?: string; storefrontId?: string; readingProtection?: 'preserve'; visual: { cells: readonly { id: string; entityId?: string; storefrontId?: string }[] } }[]
  rooms?: readonly { id: string; bounds: CollisionBox }[]
  extraProtectedEntityIds?: Iterable<string>
  roomId?: string | null
  preserveServiceEntities?: boolean
}) {
  if (!input.readingMode) return new Set<string>()
  const currentTarget = input.sceneActionEntityId
    ?? input.sceneEchoEntityId
    ?? input.dialogueTriggerEntityId
    ?? input.activeObjectId
  const serviceIds = input.preserveServiceEntities
    ? (input.objects ?? []).filter(entity => entity.counterService && (!input.roomId || !entity.roomId || entity.roomId === input.roomId)).map(entity => entity.id)
    : []
  return mainlineProtectedVisualIdentityIds({
    entities: input.objects ?? [],
    npcs: input.npcs,
    structures: input.continuousStructures,
    geometry: input.geometry,
    rooms: input.rooms,
    seedIds: [...(currentTarget ? [currentTarget] : []), ...(input.extraProtectedEntityIds ?? []), ...serviceIds],
    roomId: input.roomId,
  })
}

function overlaps(first: CollisionBox, second: CollisionBox, gapX: number, gapY: number) {
  return first.x < second.x + second.width + gapX
    && first.x + first.width + gapX > second.x
    && first.y < second.y + second.height + gapY
    && first.y + first.height + gapY > second.y
}

function projectedBox(scene: MainlineSceneDefinition, box: CollisionBox, metrics: SceneScreenMetrics): CollisionBox {
  if (scene.id !== 'commercial-street') return box
  const first = projectCommercialStreetX(box.x, metrics)
  const second = projectCommercialStreetX(box.x + box.width, metrics)
  return { ...box, x: Math.min(first, second), width: Math.abs(second - first) }
}

/**
 * Keep a reading box beside its interaction target when the authored point
 * would cover that target. Candidate points are constrained to the current
 * room/corridor and current visible viewport. A null result tells the caller
 * to try a shorter page; it must never hide text or block the continue action.
 */
export function mainlinePlaceReadingBox(
  scene: MainlineSceneDefinition,
  source: Point,
  textSizePx: { width: number; height: number },
  protectedVisuals: readonly CollisionBox[],
  metrics: SceneScreenMetrics,
  worldScale: number,
  cameraOffset: Point,
  outside?: { side: 'above' | 'below'; speakerY: number },
) {
  if ((!outside && protectedVisuals.length === 0) || !(worldScale > 0)) return source
  const room = mainlineInteractionRoom(scene, source)?.bounds
  if (!room) return null
  const visible = mainlineReadingBounds(scene, source, metrics, worldScale, cameraOffset)
  const projectedRoom = projectedBox(scene, room, metrics)
  const bounds = {
    x: Math.max(projectedRoom.x, visible.x),
    y: Math.max(projectedRoom.y, visible.y),
    width: Math.max(0, Math.min(projectedRoom.x + projectedRoom.width, visible.x + visible.width) - Math.max(projectedRoom.x, visible.x)),
    height: Math.max(0, Math.min(projectedRoom.y + projectedRoom.height, visible.y + visible.height) - Math.max(projectedRoom.y, visible.y)),
  }
  const halfWidth = textSizePx.width / (sceneDesignReferenceMetrics.width * worldScale) * 50
  const halfHeight = textSizePx.height / (sceneDesignReferenceMetrics.height * worldScale) * 50
  const gapX = 4 / (sceneDesignReferenceMetrics.width * worldScale) * 100
  const gapY = 4 / (sceneDesignReferenceMetrics.height * worldScale) * 100
  const protectedBoxes = [...new Map(protectedVisuals.map(box => {
    const projected = projectedBox(scene, box, metrics)
    const key = [projected.x, projected.y, projected.width, projected.height].map(value => value.toFixed(6)).join(':')
    return [key, projected] as const
  })).values()]
  const projectX = (x: number) => scene.id === 'commercial-street' ? projectCommercialStreetX(x, metrics) : x
  const projectedSourceX = projectX(source.x)
  // mainlineReadingBounds already returns projected street X coordinates.
  const projectedBounds = bounds
  const xCandidates = new Set<number>([projectedSourceX, projectedBounds.x + halfWidth, projectedBounds.x + projectedBounds.width - halfWidth])
  const yCandidates = new Set<number>([source.y, bounds.y + halfHeight, bounds.y + bounds.height - halfHeight])
  if (outside) yCandidates.add(outside.speakerY + (outside.side === 'above' ? -halfHeight - gapY : halfHeight + gapY))
  for (const box of protectedBoxes) {
    xCandidates.add(box.x - halfWidth - gapX)
    xCandidates.add(box.x + box.width + halfWidth + gapX)
    yCandidates.add(box.y - halfHeight - gapY)
    yCandidates.add(box.y + box.height + halfHeight + gapY)
  }

  const candidates = [...xCandidates].flatMap(x => [...yCandidates].map(y => ({ x, y })))
    .filter(point => point.x - halfWidth >= projectedBounds.x - 1e-6
      && point.x + halfWidth <= projectedBounds.x + projectedBounds.width + 1e-6
      && point.y - halfHeight >= bounds.y - 1e-6
      && point.y + halfHeight <= bounds.y + bounds.height + 1e-6
      && (!outside || (outside.side === 'above' ? point.y + halfHeight <= outside.speakerY - gapY : point.y - halfHeight >= outside.speakerY + gapY)))
    .map(point => ({
      point,
      rect: { x: point.x - halfWidth, y: point.y - halfHeight, width: halfWidth * 2, height: halfHeight * 2 },
      distance: Math.hypot(point.x - projectedSourceX, point.y - source.y),
    }))
    .filter(candidate => protectedBoxes.every(box => !overlaps(candidate.rect, box, gapX, gapY)))
    .sort((first, second) => first.distance - second.distance)
  const chosen = candidates[0]?.point
  if (!chosen) return null
  if (scene.id !== 'commercial-street') return chosen
  const projectedZero = projectCommercialStreetX(0, metrics)
  const projectedHundred = projectCommercialStreetX(100, metrics)
  const projectedRange = projectedHundred - projectedZero
  return { x: Math.abs(projectedRange) < 1e-6 ? source.x : (chosen.x - projectedZero) * 100 / projectedRange, y: chosen.y }
}

export type MainlineReadingActionPlacement = {
  position: Point
  availableWidthPx: number
  availableHeightPx: number
  overflowY: boolean
}

/** Place a measured scene-action group as close as possible to its reading
 * anchor while keeping the complete scroll viewport inside the current room
 * and visible world. Width/height are measured browser pixels (so wrapping,
 * touch targets, padding and gaps are already included). */
export function mainlinePlaceReadingAction(
  scene: MainlineSceneDefinition,
  source: Point,
  measuredSizePx: { width: number; height: number },
  metrics: SceneScreenMetrics,
  worldScale: number,
  cameraOffset: Point,
): MainlineReadingActionPlacement | null {
  if (!(worldScale > 0) || !(measuredSizePx.width > 0) || !(measuredSizePx.height > 0)) return null
  const rawBounds = mainlineReadingBounds(scene, source, metrics, worldScale, cameraOffset)
  const gutterX = 12 / (sceneDesignReferenceMetrics.width * worldScale) * 100
  const gutterY = 12 / (sceneDesignReferenceMetrics.height * worldScale) * 100
  const bounds = {
    x: rawBounds.x + gutterX,
    y: rawBounds.y + gutterY,
    width: Math.max(0, rawBounds.width - gutterX * 2),
    height: Math.max(0, rawBounds.height - gutterY * 2),
  }
  const availableWidthPx = bounds.width / 100 * sceneDesignReferenceMetrics.width * worldScale
  const availableHeightPx = bounds.height / 100 * sceneDesignReferenceMetrics.height * worldScale
  if (!(availableWidthPx > 0) || !(availableHeightPx > 0)) return null

  // If the measured group is taller than this space, keep its scroll viewport
  // within the space and expose every option through vertical scrolling.
  const placedHeightPx = Math.min(measuredSizePx.height, availableHeightPx)
  const halfWidth = Math.min(measuredSizePx.width, availableWidthPx) / (sceneDesignReferenceMetrics.width * worldScale) * 50
  const halfHeight = placedHeightPx / (sceneDesignReferenceMetrics.height * worldScale) * 50
  const projectedSourceX = scene.id === 'commercial-street' ? projectCommercialStreetX(source.x, metrics) : source.x
  const clamp = (value: number, minimum: number, maximum: number) => minimum <= maximum
    ? Math.max(minimum, Math.min(maximum, value))
    : (minimum + maximum) / 2
  const projectedX = clamp(projectedSourceX, bounds.x + halfWidth, bounds.x + bounds.width - halfWidth)
  const y = clamp(source.y, bounds.y + halfHeight, bounds.y + bounds.height - halfHeight)
  const position = scene.id === 'commercial-street'
    ? (() => {
        const projectedZero = projectCommercialStreetX(0, metrics)
        const projectedHundred = projectCommercialStreetX(100, metrics)
        const range = projectedHundred - projectedZero
        return { x: Math.abs(range) < 1e-6 ? source.x : (projectedX - projectedZero) * 100 / range, y }
      })()
    : { x: projectedX, y }
  return { position, availableWidthPx, availableHeightPx, overflowY: measuredSizePx.height > availableHeightPx + .5 }
}

/**
 * Keep a scene action at the camera-space position where its reading ended,
 * while rendering it inside the world layer that already applies the current
 * camera transform. Both offsets use the same projected scene-percent space.
 */
export function mainlineReadingActionLayerPosition(position: Point, savedCameraOffset: Point, renderCameraOffset: Point): Point {
  return {
    x: position.x + savedCameraOffset.x - renderCameraOffset.x,
    y: position.y + savedCameraOffset.y - renderCameraOffset.y,
  }
}

export type MainlineReadingActionCameraAnchor = Readonly<{ actionId: number; viewportKey: string; offset: Point }>

/** Keep an action's camera anchor while the viewport is stable, but rebase it
 * to the live camera after rotation/resizing. A portrait-era offset cannot be
 * used to clamp an action into the new landscape viewport. */
export function mainlineReadingActionCameraAnchor(input: {
  previous: MainlineReadingActionCameraAnchor | null
  actionId: number
  viewportKey: string
  authoredOffset?: Point
  currentOffset: Point
}): MainlineReadingActionCameraAnchor {
  if (input.previous?.actionId === input.actionId && input.previous.viewportKey === input.viewportKey) return input.previous
  const offset = input.previous?.actionId === input.actionId ? input.currentOffset : input.authoredOffset ?? input.currentOffset
  return { actionId: input.actionId, viewportKey: input.viewportKey, offset: { ...offset } }
}

/** Find the longest first page that fits beside protected visuals and inside
 * the current room. The caller keeps the remaining pages and advances them
 * before advancing the authored dialogue/observation cursor. */
export function mainlineFitReadingText(
  scene: MainlineSceneDefinition,
  source: Point,
  text: string,
  speaker: string | undefined,
  maximumWidthPx: number,
  protectedVisuals: readonly CollisionBox[],
  metrics: SceneScreenMetrics,
  worldScale: number,
  cameraOffset: Point,
  envelopeTexts: readonly string[] = [text],
): { segments: readonly string[]; position: Point; layout: MainlineEchoLayout; maxWidthPx: number; fits: boolean } {
  const fontSizePx = mainlineReadingFontSizePx(metrics)
  const minimumWidthPx = fontSizePx * 2 + 32
  const stepPx = Math.max(4, fontSizePx / 2)
  for (let widthPx = maximumWidthPx; widthPx >= minimumWidthPx; widthPx -= stepPx) {
    const segments = splitMainlineInteractionTextToFit(text, Math.max(fontSizePx, widthPx - 40), fontSizePx)
    const first = segments[0] ?? text
    const layout = mainlineEchoLayout(first, metrics, { speaker, maxWidthPx: widthPx })
    const envelopeLayouts = envelopeTexts.map(envelope => mainlineEchoLayout(envelope, metrics, { speaker, maxWidthPx: widthPx }))
    const placementBox = {
      width: Math.max(layout.widthPx, ...envelopeLayouts.map(candidate => candidate.widthPx)),
      height: Math.max(layout.heightPx, ...envelopeLayouts.map(candidate => candidate.heightPx)),
    }
    const position = mainlinePlaceReadingBox(scene, source, placementBox, protectedVisuals, metrics, worldScale, cameraOffset)
    if (position) return { segments, position, layout, maxWidthPx: widthPx, fits: true }
  }
  const segments = splitMainlineInteractionTextToFit(text, fontSizePx, fontSizePx)
  const first = segments[0] ?? text
  const layout = mainlineEchoLayout(first, metrics, { speaker, maxWidthPx: minimumWidthPx })
  return { segments, position: source, layout, maxWidthPx: minimumWidthPx, fits: false }
}

/** Convert scene-space target bounds into mask coordinates relative to the full scene render bounds. */
export function mainlineReadingMaskRects(sceneBounds: CollisionBox, visuals: readonly CollisionBox[]) {
  if (!(sceneBounds.width > 0) || !(sceneBounds.height > 0)) return []
  const clipped = visuals.map(box => ({
    x: Math.max(0, (box.x - sceneBounds.x) / sceneBounds.width),
    y: Math.max(0, (box.y - sceneBounds.y) / sceneBounds.height),
    width: Math.max(0, Math.min(1, (box.x + box.width - sceneBounds.x) / sceneBounds.width) - Math.max(0, (box.x - sceneBounds.x) / sceneBounds.width)),
    height: Math.max(0, Math.min(1, (box.y + box.height - sceneBounds.y) / sceneBounds.height) - Math.max(0, (box.y - sceneBounds.y) / sceneBounds.height)),
  })).filter(box => box.width > 0 && box.height > 0)
  return [...new Map(clipped.map(box => [
    [box.x, box.y, box.width, box.height].map(value => value.toFixed(6)).join(':'),
    box,
  ])).values()]
}

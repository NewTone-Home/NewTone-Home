import type { CollisionBox, Point } from './sceneGeometry'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import type { MainlineSceneDefinition } from './mainlineScenes'
import { mainlineInteractionRoom, mainlineReadingBounds } from './mainlineTextReading'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineEchoLayout, type MainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineReadingFontSizePx } from './mainlineTextReading'
import { splitMainlineInteractionTextToFit } from './mainlineTextSegments'

export function currentMainlineReadingTargetIds(input: {
  readingMode: boolean
  activeObjectId?: string | null
  sceneEchoEntityId?: string
  sceneActionEntityId?: string
  dialogueTriggerEntityId?: string
}) {
  if (!input.readingMode) return new Set<string>()
  const currentTarget = input.sceneActionEntityId
    ?? input.sceneEchoEntityId
    ?? input.dialogueTriggerEntityId
    ?? input.activeObjectId
  return currentTarget ? new Set([currentTarget]) : new Set<string>()
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
) {
  if (protectedVisuals.length === 0 || !(worldScale > 0)) return source
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
      && point.y + halfHeight <= bounds.y + bounds.height + 1e-6)
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
): { segments: readonly string[]; position: Point; layout: MainlineEchoLayout; maxWidthPx: number; fits: boolean } {
  const fontSizePx = mainlineReadingFontSizePx(metrics)
  const minimumWidthPx = fontSizePx * 2 + 32
  const stepPx = Math.max(4, fontSizePx / 2)
  for (let widthPx = maximumWidthPx; widthPx >= minimumWidthPx; widthPx -= stepPx) {
    const segments = splitMainlineInteractionTextToFit(text, Math.max(fontSizePx, widthPx - 40), fontSizePx)
    const first = segments[0] ?? text
    const layout = mainlineEchoLayout(first, metrics, { speaker, maxWidthPx: widthPx })
    const position = mainlinePlaceReadingBox(scene, source, { width: layout.widthPx, height: layout.heightPx }, protectedVisuals, metrics, worldScale, cameraOffset)
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

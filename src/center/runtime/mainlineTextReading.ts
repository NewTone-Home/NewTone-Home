import type { MainlineSceneDefinition } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineVisibleWorldSpan } from './mainlineViewport'
import type { MainlineSceneDialogue, MainlineSceneDialogueLine } from './mainlineSceneModel'
import type { MainlineSceneNpc } from './mainlineSceneModel'
import { mainlineSceneRoomAtPosition } from './mainlineSceneModel'
import type { Point, CollisionBox } from './sceneGeometry'
import { projectCommercialStreetX } from './commercialStreetGridProjection'
import { mainlineMeasuredTextWidth } from './mainlineTextSegments'

/** Avoid drawing a clipped fragment when the current room/viewport cannot hold
 * even the first complete glyph. The same canvas font measurement is used by
 * the segmenter and the CSS reading surface. */
export function mainlineCanRenderFirstReadingGlyph(
  text: string,
  availableWidthPx: number,
  fontSizePx: number,
  measure = (value: string) => mainlineMeasuredTextWidth(value, fontSizePx),
) {
  if (!(availableWidthPx > 0) || !(fontSizePx > 0)) return false
  const firstGlyph = Array.from(text.trimStart())[0]
  if (!firstGlyph) return false
  const glyphWidth = measure(firstGlyph)
  return Number.isFinite(glyphWidth) && glyphWidth > 0 && availableWidthPx >= glyphWidth
}

export function mainlineReadingFontSizePx(metrics: SceneScreenMetrics) {
  if (metrics.width <= 600 && metrics.height > metrics.width) return 12
  return Math.max(16, Math.min(20, (metrics.viewportWidth ?? metrics.width) * .0135))
}

export function mainlineInteractionRoom(scene: MainlineSceneDefinition, position: Point) {
  return mainlineSceneRoomAtPosition(scene, position)
}

export function mainlineInteractionSpace(scene: MainlineSceneDefinition, position: Point): CollisionBox {
  const room = mainlineInteractionRoom(scene, position)
  if (room) return room.bounds
  if (scene.id === 'commercial-street' || scene.id === 'yonghe-mining-perimeter' || scene.id === 'yonghe-eatery') {
    return { x: position.x, y: position.y, width: 0, height: 0 }
  }
  return scene.walkBounds
}

export function mainlineIsInteriorSpace(scene: MainlineSceneDefinition, position: Point) {
  const room = mainlineInteractionRoom(scene, position)
  return Boolean(room && room.kind !== 'boundary' && room.kind !== 'corridor')
}

function projectBoundsX(scene: MainlineSceneDefinition, bounds: CollisionBox, metrics: SceneScreenMetrics) {
  if (scene.id !== 'commercial-street') return { left: bounds.x, right: bounds.x + bounds.width }
  const left = projectCommercialStreetX(bounds.x, metrics)
  const right = projectCommercialStreetX(bounds.x + bounds.width, metrics)
  return { left: Math.min(left, right), right: Math.max(left, right) }
}

/** The legal reading rectangle is the current interior/road intersected with the live viewport. */
export function mainlineReadingBounds(scene: MainlineSceneDefinition, position: Point, metrics: SceneScreenMetrics, worldScale: number, cameraOffset: Point = { x: 0, y: 0 }): CollisionBox {
  const space = mainlineInteractionSpace(scene, position)
  const span = mainlineVisibleWorldSpan({ ...metrics, projectionScale: worldScale } as SceneScreenMetrics)
  const view = { x: 50 - cameraOffset.x - span.x / 2, y: 50 - cameraOffset.y - span.y / 2, width: span.x, height: span.y }
  const projected = projectBoundsX(scene, space, metrics)
  const left = Math.max(projected.left, view.x)
  const right = Math.min(projected.right, view.x + view.width)
  const top = Math.max(space.y, view.y)
  const bottom = Math.min(space.y + space.height, view.y + view.height)
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

export function mainlineMaximumReadingWidthPx(scene: MainlineSceneDefinition, position: Point, metrics: SceneScreenMetrics, worldScale: number) {
  const space = mainlineInteractionSpace(scene, position)
  const projected = projectBoundsX(scene, space, metrics)
  const spaceWidthPx = (projected.right - projected.left) / 100 * sceneDesignReferenceMetrics.width * worldScale
  return Math.max(0, Math.min(metrics.width, spaceWidthPx) - 24)
}

/** Whether a world-anchored reading envelope would be clipped before its
 * room camera is recentered. Width is expressed in CSS pixels after projection. */
export function mainlineReadingEnvelopeNeedsCameraPan(leftWorldX: number, widthPx: number, metrics: SceneScreenMetrics, worldScale: number, cameraOffset: Point, marginPx = 12) {
  const leftPx = metrics.width / 2 + (leftWorldX + cameraOffset.x - 50) / 100 * sceneDesignReferenceMetrics.width * worldScale
  const roundingTolerancePx = 1
  return leftPx < marginPx - roundingTolerancePx || leftPx + widthPx > metrics.width - marginPx + roundingTolerancePx
}

/** Measure the current viewport/space overlap; page setup uses the maximum to avoid needless paging before a legal pan. */
export function mainlineAvailableReadingWidthPx(scene: MainlineSceneDefinition, position: Point, metrics: SceneScreenMetrics, worldScale: number, cameraOffset: Point = { x: 0, y: 0 }) {
  const bounds = mainlineReadingBounds(scene, position, metrics, worldScale, cameraOffset)
  return Math.max(0, Math.min(metrics.width, bounds.width / 100 * sceneDesignReferenceMetrics.width * worldScale) - 24)
}

export function mainlineReadingCameraOffset(scene: MainlineSceneDefinition, position: Point, metrics: SceneScreenMetrics, worldScale: number, current: Point) {
  const space = mainlineInteractionSpace(scene, position)
  const span = mainlineVisibleWorldSpan({ ...metrics, projectionScale: worldScale } as SceneScreenMetrics)
  const projected = projectBoundsX(scene, space, metrics)
  const pointX = scene.id === 'commercial-street' ? projectCommercialStreetX(position.x, metrics) : position.x
  const center = (start: number, size: number, point: number, visible: number) => size > visible
    ? Math.max(start + visible / 2, Math.min(start + size - visible / 2, point))
    : start + size / 2
  const centerX = center(projected.left, projected.right - projected.left, pointX, span.x)
  const centerY = center(space.y, space.height, position.y, span.y)
  return { x: 50 - centerX, y: 50 - centerY }
}

export type MainlineDialogueParticipantResolution = {
  npcIds: Set<string>
  unresolvedSpeakers: string[]
}

/** Resolve only actors backed by an entity ID or an unambiguous speaker label. */
export function resolveMainlineDialogueParticipants(
  scene: MainlineSceneDefinition,
  dialogue: Pick<MainlineSceneDialogue, 'triggerEntityId' | 'lines'> | null | undefined,
  currentLine?: MainlineSceneDialogueLine | null,
  npcs: readonly MainlineSceneNpc[] = scene.npcs,
): MainlineDialogueParticipantResolution {
  const npcIds = new Set<string>()
  const unresolvedSpeakers = new Set<string>()
  if (!dialogue) return { npcIds, unresolvedSpeakers: [] }

  const sourceNpc = npcs.find(npc => npc.id === dialogue.triggerEntityId || npc.interactionTargetEntityId === dialogue.triggerEntityId)
  if (sourceNpc) npcIds.add(sourceNpc.id)
  const lines = currentLine ? [...dialogue.lines, currentLine] : dialogue.lines
  lines.forEach(line => {
    if (line.speaker === '修杰') return
    if (line.speakerNpcId) {
      if (npcs.some(npc => npc.id === line.speakerNpcId)) npcIds.add(line.speakerNpcId)
      else unresolvedSpeakers.add(line.speaker)
      return
    }
    const matches = npcs.filter(npc => npc.label === line.speaker)
    if (matches.length === 1) {
      npcIds.add(matches[0]!.id)
      return
    }
    if (sourceNpc && sourceNpc.label === line.speaker) {
      npcIds.add(sourceNpc.id)
      return
    }
    unresolvedSpeakers.add(line.speaker)
  })
  return { npcIds, unresolvedSpeakers: [...unresolvedSpeakers] }
}

export function mainlineDialogueParticipantNpcIds(
  scene: MainlineSceneDefinition,
  dialogue: Pick<MainlineSceneDialogue, 'triggerEntityId' | 'lines'> | null | undefined,
  currentLine?: MainlineSceneDialogueLine | null,
  npcs: readonly MainlineSceneNpc[] = scene.npcs,
) {
  return resolveMainlineDialogueParticipants(scene, dialogue, currentLine, npcs).npcIds
}

export function mainlineReadingOpacityForActor(actorId: string, participantNpcIds: ReadonlySet<string>, localOpacity: number) {
  return participantNpcIds.has(actorId) ? 1 : localOpacity
}

export const mainlineReadingFadeTransitionMs = 400
export const mainlineObservationTypingIntervalMs = 45

export function mainlineReadingActorOpacity(point: Point, readingPoint: Point, readingBox: { widthPx: number; heightPx: number }, worldScale: number, projectedX: (value: number) => number = value => value) {
  const dx = Math.abs(projectedX(point.x) - projectedX(readingPoint.x)) / 100 * sceneDesignReferenceMetrics.width * worldScale
  const dy = Math.abs(point.y - readingPoint.y) / 100 * sceneDesignReferenceMetrics.height * worldScale
  return dx <= readingBox.widthPx / 2 + 12 && dy <= readingBox.heightPx / 2 + 12 ? .44 : 1
}

import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'

export function mainlineReadingFontSizePx(metrics: SceneScreenMetrics) {
  if (metrics.width <= 600 && metrics.height > metrics.width) return 12
  return Math.max(16, Math.min(20, (metrics.viewportWidth ?? metrics.width) * .0135))
}

function cafeRoomAt(scene: MainlineSceneDefinition, position: Point) {
  if (scene.id !== 'commercial-street') return undefined
  return scene.rooms.find(room => room.id === 'commercial-north-cafe-interior'
    && position.x >= room.bounds.x && position.x <= room.bounds.x + room.bounds.width
    && position.y >= room.bounds.y && position.y <= room.bounds.y + room.bounds.height)
}

/** Width follows the room when indoors and the measured view when outside. */
export function mainlineAvailableReadingWidthPx(scene: MainlineSceneDefinition, position: Point, metrics: SceneScreenMetrics, worldScale: number) {
  const room = cafeRoomAt(scene, position)
  const roomWidthPx = room ? room.bounds.width / 100 * sceneDesignReferenceMetrics.width * worldScale - 24 : metrics.width - 24
  return Math.max(1, Math.min(metrics.width - 24, roomWidthPx))
}

/** Extra opacity applied to static marks only. Existing visibility/reveal state
 * remains in force and is multiplied by this local reading fade. */
export function mainlineReadingStaticOpacity(point: Point, readingPoint: Point, readingBox: { widthPx: number; heightPx: number }, worldScale: number, projectedX: (value: number) => number = value => value) {
  const dx = Math.abs(projectedX(point.x) - projectedX(readingPoint.x)) / 100 * sceneDesignReferenceMetrics.width * worldScale
  const dy = Math.abs(point.y - readingPoint.y) / 100 * sceneDesignReferenceMetrics.height * worldScale
  const outsideX = Math.max(0, dx - readingBox.widthPx / 2)
  const outsideY = Math.max(0, dy - readingBox.heightPx / 2)
  const t = Math.max(0, Math.min(1, Math.hypot(outsideX, outsideY) / 88))
  return t * t * (3 - 2 * t)
}

export function mainlineReadingActorOpacity(point: Point, readingPoint: Point, readingBox: { widthPx: number; heightPx: number }, worldScale: number, projectedX: (value: number) => number = value => value) {
  const dx = Math.abs(projectedX(point.x) - projectedX(readingPoint.x)) / 100 * sceneDesignReferenceMetrics.width * worldScale
  const dy = Math.abs(point.y - readingPoint.y) / 100 * sceneDesignReferenceMetrics.height * worldScale
  return dx <= readingBox.widthPx / 2 + 12 && dy <= readingBox.heightPx / 2 + 12 ? .44 : 1
}

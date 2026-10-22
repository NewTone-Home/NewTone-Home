import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineSceneWalkBounds } from './mainlineScenes'
import { longestMainlineInteractionSegment, splitMainlineInteractionTextToFit } from './mainlineTextSegments'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineAvailableReadingWidthPx, mainlineReadingFontSizePx } from './mainlineTextReading'

export type SceneTextKind = 'observation' | 'dialogue'

/**
 * Resolve one stable scene-level reading position.  This deliberately does
 * not inspect entities, furniture, or actors other than the protagonist for
 * long-map offsets: text must not jump between interaction targets.
 */
export function sceneTextPresentationPosition(
  scene: MainlineSceneDefinition,
  protagonist: Point,
  text: string,
  screenMetrics: SceneScreenMetrics,
  kind: SceneTextKind = 'observation',
  worldScale = 1,
): Point {
  const policy = scene.presentation
  if (policy.mode === 'fixed') return policy.anchor

  const cafeRoom = scene.id === 'commercial-street' && scene.rooms.find(room => room.id === 'commercial-north-cafe-interior'
    && protagonist.x >= room.bounds.x && protagonist.x <= room.bounds.x + room.bounds.width
    && protagonist.y >= room.bounds.y && protagonist.y <= room.bounds.y + room.bounds.height)
  if (cafeRoom) {
    const bounds = cafeRoom.bounds
    if (kind === 'dialogue') return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    const maxWidthPx = mainlineAvailableReadingWidthPx(scene, protagonist, screenMetrics, worldScale)
    const segments = splitMainlineInteractionTextToFit(text, maxWidthPx, mainlineReadingFontSizePx(screenMetrics))
    const longestSegment = segments.reduce((longest, segment) => segment.length > longest.length ? segment : longest, '')
    const layout = mainlineEchoLayout(longestSegment, screenMetrics)
    const halfWidth = layout.widthPx / worldScale / sceneDesignReferenceMetrics.width * 50
    const halfHeight = layout.heightPx / worldScale / sceneDesignReferenceMetrics.height * 50
    return {
      x: Math.min(bounds.x + bounds.width - halfWidth, Math.max(bounds.x + halfWidth, protagonist.x + policy.offset.x)),
      y: Math.min(bounds.y + bounds.height - halfHeight, Math.max(bounds.y + halfHeight, protagonist.y + policy.offset.y)),
    }
  }

  if (policy.readingRail) {
    const maxWidthPx = mainlineAvailableReadingWidthPx(scene, protagonist, screenMetrics, worldScale)
    const segments = splitMainlineInteractionTextToFit(text, maxWidthPx, mainlineReadingFontSizePx(screenMetrics))
    const longestSegment = segments.reduce((longest, segment) => segment.length > longest.length ? segment : longest, '')
    const layout = mainlineEchoLayout(longestSegment, screenMetrics)
    const halfWidth = layout.widthPx / worldScale / sceneDesignReferenceMetrics.width * 50
    const right = protagonist.x + halfWidth + policy.readingRail.gap
    const left = protagonist.x - halfWidth - policy.readingRail.gap
    const fitsRight = right - halfWidth >= policy.readingRail.minX && right + halfWidth <= policy.readingRail.maxX
    const x = fitsRight
      ? right
      : Math.min(policy.readingRail.maxX - halfWidth, Math.max(policy.readingRail.minX + halfWidth, left))
    return { x, y: policy.readingRail.centerY }
  }

  const bounds = mainlineSceneWalkBounds(scene, screenMetrics)
  const maxWidthPx = mainlineAvailableReadingWidthPx(scene, protagonist, screenMetrics, worldScale)
  const segments = splitMainlineInteractionTextToFit(text, maxWidthPx, mainlineReadingFontSizePx(screenMetrics))
  const longestSegment = segments.reduce((longest, segment) => segment.length > longest.length ? segment : longest, '')
  const layout = mainlineEchoLayout(longestSegment || longestMainlineInteractionSegment(text), screenMetrics)
  const halfWidth = layout.widthPx / worldScale / sceneDesignReferenceMetrics.width * 50
  const halfHeight = layout.heightPx / worldScale / sceneDesignReferenceMetrics.height * 50
  return {
    x: Math.min(bounds.x + bounds.width - halfWidth, Math.max(bounds.x + halfWidth, protagonist.x + policy.offset.x)),
    y: Math.min(bounds.y + bounds.height - halfHeight, Math.max(bounds.y + halfHeight, protagonist.y + policy.offset.y)),
  }
}

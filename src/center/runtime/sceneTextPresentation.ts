import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { longestMainlineInteractionSegment, splitMainlineInteractionTextToFit } from './mainlineTextSegments'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineInteractionRoom, mainlineInteractionSpace, mainlineMaximumReadingWidthPx, mainlineReadingBounds, mainlineReadingCameraOffset, mainlineReadingFontSizePx } from './mainlineTextReading'

export type SceneTextKind = 'observation' | 'dialogue'

function boundedCenter(value: number, start: number, size: number, halfSize: number) {
  if (size <= 0) return start
  if (size <= halfSize * 2) return start + size / 2
  return Math.max(start + halfSize, Math.min(start + size - halfSize, value))
}

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
  cameraOffset?: Point,
): Point {
  const policy = scene.presentation
  const currentRoom = mainlineInteractionRoom(scene, protagonist)
  const space = mainlineInteractionSpace(scene, protagonist)
  const hasAuthoredTextSpace = Boolean(currentRoom)
  const resolvedCameraOffset = cameraOffset ?? mainlineReadingCameraOffset(scene, protagonist, screenMetrics, worldScale, { x: 0, y: 0 })
  const panBounds = mainlineReadingBounds(scene, protagonist, screenMetrics, worldScale, resolvedCameraOffset)
  const bounds = {
    x: Math.max(space.x, panBounds.x), y: Math.max(space.y, panBounds.y),
    width: Math.max(0, Math.min(space.x + space.width, panBounds.x + panBounds.width) - Math.max(space.x, panBounds.x)),
    height: Math.max(0, Math.min(space.y + space.height, panBounds.y + panBounds.height) - Math.max(space.y, panBounds.y)),
  }
  const maxWidthPx = mainlineMaximumReadingWidthPx(scene, protagonist, screenMetrics, worldScale)
  const segments = splitMainlineInteractionTextToFit(text, maxWidthPx, mainlineReadingFontSizePx(screenMetrics))
  const longestSegment = segments.reduce((longest, segment) => segment.length > longest.length ? segment : longest, '')
  const layout = mainlineEchoLayout(longestSegment || longestMainlineInteractionSegment(text), screenMetrics)
  const halfWidth = layout.widthPx / worldScale / sceneDesignReferenceMetrics.width * 50
  const halfHeight = layout.heightPx / worldScale / sceneDesignReferenceMetrics.height * 50

  if (kind === 'dialogue' && hasAuthoredTextSpace && currentRoom?.id !== 'commercial-street-public-lane') {
    return {
      x: boundedCenter(space.x + space.width / 2, space.x, space.width, halfWidth),
      y: boundedCenter(space.y + space.height / 2, space.y, space.height, halfHeight),
    }
  }

  if (kind === 'dialogue' && policy.mode === 'actor-relative' && policy.readingRail && currentRoom?.id === 'commercial-street-public-lane') {
    const right = protagonist.x + halfWidth + policy.readingRail.gap
    const left = protagonist.x - halfWidth - policy.readingRail.gap
    const fitsRight = right - halfWidth >= policy.readingRail.minX && right + halfWidth <= policy.readingRail.maxX
    const railX = fitsRight
      ? right
      : Math.min(policy.readingRail.maxX - halfWidth, Math.max(policy.readingRail.minX + halfWidth, left))
    const x = boundedCenter(railX, bounds.x, bounds.width, halfWidth)
    const y = boundedCenter(policy.readingRail.centerY, space.y, space.height, 0)
    return { x, y }
  }

  const actorOffset = policy.mode === 'actor-relative' ? policy.offset : { x: 0, y: 0 }
  const anchor = kind === 'observation'
    ? { x: protagonist.x + actorOffset.x, y: protagonist.y + actorOffset.y }
    : policy.mode === 'fixed' ? policy.anchor : { x: protagonist.x + actorOffset.x, y: protagonist.y + actorOffset.y }
  const placementBounds = hasAuthoredTextSpace ? space : bounds
  return {
    x: boundedCenter(anchor.x, placementBounds.x, placementBounds.width, halfWidth),
    y: boundedCenter(anchor.y, placementBounds.y, placementBounds.height, halfHeight),
  }
}

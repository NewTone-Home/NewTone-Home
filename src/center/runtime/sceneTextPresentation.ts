import type { Point } from './sceneGeometry'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineEchoLayout } from './mainlineEchoLayout'
import { mainlineSceneWalkBounds } from './mainlineScenes'

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
): Point {
  const policy = scene.presentation
  if (policy.mode === 'fixed') return policy.anchor

  if (policy.readingRail) {
    const layout = mainlineEchoLayout(text, screenMetrics)
    const halfWidth = (layout.widthPx / screenMetrics.width) * 50
    const right = protagonist.x + halfWidth + policy.readingRail.gap
    const left = protagonist.x - halfWidth - policy.readingRail.gap
    const fitsRight = right - halfWidth >= policy.readingRail.minX && right + halfWidth <= policy.readingRail.maxX
    const x = fitsRight
      ? right
      : Math.min(policy.readingRail.maxX - halfWidth, Math.max(policy.readingRail.minX + halfWidth, left))
    return { x, y: policy.readingRail.centerY }
  }

  const bounds = mainlineSceneWalkBounds(scene, screenMetrics)
  const layout = mainlineEchoLayout(text, screenMetrics)
  const halfWidth = (layout.widthPx / screenMetrics.width) * 50
  const halfHeight = (layout.heightPx / screenMetrics.height) * 50
  return {
    x: Math.min(bounds.x + bounds.width - halfWidth, Math.max(bounds.x + halfWidth, protagonist.x + policy.offset.x)),
    y: Math.min(bounds.y + bounds.height - halfHeight, Math.max(bounds.y + halfHeight, protagonist.y + policy.offset.y)),
  }
}

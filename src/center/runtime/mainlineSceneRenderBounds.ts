import { mainlineWorldFontSizePx, sceneDesignReferenceMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneWalkBounds, type MainlineSceneDefinition } from './mainlineScenes'
import { mainlineEntityVisualBounds, mainlineEntityFontSizePx, type SceneLayout } from './sceneLayout'
import type { CollisionBox } from './sceneGeometry'

function isFiniteBounds(bounds: CollisionBox | null | undefined): bounds is CollisionBox {
  return Boolean(bounds
    && Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width >= 0
    && bounds.height >= 0)
}

/** Full design-space extent from rendered geometry; not clipped to the camera or device viewport. */
export function mainlineSceneRenderBounds(
  scene: MainlineSceneDefinition,
  layout: SceneLayout = {},
  screenMetrics: SceneScreenMetrics = sceneDesignReferenceMetrics,
  horizontalGridScale = 1,
): CollisionBox {
  const objectVisualBounds = scene.objects.map(entity => mainlineEntityVisualBounds(scene, entity, layout, screenMetrics))
  const geometryUnits = mainlineCanonicalSceneGeometryUnits(scene, screenMetrics)
  const glyphHalfWidth = mainlineEntityFontSizePx(null, screenMetrics) / Math.max(.01, horizontalGridScale) / sceneDesignReferenceMetrics.width * 50
  const glyphHalfHeight = mainlineWorldFontSizePx / sceneDesignReferenceMetrics.height * 50
  const glyphBounds = geometryUnits.flatMap(unit => unit.visual.cells.map(cell => ({
    x: cell.x - glyphHalfWidth,
    y: cell.y - glyphHalfHeight,
    width: glyphHalfWidth * 2,
    height: glyphHalfHeight * 2,
  })))
  const boxes = [
    mainlineSceneWalkBounds(scene, screenMetrics),
    ...scene.rooms.map((room) => room.bounds),
    ...scene.continuousStructures,
    ...geometryUnits,
    ...glyphBounds,
    ...objectVisualBounds,
  ].filter(isFiniteBounds)

  const left = Math.min(...boxes.map((bounds) => bounds.x))
  const top = Math.min(...boxes.map((bounds) => bounds.y))
  const right = Math.max(...boxes.map((bounds) => bounds.x + bounds.width))
  const bottom = Math.max(...boxes.map((bounds) => bounds.y + bounds.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

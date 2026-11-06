import { describe, expect, it } from 'vitest'
import { mainlineSceneRenderBounds } from '../src/center/runtime/mainlineSceneRenderBounds'
import { sceneDesignReferenceMetrics, type SceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineCanonicalSceneGeometryUnits, mainlineSceneWalkBounds, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineWorldFontSizePx } from '../src/center/runtime/sceneBoundaryGrid'

describe('mainline scene render bounds', () => {
  it('covers negative and beyond-frame scene geometry without depending on viewport dimensions', () => {
    const source = mainlineScenes['commercial-street']
    const scene = {
      ...source,
      walkBounds: { x: -18, y: -7, width: 136, height: 118 },
      rooms: [],
      structures: [],
      storefronts: [],
      continuousStructures: [],
      blockers: [],
      airWalls: [],
      curves: [],
      geometry: [],
      passages: [],
      objects: [],
    }

    expect(mainlineSceneRenderBounds(scene)).toEqual({ x: -18, y: -7, width: 136, height: 118 })
  })

  it('covers a scene that extends beyond both its walk rectangle and its interior room', () => {
    const source = mainlineScenes['commercial-street']
    const scene = {
      ...source,
      walkBounds: { x: 0, y: 0, width: 100, height: 100 },
      rooms: [{ id: 'room', bounds: { x: 12, y: 14, width: 30, height: 24 } }],
      structures: [],
      continuousStructures: [{ id: 'wide-counter', kind: 'counter' as const, x: 125, y: 45, width: 30, height: 6 }],
      blockers: [],
      curves: [],
      geometry: [],
      objects: [],
    }

    const bounds = mainlineSceneRenderBounds(scene)
    expect(bounds.x).toBeLessThanOrEqual(0)
    expect(bounds.y).toBeLessThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(155)
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(100)
  })

  it('uses screen-projected geometry and includes the rendered wall-glyph half-size', () => {
    const screenMetrics: SceneScreenMetrics = { width: 390, height: 844 }
    const scene = Object.values(mainlineScenes).find(candidate => candidate.structures.some(structure => structure.boundaryProjection === 'screen-spacing'))!
    const units = mainlineCanonicalSceneGeometryUnits(scene, screenMetrics)
    const walkBounds = mainlineSceneWalkBounds(scene, screenMetrics)
    const bounds = mainlineSceneRenderBounds(scene, {}, screenMetrics)
    const halfGlyphWidth = mainlineWorldFontSizePx / sceneDesignReferenceMetrics.width * 50
    const halfGlyphHeight = mainlineWorldFontSizePx / sceneDesignReferenceMetrics.height * 50
    const renderedGlyphs = units.flatMap(unit => unit.visual.cells)

    expect(renderedGlyphs.length).toBeGreaterThan(0)
    expect(bounds.x).toBeLessThanOrEqual(Math.min(walkBounds.x, ...units.map(unit => unit.x), ...renderedGlyphs.map(cell => cell.x - halfGlyphWidth)))
    expect(bounds.y).toBeLessThanOrEqual(Math.min(walkBounds.y, ...units.map(unit => unit.y), ...renderedGlyphs.map(cell => cell.y - halfGlyphHeight)))
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(Math.max(walkBounds.x + walkBounds.width, ...units.map(unit => unit.x + unit.width), ...renderedGlyphs.map(cell => cell.x + halfGlyphWidth)))
    expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(Math.max(walkBounds.y + walkBounds.height, ...units.map(unit => unit.y + unit.height), ...renderedGlyphs.map(cell => cell.y + halfGlyphHeight)))
  })
})

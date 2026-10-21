import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineCanonicalSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { wallVisualCoverage } from './helpers/wallVisualCoverage'

describe('wall coverage counts actual shared-owner paint rather than relaxing gap tolerances', () => {
  const scene = mainlineScenes['yonghe-mining-perimeter']
  const units = mainlineCanonicalSceneGeometryUnits(scene, { width: 1920, height: 1080 })
  it('counts the storefront baseline composition in the physical facade', () => {
    const edge = wallVisualCoverage(scene, units).find(e => e.key === 'mining-street-facade:right')!
    expect(edge.maxGap).toBeLessThanOrEqual(28.01)
  })
  it('recognizes a corner painted by the adjacent shop but detects removal of that exact glyph', () => {
    const key = 'mining-shop-2-interior-shell:left'
    const wall = scene.structures.find(w => w.id === 'mining-shop-2-interior-shell')!
    const corner = wall.bounds!
    expect(wallVisualCoverage(scene, units).find(e => e.key === key)!.startDistance).toBeLessThan(.001)
    const missing = units.map(unit => ({ ...unit, visual: { ...unit.visual, cells: unit.visual.cells.map(cell => Math.abs(cell.x - corner.x) < .00001 && Math.abs(cell.y - corner.y) < .00001 ? { ...cell, glyph: '' } : cell) } }))
    expect(wallVisualCoverage(scene, missing).find(e => e.key === key)!.startDistance).toBeGreaterThanOrEqual(27.99)
  })
})

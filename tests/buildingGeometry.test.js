import { describe, expect, it } from 'vitest'
import { DETAIL_PROTOTYPE } from '../src/center/geometry/detailPrototype'

describe('Center building geometry generator', () => {
  it('creates a non-rectangular civic building graph with separate structural layers', () => {
    const building = DETAIL_PROTOTYPE.interactiveBuildings.find(item => item.entityId === 'memory-archive')
    expect(building?.geometry).toBeTruthy()
    expect(building.geometry.style).toBe('civic')
    expect(building.geometry.stats.footprintVertices).toBeGreaterThan(4)
    expect(building.geometry.stats.pathCount).toBeGreaterThan(100)
    expect(building.geometry.layers.primary).toMatch(/^M/)
    expect(building.geometry.layers.window).toMatch(/^M/)
    expect(building.geometry.layers.roof).toMatch(/^M/)
  })

  it('keeps the generated footprint and hit region deterministic', () => {
    const archive = DETAIL_PROTOTYPE.interactiveBuildings.find(item => item.entityId === 'memory-archive')
    const market = DETAIL_PROTOTYPE.interactiveBuildings.find(item => item.entityId === 'crossing-market')
    expect(archive.geometry.footprint).not.toEqual(market.geometry.footprint)
    expect(archive.geometry.hitPath).toMatch(/^M/)
    expect(archive.geometry.layers.balcony).toMatch(/^M/)
  })
})

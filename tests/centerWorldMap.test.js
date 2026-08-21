import { describe, expect, it } from 'vitest'
import {
  WORLD_MAP_BOUNDARY,
  WORLD_MAP_CITIES,
  WORLD_MAP_INTERACTIVE_IDS,
  WORLD_MAP_MOUNTAINS,
  WORLD_MAP_NODES,
  WORLD_MAP_REGIONS,
  WORLD_MAP_ROUTES,
} from '../src/center/data/centerWorldMap'
import { PROCEDURAL_TERRAIN } from '../src/center/geometry/proceduralTerrain'
import {
  worldFootprint,
  worldGridPath,
  worldProjectPoint,
  worldTerrainHeight,
  worldTerrainPoint,
} from '../src/center/geometry/worldMap'

describe('Center procedural world map', () => {
  it('derives a dense line-art field from one deterministic terrain source', () => {
    expect(PROCEDURAL_TERRAIN.contours.length).toBeGreaterThanOrEqual(18)
    expect(PROCEDURAL_TERRAIN.network).toHaveLength(3)
    expect(PROCEDURAL_TERRAIN.network.every(layer => layer.d.startsWith('M'))).toBe(true)
    expect(PROCEDURAL_TERRAIN.boundary.length).toBeGreaterThanOrEqual(64)
    expect(PROCEDURAL_TERRAIN.ridgeLines.length).toBeGreaterThan(12)
    expect(PROCEDURAL_TERRAIN.flowLines.length).toBeGreaterThan(12)
    expect(PROCEDURAL_TERRAIN.points.length).toBeGreaterThan(100)
  })

  it('keeps the demo scene explicit, small, and extensible', () => {
    expect(WORLD_MAP_BOUNDARY.length).toBeGreaterThanOrEqual(10)
    expect(WORLD_MAP_REGIONS).toHaveLength(3)
    expect(WORLD_MAP_ROUTES).toHaveLength(4)
    expect(WORLD_MAP_MOUNTAINS).toHaveLength(3)
    expect(WORLD_MAP_CITIES.length).toBeGreaterThanOrEqual(3)
    expect(WORLD_MAP_NODES.length).toBeGreaterThanOrEqual(10)
  })

  it('binds interactive graph nodes to the existing Center entity graph', () => {
    const nodeEntityIds = WORLD_MAP_NODES.map(node => node.entityId).filter(Boolean)
    expect(nodeEntityIds).toEqual(expect.arrayContaining(WORLD_MAP_INTERACTIVE_IDS))
    for (const node of WORLD_MAP_NODES) {
      for (const connection of node.connections) expect(WORLD_MAP_NODES.some(candidate => candidate.id === connection)).toBe(true)
    }
  })

  it('projects height data into a stable isometric coordinate system', () => {
    const ground = worldProjectPoint(4, 4, 0)
    const elevated = worldTerrainPoint(4, 4)
    expect(elevated[1]).toBeLessThan(ground[1])
    expect(worldTerrainHeight(4, 4)).toBe(worldTerrainHeight(4, 4))
    expect(worldGridPath('x', 4)).toMatch(/^M/)
    expect(worldGridPath('y', 4)).toMatch(/L/)
  })

  it('keeps the fine-detail field dense without exposing a DOM edge per segment', () => {
    expect(PROCEDURAL_TERRAIN.detailNetwork.startsWith('M')).toBe(true)
    expect(PROCEDURAL_TERRAIN.mountainRelief.startsWith('M')).toBe(true)
    expect(PROCEDURAL_TERRAIN.hydrology.banks.length).toBeGreaterThanOrEqual(4)
    expect(PROCEDURAL_TERRAIN.detailPoints.length).toBeGreaterThan(500)
  })

  it('generates line-only settlement volumes from data', () => {
    const footprint = worldFootprint([[2, 2], [2.4, 2], [2.4, 2.4], [2, 2.4]], 1.4)
    expect(footprint.ground).toMatch(/^M/)
    expect(footprint.top).toMatch(/^M/)
    expect(footprint.verticals.split(' M')).toHaveLength(4)
  })
})

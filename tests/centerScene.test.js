import { describe, expect, it } from 'vitest'
import {
  CENTER_BUILDINGS,
  CENTER_ENTITIES,
  CENTER_NEWS,
  CENTER_PARCELS,
  CENTER_REGIONS,
  CENTER_STATIC_MASSINGS,
  CENTER_URBAN_DETAILS,
  getCenterEntity,
} from '../src/center/data/centerScene'
import { buildingGeometry, projectPoint } from '../src/center/geometry/isometric'
import { buildingFacadeGeometry, buildingRoofGeometry } from '../src/center/geometry/scenePrimitives'

describe('Center scene graph data', () => {
  it('keeps the demo deliberately small while exposing extensible entity records', () => {
    expect(CENTER_REGIONS).toHaveLength(3)
    expect(CENTER_BUILDINGS.length).toBeGreaterThanOrEqual(6)
    expect(CENTER_BUILDINGS.length).toBeLessThanOrEqual(12)
    expect(CENTER_ENTITIES.filter(entity => entity.interactive).length).toBeGreaterThanOrEqual(5)
    for (const entity of CENTER_ENTITIES) {
      expect(entity.id).toBeTruthy()
      expect(entity.entityType).toBeTruthy()
      expect(entity.links).toBeTruthy()
    }
  })

  it('binds every news item to a real map entity', () => {
    for (const item of CENTER_NEWS) expect(getCenterEntity(item.entityId)).toBeTruthy()
  })

  it('projects building roofs, faces, and anchors into one coordinate system', () => {
    const geometry = buildingGeometry(CENTER_BUILDINGS[0])
    expect(geometry.roof).toMatch(/^M/)
    expect(geometry.eastFace).toMatch(/^M/)
    expect(geometry.westFace).toMatch(/^M/)
    expect(geometry.anchor).toHaveLength(2)
    expect(projectPoint(2, 2, 1)[1]).toBeLessThan(projectPoint(2, 2, 0)[1])
  })

  it('keeps place-making detail data separate from the interactive world-entity graph', () => {
    expect(CENTER_PARCELS.length).toBeGreaterThanOrEqual(8)
    expect(CENTER_STATIC_MASSINGS.length).toBeGreaterThanOrEqual(10)
    expect(CENTER_URBAN_DETAILS.length).toBeGreaterThanOrEqual(12)
    expect(CENTER_ENTITIES.some(entity => entity.id === CENTER_STATIC_MASSINGS[0].id)).toBe(false)
    expect(CENTER_BUILDINGS.every(building => building.visual?.roof && building.visual?.facade)).toBe(true)
  })

  it('generates facade and roof detail from a building visual descriptor', () => {
    const archive = CENTER_BUILDINGS.find(building => building.id === 'memory-archive')
    const facade = buildingFacadeGeometry(archive)
    const roof = buildingRoofGeometry(archive)

    expect(facade.east.vertical.length).toBeGreaterThan(0)
    expect(facade.west.horizontal.length).toBeGreaterThan(0)
    expect(roof.faces.length).toBe(2)
    expect(roof.lines.length).toBeGreaterThan(0)
  })
})

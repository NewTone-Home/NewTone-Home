import { describe, expect, it } from 'vitest'
import {
  CENTER_BUILDINGS,
  CENTER_ENTITIES,
  CENTER_NEWS,
  CENTER_REGIONS,
  getCenterEntity,
} from '../src/center/data/centerScene'
import { buildingGeometry, projectPoint } from '../src/center/geometry/isometric'

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
})


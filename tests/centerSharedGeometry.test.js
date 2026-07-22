import { describe, expect, it } from 'vitest'
import { centerMiniLandmarks, centerWorld } from '../src/data/center/centerWorld'
import { CENTER_WORLD_VIEWBOX, sharedWorldGeometry } from '../src/data/center/sharedWorldGeometry'

describe('Center shared world geometry', () => {
  it('keeps one coordinate system for both world renderers', () => {
    expect(sharedWorldGeometry.viewBox).toBe(CENTER_WORLD_VIEWBOX)
    expect(CENTER_WORLD_VIEWBOX).toBe('0 0 1000 360')
  })

  it('contains the required shared skeleton', () => {
    expect(sharedWorldGeometry.roads.map(item => item.id)).toEqual(expect.arrayContaining([
      'main-arterial',
      'estate-link',
      'council-axis',
    ]))
    expect(sharedWorldGeometry.districts.map(item => item.id)).toEqual(expect.arrayContaining([
      'main-city-boundary',
      'jijia-block',
      'council-precinct',
      'mine-fringe',
      'north-blank',
      'south-blank',
    ]))
    expect(sharedWorldGeometry.infrastructure.map(item => item.id)).toEqual(expect.arrayContaining([
      'overpass',
      'drainage',
      'underground-pipeline',
      'mine-direction',
    ]))
  })

  it('defines every landmark from fixed x/y/scale anchors', () => {
    expect(Object.keys(sharedWorldGeometry.anchors)).toEqual(['jijia', 'council', 'mainCity', 'mine'])

    Object.values(sharedWorldGeometry.anchors).forEach(anchor => {
      expect(anchor.x).toBeTypeOf('number')
      expect(anchor.y).toBeTypeOf('number')
      expect(anchor.scale).toBeGreaterThan(0)
    })
  })

  it('keeps surface and inner council nodes on one coordinate', () => {
    const surfaceCouncil = centerWorld['surface-council']
    const innerCouncil = centerWorld['inner-council']

    expect(surfaceCouncil.x).toBe(innerCouncil.x)
    expect(surfaceCouncil.y).toBe(innerCouncil.y)
    expect(surfaceCouncil.width).toBe(innerCouncil.width)
    expect(surfaceCouncil.height).toBe(innerCouncil.height)
    expect(surfaceCouncil.x).toBe(sharedWorldGeometry.anchors.council.x / 10)
    expect(surfaceCouncil.y).toBeCloseTo(sharedWorldGeometry.anchors.council.y / 3.6, 0)
  })

  it('binds every mini landmark to an existing node and shared anchor', () => {
    Object.values(centerMiniLandmarks).forEach(config => {
      expect(centerWorld[config.nodeId]).toBeDefined()
      expect(sharedWorldGeometry.anchors[config.anchorId]).toBeDefined()
      expect(centerWorld[config.nodeId].world).toBe(config.world)
    })
  })
})

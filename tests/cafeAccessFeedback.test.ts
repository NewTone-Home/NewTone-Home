import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { resolveMainlineWorldNavigation, resolveMainlineNpcPosition, canTravelAlongMainlineSegment, mainlineNavigationCollisionBoxes, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineNpcLabelFootprint } from '../src/center/runtime/sceneLayout'

const scene = mainlineScenes['commercial-street']
const staff = scene.accessRegions.find(r => r.id === 'commercial-cafe-staff-area')!
const front = scene.passages.find(p => p.id === 'street-cafe-entry')!
const options = { screenMetrics: sceneDesignReferenceMetrics, actorId: 'protagonist', actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 } }
const requested = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }

describe('Cafe trial retains real work-opening access feedback', () => {
  for (const actorId of ['protagonist', 'cafe-floor-server']) it(`${actorId} retains the raw denied request and a legal public-side path`, () => {
    const from = actorId === 'protagonist' ? front.crossingTargets[0] : resolveMainlineNpcPosition(scene, actorId)
    const body = actorId === 'protagonist' ? options.actorFootprint : mainlineNpcLabelFootprint(scene, actorId, from, sceneDesignReferenceMetrics)
    const query = { ...options, actorId, actorFootprint: { width: body.width, height: body.height } }
    const result = resolveMainlineWorldNavigation(scene, from, requested, {}, query)!
    expect(result.requestedTarget).toEqual(requested)
    expect(result.reachedRequestedTarget).toBe(false)
    expect(result.deniedAccessRegion?.id).toBe(staff.id)
    expect(result.path.at(-1)).toEqual(result.resolvedNavigableTarget)
    for (let i = 1; i < result.path.length; i++) expect(canTravelAlongMainlineSegment(result.path[i - 1], result.path[i], scene, {}, query)).toBe(true)
  })
  it('still allows the authorized coffee owner to enter through the same physical opening', () => {
    const from = resolveMainlineNpcPosition(scene, 'cafe-coffee-owner')
    const result = resolveMainlineWorldNavigation(scene, from, requested, {}, { ...options, actorId: 'cafe-coffee-owner' })!
    expect(result.reachedRequestedTarget).toBe(true)
    expect(result.resolvedNavigableTarget).toEqual(requested)
    expect(result.deniedAccessRegion).toBeUndefined()
  })
  it('declares the actual bottom and rear-right work openings, without adding a region-sized collision body', () => {
    expect(scene.accessBoundaries.filter(b => b.regionId === staff.id)).toEqual([{ id: 'commercial-cafe-staff-bottom-access-boundary', regionId: staff.id, edge: 'bottom' }])
    expect(scene.accessBoundaries.find(b => b.regionId === 'cafe-trial-rear-work-area')?.edge).toBe('right')
    for (const region of scene.accessRegions.filter(r => r.id.includes('cafe'))) expect(mainlineNavigationCollisionBoxes(scene, {}, options).some(b => b.x === region.x && b.y === region.y && b.width === region.width && b.height === region.height)).toBe(false)
  })
  it('does not extend the rear-right permission edge through unrelated northern shops', () => {
    for (const slot of [2, 3, 4, 5, 6]) {
      const front = scene.passages.find(p => p.id === `commercial-north-slot-${slot}-entry`)!
      const rear = scene.objects.find(o => o.id === `${front.toRoomId}-rear-door`)!
      const point = { x: rear.position.x, y: rear.position.y + 5 }
      expect(isWalkableMainlinePoint(point, scene, {}, options), `shop ${slot} is outside the Cafe permission region`).toBe(true)
    }
    const publicPoint = { x: staff.x + staff.width / 2, y: staff.y + staff.height + 3 }
    const insidePoint = { ...publicPoint, y: staff.y + staff.height - 3 }
    expect(canTravelAlongMainlineSegment(publicPoint, insidePoint, scene, {}, options)).toBe(false)
  })
})

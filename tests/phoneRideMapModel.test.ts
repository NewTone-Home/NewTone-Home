import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineRideZones } from '../src/center/runtime/mainlineRide'
import { phoneRideMapTargetZones } from '../src/center/runtime/phoneRideMapModel'

describe('Ride local map target zones', () => {
  for (const rideZone of mainlineRideZones) {
    it('uses authored pickup exits and passages for ' + rideZone.pickupSceneId, () => {
      for (const sceneId of rideZone.scenes) {
        const scene = mainlineScenes[sceneId]
        const zones = phoneRideMapTargetZones(scene, sceneId, rideZone.pickupSceneId)
        const expectedCount = sceneId === rideZone.pickupSceneId
          ? scene.externalExits.length
          : Number(scene.passages.some((passage) => passage.targetSceneId === rideZone.pickupSceneId))
        expect(expectedCount).toBeGreaterThan(0)
        expect(zones).toHaveLength(expectedCount)
        for (const zone of zones) {
          expect(zone.bounds.width).toBeGreaterThan(0)
          expect(zone.bounds.height).toBeGreaterThan(0)
          expect(Number.isFinite(zone.bounds.x + zone.bounds.y + zone.bounds.width + zone.bounds.height)).toBe(true)
          expect(zone.fillBounds.width).toBeGreaterThan(0)
          expect(zone.fillBounds.height).toBeGreaterThan(0)
        }
      }
    })
  }

  it('matches local targets to each scene’s Ride-valid exits', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const street = mainlineScenes['commercial-street']
    const cafe = mainlineScenes['commercial-cafe']
    expect(office.externalExits).toHaveLength(2)
    expect(phoneRideMapTargetZones(office, 'zhongshuyuan-office', 'zhongshuyuan-office')).toHaveLength(2)
    expect(street.externalExits).toHaveLength(1)
    expect(phoneRideMapTargetZones(street, 'commercial-street', 'commercial-street')).toHaveLength(1)
    const cafeRidePassages = cafe.passages.filter((passage) => passage.targetSceneId === 'commercial-street' && passage.access === 'open')
    expect(cafeRidePassages).toHaveLength(1)
    expect(phoneRideMapTargetZones(cafe, 'commercial-cafe', 'commercial-street')).toHaveLength(1)
  })

  it('keeps the Street pickup target at the formal exit and limits fill to its nearby ground patch', () => {
    const scene = mainlineScenes['commercial-street']
    const exit = scene.externalExits[0]
    const zone = phoneRideMapTargetZones(scene, 'commercial-street', 'commercial-street')[0]
    const lane = scene.structures.find((structure) => structure.id === 'commercial-main-lane')!
    expect(zone.bounds.x + zone.bounds.width / 2).toBeCloseTo(exit.threshold)
    expect(zone.bounds.y + zone.bounds.height / 2).toBeCloseTo(scene.initialPlayerPosition.y)
    expect(zone.bounds.width).toBe(2)
    expect(zone.bounds.height).toBe(2)
    expect(zone.fillBounds.height).toBeCloseTo(lane.bounds.height)
    expect(zone.fillBounds.width).toBeCloseTo(lane.bounds.height / 2)
    expect(zone.fillBounds.x + zone.fillBounds.width).toBeLessThan(100)
    expect(zone.fillBounds.x).toBeCloseTo(scene.externalExits[0]!.threshold)
    expect(zone.fillBounds).not.toEqual(zone.bounds)
  })

  it('fills a small patch at each real Office pickup exit', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const zones = phoneRideMapTargetZones(scene, 'zhongshuyuan-office', 'zhongshuyuan-office')
    expect(zones).toHaveLength(scene.externalExits.length)
    const corridor = scene.rooms.find((room) => room.id === 'zhongshuyuan-office-corridor')!
    const [leftZone, rightZone] = zones
    const [leftExit, rightExit] = scene.externalExits
    expect(leftZone!.id).toContain('left-endpoint')
    expect(rightZone!.id).toContain('right-endpoint')
    expect(leftZone!.bounds.x + leftZone!.bounds.width / 2).toBeCloseTo(leftExit!.threshold)
    expect(rightZone!.bounds.x + rightZone!.bounds.width / 2).toBeCloseTo(rightExit!.threshold)
    expect(leftZone!.bounds.y + leftZone!.bounds.height / 2).toBeCloseTo((leftExit!.triggerSpan!.start + leftExit!.triggerSpan!.end) / 2)
    expect(rightZone!.bounds.y + rightZone!.bounds.height / 2).toBeCloseTo((rightExit!.triggerSpan!.start + rightExit!.triggerSpan!.end) / 2)
    expect(leftZone!.bounds.width).toBe(2)
    expect(leftZone!.bounds.height).toBe(2)
    expect(rightZone!.bounds.width).toBe(2)
    expect(rightZone!.bounds.height).toBe(2)
    expect(leftZone!.fillBounds.height).toBeCloseTo(leftExit!.triggerSpan!.end - leftExit!.triggerSpan!.start)
    expect(rightZone!.fillBounds.height).toBeCloseTo(rightExit!.triggerSpan!.end - rightExit!.triggerSpan!.start)
    expect(leftZone!.fillBounds.width).toBeCloseTo((leftExit!.triggerSpan!.end - leftExit!.triggerSpan!.start) / 2)
    expect(rightZone!.fillBounds.width).toBeCloseTo((rightExit!.triggerSpan!.end - rightExit!.triggerSpan!.start) / 2)
    expect(leftZone!.fillBounds.x).toBeCloseTo(leftExit!.threshold)
    expect(rightZone!.fillBounds.x + rightZone!.fillBounds.width).toBeCloseTo(rightExit!.threshold)
    for (const zone of zones) {
      expect(zone.fillBounds.width).toBeLessThan(corridor.bounds.width)
      expect(zone.fillBounds.height).toBeLessThanOrEqual(corridor.bounds.height)
      expect(zone.fadeTowardTarget).toBe(true)
      expect(zone.fadeAxis).toBe('x')
      expect(zone.inwardDirection).toBe(-Math.sign(zone.bounds.x + zone.bounds.width / 2 - corridor.bounds.x - corridor.bounds.width / 2))
    }
    expect(zones.every(({ fillBounds }) => !(50 >= fillBounds.x && 50 <= fillBounds.x + fillBounds.width && 50 >= fillBounds.y && 50 <= fillBounds.y + fillBounds.height))).toBe(true)
    expect(leftZone!.inwardDirection).toBe(1)
    expect(rightZone!.inwardDirection).toBe(-1)
  })

  it('fades the Commercial Street pickup patch toward the real exit, leaving street center clear', () => {
    const scene = mainlineScenes['commercial-street']
    const zone = phoneRideMapTargetZones(scene, 'commercial-street', 'commercial-street')[0]
    const lane = scene.structures.find((structure) => structure.id === 'commercial-main-lane')!
    expect(zone.inwardDirection).toBe(-scene.externalExits[0].direction)
    expect(zone.fadeAxis).toBe('x')
    expect(zone.fillBounds.width).toBeCloseTo(lane.bounds.height / 2)
    expect(zone.fillBounds.height).toBeCloseTo(lane.bounds.height)
    expect(zone.fillBounds.x + zone.fillBounds.width).toBeLessThan(100)
    expect(zone.fillBounds).not.toEqual(scene.structures.find((structure) => structure.id === 'commercial-main-lane')!.bounds)
    expect(zone.fadeTowardTarget).toBe(true)
  })

  it('limits Café fill to the walkable floor beside its authored Street doorway', () => {
    const scene = mainlineScenes['commercial-cafe']
    const zone = phoneRideMapTargetZones(scene, 'commercial-cafe', 'commercial-street')[0]
    expect(zone.bounds.width).toBeGreaterThan(0)
    const tangentSpan = Math.max(zone.bounds.width, zone.bounds.height)
    expect(Math.max(zone.fillBounds.width, zone.fillBounds.height)).toBeLessThanOrEqual(tangentSpan)
    expect(Math.min(zone.fillBounds.width, zone.fillBounds.height)).toBeCloseTo(tangentSpan / 2)
    expect(zone.fillBounds.width * zone.fillBounds.height).toBeLessThan((scene.walkBounds.width * scene.walkBounds.height) / 50)
    expect(zone.fillBounds.x).toBeCloseTo(scene.walkBounds.x)
    expect(zone.fillBounds.y + zone.fillBounds.height / 2).toBeCloseTo(zone.bounds.y + zone.bounds.height / 2)
    expect(zone.fadeTowardTarget).toBe(true)
  })
})

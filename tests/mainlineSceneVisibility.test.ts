import { describe, expect, it } from 'vitest'
import { mainlineCanonicalSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityBelongsToActiveRoom } from '../src/center/runtime/mainlineSceneModel'
import { mainlineGeometryCellWithinViewport, mainlineGeometryUnitShouldRender } from '../src/center/runtime/mainlineSceneVisibility'
import { mainlineCameraOffset, mainlineCameraTarget } from '../src/center/runtime/mainlineViewport'
import { projectCommercialStreetX } from '../src/center/runtime/commercialStreetGridProjection'

describe('continuous commercial-street shell visibility', () => {
  it('keeps all 14 shell owners scene-owned across street and room ownership changes', () => {
    const street = mainlineScenes['commercial-street']
    const units = mainlineCanonicalSceneGeometryUnits(street, { width: 1180, height: 757 })
    const shellUnits = units.filter((unit) => unit.sourceWallId?.endsWith('-shell'))
    expect(shellUnits.length).toBeGreaterThan(0)
    expect(new Set(shellUnits.map((unit) => unit.sourceWallId)).size).toBe(14)
    for (const activeRoomId of [undefined, 'commercial-north-n2-interior', 'commercial-south-s5-interior']) {
      expect(shellUnits.every((unit) => mainlineGeometryUnitShouldRender(street.id, unit, activeRoomId, false))).toBe(true)
    }
  })

  it('culls shell glyphs by the translated viewport with overscan, not active room', () => {
    expect(mainlineGeometryCellWithinViewport({ x: 102, y: 50 }, { x: -4, y: 0 })).toBe(true)
    expect(mainlineGeometryCellWithinViewport({ x: 110, y: 50 }, { x: -4, y: 0 })).toBe(false)
    expect(mainlineGeometryCellWithinViewport({ x: 22, y: -7 }, { x: 0, y: 0 })).toBe(false)
  })

  it('keeps the projected actor in the camera deadzone and culls shell cells in projected viewport coordinates', () => {
    const street = mainlineScenes['commercial-street']
    const metrics = { width: 390, height: 560 }
    const position = { x: 100, y: 50 }
    const projectedX = projectCommercialStreetX(position.x, metrics)
    const offset = mainlineCameraOffset(street, position, false, metrics)
    const target = mainlineCameraTarget(street, position, { x: 0, y: 0 }, false, metrics)

    expect(projectedX).toBeGreaterThan(170)
    expect(offset.x).toBeLessThan(-100)
    expect(projectedX + offset.x).toBeCloseTo(50)
    expect(projectedX + target.x).toBeCloseTo(65)
    expect(mainlineGeometryCellWithinViewport(position, offset, 5, street.id, metrics)).toBe(true)
    // Without projecting the shell anchor, this same camera offset incorrectly
    // classifies its on-screen cell as far outside the viewport.
    expect(mainlineGeometryCellWithinViewport(position, offset)).toBe(false)
  })

  it('leaves non-commercial camera coordinates unchanged', () => {
    const scene = mainlineScenes['commercial-cafe']
    const position = { x: 100, y: 50 }
    const current = { x: -10, y: 0 }
    expect(mainlineCameraTarget(scene, position, current, false, { width: 390, height: 560 }))
      .toEqual(mainlineCameraTarget(scene, position, current))
  })

  it('still scopes room furniture independently of shell geometry visibility', () => {
    const street = mainlineScenes['commercial-street']
    const milkTeaRoom = 'commercial-south-s5-interior'
    const fixture = street.objects.find((entity) => entity.roomId === milkTeaRoom)!
    expect(fixture).toBeDefined()
    expect(mainlineEntityBelongsToActiveRoom(fixture, milkTeaRoom)).toBe(true)
    expect(mainlineEntityBelongsToActiveRoom(fixture, undefined)).toBe(false)
    expect(mainlineEntityBelongsToActiveRoom(fixture, 'commercial-south-s6-interior')).toBe(false)
  })
})

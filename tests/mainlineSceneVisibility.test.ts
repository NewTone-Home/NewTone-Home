import { describe, expect, it } from 'vitest'
import { mainlineCanonicalSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityBelongsToActiveRoom } from '../src/center/runtime/mainlineSceneModel'
import { mainlineGeometryUnitShouldRender } from '../src/center/runtime/mainlineSceneVisibility'

describe('continuous commercial-street shell visibility', () => {
  it('keeps every shell wall mounted across street and room ownership changes', () => {
    const street = mainlineScenes['commercial-street']
    const units = mainlineCanonicalSceneGeometryUnits(street, { width: 1180, height: 757 })
    const shellUnits = units.filter((unit) => unit.sourceWallId?.endsWith('-shell'))
    expect(shellUnits.length).toBeGreaterThan(0)
    expect(new Set(shellUnits.map((unit) => unit.sourceWallId)).size).toBe(14)
    for (const activeRoomId of [undefined, 'commercial-north-n2-interior', 'commercial-south-s5-interior']) {
      expect(shellUnits.every((unit) => mainlineGeometryUnitShouldRender(street.id, unit, activeRoomId, false))).toBe(true)
    }
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

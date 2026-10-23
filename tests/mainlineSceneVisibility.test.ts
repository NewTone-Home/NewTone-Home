import { describe, expect, it } from 'vitest'
import { mainlineCanonicalSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityBelongsToActiveRoom } from '../src/center/runtime/mainlineSceneModel'
import { mainlineGeometryCellWithinViewport, mainlineGeometryUnitShouldRender } from '../src/center/runtime/mainlineSceneVisibility'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineCameraOffset, mainlineCameraTarget, mainlineVisibleWorldSpan } from '../src/center/runtime/mainlineViewport'
import { projectCommercialStreetX } from '../src/center/runtime/commercialStreetGridProjection'

describe('continuous commercial-street shell visibility', () => {
  it('keeps every storefront shell owner scene-owned across street and room ownership changes', () => {
    const street = mainlineScenes['commercial-street']
    const units = mainlineCanonicalSceneGeometryUnits(street, { width: 1180, height: 757 })
    const shellUnits = units.filter((unit) => unit.sourceWallId?.endsWith('-shell'))
    expect(shellUnits.length).toBeGreaterThan(0)
    expect(new Set(shellUnits.map((unit) => unit.sourceWallId)).size).toBe(street.storefronts.filter(slot => slot.portalId).length)
    for (const activeRoomId of [undefined, 'commercial-north-n2-interior', 'commercial-south-s5-interior']) {
      expect(shellUnits.every((unit) => mainlineGeometryUnitShouldRender(street.id, unit, activeRoomId, false))).toBe(true)
    }
  })

  it('culls shell glyphs by the translated viewport with overscan, not active room', () => {
    expect(mainlineGeometryCellWithinViewport({ x: 90, y: 50 }, { x: -4, y: 0 })).toBe(true)
    expect(mainlineGeometryCellWithinViewport({ x: 95, y: 50 }, { x: -4, y: 0 })).toBe(false)
    expect(mainlineGeometryCellWithinViewport({ x: 22, y: -7 }, { x: 0, y: 0 })).toBe(false)
  })

  it('keeps precomputed viewport-span culling identical across the full commercial shell', () => {
    const street = mainlineScenes['commercial-street']
    const viewports = [
      { width: 390, height: 560 },
      { width: 1280, height: 800 },
      sceneDesignReferenceMetrics,
    ]
    const units = mainlineCanonicalSceneGeometryUnits(street, sceneDesignReferenceMetrics)
      .filter(unit => unit.sourceWallId?.endsWith('-shell'))
    const cells = units.flatMap(unit => unit.visual.cells)
    expect(cells.length).toBeGreaterThan(500)
    for (const viewport of viewports) {
      const span = mainlineVisibleWorldSpan(viewport)
      for (const cameraOffset of [{ x: 0, y: 0 }, { x: -18.25, y: 7.5 }]) {
        const ordinary = cells.map(cell => mainlineGeometryCellWithinViewport(cell, cameraOffset, 5, street.id, sceneDesignReferenceMetrics, viewport))
        const precomputed = cells.map(cell => mainlineGeometryCellWithinViewport(cell, cameraOffset, 5, street.id, sceneDesignReferenceMetrics, viewport, span))
        expect(precomputed).toEqual(ordinary)
      }
    }
  })

  it('keeps the projected actor in the camera deadzone and culls shell cells in projected viewport coordinates', () => {
    const street = mainlineScenes['commercial-street']
    const metrics = { width: 390, height: 560 }
    const position = { x: 100, y: 50 }
    const projectedX = projectCommercialStreetX(position.x, metrics)
    const offset = mainlineCameraOffset(street, position, false, metrics)
    const target = mainlineCameraTarget(street, position, { x: 0, y: 0 }, false, metrics)

    const visible = mainlineVisibleWorldSpan(metrics)
    const screenX = (worldX: number, cameraX: number) => 50 + (worldX + cameraX - 50) / visible.x * 100
    expect(projectedX).toBe(100)
    expect(offset.x).toBeLessThan(0)
    expect(screenX(projectedX, offset.x)).toBeCloseTo(50)
    expect(screenX(projectedX, target.x)).toBeCloseTo(65)
    expect(mainlineGeometryCellWithinViewport(position, offset, 5, street.id, metrics)).toBe(true)
    // With the fixed world projection, culling converts through the viewport's
    // visible world span instead of using a second X-only projection.
    expect(mainlineGeometryCellWithinViewport(position, offset, 5, street.id, metrics, metrics)).toBe(true)
  })

  it('applies the live viewport camera to non-commercial mainline scenes too', () => {
    const scene = mainlineScenes['commercial-cafe']
    const position = { x: 100, y: 50 }
    const current = { x: -10, y: 0 }
    const smallViewportTarget = mainlineCameraTarget(scene, position, current, false, { width: 390, height: 560 })
    const referenceTarget = mainlineCameraTarget(scene, position, current)
    expect(smallViewportTarget).not.toEqual(referenceTarget)
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

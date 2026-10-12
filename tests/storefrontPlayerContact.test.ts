import { describe, expect, it } from 'vitest'
import { canTravelAlongMainlineSegment, isWalkableMainlinePoint, mainlineStorefrontArrivalDecision, mainlineStorefrontPlayerContact, resolveMainlineStorefrontInteraction } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontInteractionCandidates, mainlineStorefrontInteractionRegion } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { createFreeRoamController } from '../src/center/runtime/useFreeRoamMovement'
import { storefrontContactGeometry } from '../src/center/runtime/storefrontContactGeometry'
import type { SceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const clothing = street.storefronts.find(store => store.id === 'commercial-north-slot-2')!
const viewports = [
  { width: 1280, height: 720 }, { width: 390, height: 844 },
  { width: 412, height: 915 }, { width: 844, height: 390 },
  { width: 834, height: 1194 }, { width: 1194, height: 834 },
]

function context(metrics: SceneScreenMetrics) {
  const snapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, metrics)
  return { screenMetrics: metrics, geometrySnapshot: snapshot, actorId: 'protagonist' }
}

function gapPixels(point: { x: number; y: number }, contact: NonNullable<ReturnType<typeof mainlineStorefrontPlayerContact>>, metrics: SceneScreenMetrics) {
  const { geometry, footprint } = contact
  const horizontal = geometry.outward.y !== 0
  const axis = horizontal ? 'y' : 'x', size = horizontal ? 'height' : 'width'
  const direction = geometry.outward[axis]
  const edge = geometry.visualBounds[axis] + (direction > 0 ? geometry.visualBounds[size] : 0)
  return (direction * (point[axis] - edge) - footprint[size] / 2) * metrics[size] / 100
}

describe('player storefront edge contacts', () => {
  it.each(viewports)('routes all ordinary stores to a legal tiny edge gap at $width × $height', metrics => {
    const options = context(metrics)
    for (const store of street.storefronts.filter(store => !store.portalId)) {
      const from = street.initialPlayerPosition
      const contact = mainlineStorefrontPlayerContact(street, store, from, {}, options)!
      const result = resolveMainlineStorefrontInteraction(street, store, from, {}, options)
      expect(result.inRange).toBe(false)
      expect(result.path, store.id).not.toBeNull()
      expect(contact.candidates).toContainEqual(result.target)
      expect(isWalkableMainlinePoint(result.target, street, {}, options)).toBe(true)
      expect(gapPixels(result.target, contact, metrics)).toBeCloseTo(contact.footprint.width * metrics.width / 100 * .25, 3)
      expect(resolveMainlineStorefrontInteraction(street, store, result.target, {}, options)).toEqual({ target: result.target, path: [result.target], inRange: true })
      result.path!.slice(1).forEach((point, index) => expect(canTravelAlongMainlineSegment(result.path![index], point, street, {}, options)).toBe(true))
    }
  })

  it.each(viewports)('rejects aligned 6 / 4.2 / 2.4 rings as final interaction at $width × $height', metrics => {
    const options = context(metrics)
    const { center, outward, radius } = mainlineStorefrontInteractionRegion(street, clothing)
    for (const fraction of [1, .7, .4]) {
      const point = { x: center.x + outward.x * radius * fraction, y: center.y + outward.y * radius * fraction }
      expect(resolveMainlineStorefrontInteraction(street, clothing, point, {}, options).inRange).toBe(false)
      expect(mainlineStorefrontArrivalDecision(street, clothing, point, 2, {}, options)).toBe('blocked')
    }
  })

  it('accepts manually reached continuous near-edge points without requiring a sampled target', () => {
    const metrics = viewports[0], options = context(metrics)
    const contact = mainlineStorefrontPlayerContact(street, clothing, street.initialPlayerPosition, {}, options)!
    const target = resolveMainlineStorefrontInteraction(street, clothing, street.initialPlayerPosition, {}, options).target
    for (const fraction of [-.04, 0, .04]) {
      const point = { x: target.x, y: target.y + contact.footprint.height * fraction }
      expect(resolveMainlineStorefrontInteraction(street, clothing, point, {}, options)).toEqual({ target: point, path: [point], inRange: true })
    }
    const overlapping = { x: contact.geometry.center.x, y: contact.geometry.center.y }
    expect(isWalkableMainlinePoint(overlapping, street, {}, options)).toBe(false)
    expect(resolveMainlineStorefrontInteraction(street, clothing, overlapping, {}, options).inRange).toBe(false)
  })

  it('resolves a different close contact when a dynamic actor occupies the preferred endpoint', () => {
    const options = context(viewports[0]), from = street.initialPlayerPosition
    const preferred = resolveMainlineStorefrontInteraction(street, clothing, from, {}, options).target
    const runtime = createNavigationRuntime()
    runtime.registerActor('blocker', preferred, mainlineProtagonistDotFootprint(preferred, options.screenMetrics))
    const live = { ...options, navigationRuntime: runtime }
    const result = resolveMainlineStorefrontInteraction(street, clothing, from, {}, live)
    expect(result.path).not.toBeNull()
    expect(result.target).not.toEqual(preferred)
    expect(isWalkableMainlinePoint(result.target, street, {}, live)).toBe(true)
    expect(mainlineStorefrontArrivalDecision(street, clothing, result.target, 2, {}, live)).toBe('interact')
    result.path!.slice(1).forEach((point, index) => expect(canTravelAlongMainlineSegment(result.path![index], point, street, {}, live)).toBe(true))
    expect(mainlineStorefrontArrivalDecision(street, clothing, preferred, 0, {}, live)).toBe('retry')
    expect(mainlineStorefrontArrivalDecision(street, clothing, preferred, 2, {}, live)).toBe('blocked')
  })

  it('blocks when every close candidate is occupied, without falling back to ambient rings', () => {
    const options = context(viewports[0]), from = street.initialPlayerPosition
    const contact = mainlineStorefrontPlayerContact(street, clothing, from, {}, options)!
    const runtime = createNavigationRuntime()
    contact.candidates.forEach((point, index) => runtime.registerActor(`blocker-${index}`, point, mainlineProtagonistDotFootprint(point, options.screenMetrics)))
    const live = { ...options, navigationRuntime: runtime }
    expect(resolveMainlineStorefrontInteraction(street, clothing, from, {}, live)).toEqual({ target: from, path: null, inRange: false })
    expect(mainlineStorefrontArrivalDecision(street, clothing, from, 2, {}, live)).toBe('blocked')
    expect(mainlineStorefrontInteractionCandidates(street, clothing, from).some(point => isWalkableMainlinePoint(point, street, {}, live))).toBe(true)
  })

  it('revalidates the actual movement arrival against a changed live footprint', () => {
    const options = context(viewports[0]), from = street.initialPlayerPosition
    const result = resolveMainlineStorefrontInteraction(street, clothing, from, {}, options)
    const controller = createFreeRoamController(from)
    const decisions: string[] = []
    controller.moveAlong(result.path!, position => {
      decisions.push(mainlineStorefrontArrivalDecision(street, clothing, position, 0, {}, options))
      const box = mainlineProtagonistDotFootprint(position, options.screenMetrics)
      decisions.push(mainlineStorefrontArrivalDecision(street, clothing, position, 0, {}, { ...options, actorFootprint: { width: box.width, height: box.height * 2 } }))
    }, {
      screenMetrics: options.screenMetrics,
      canOccupy: point => isWalkableMainlinePoint(point, street, {}, options),
      canTraverse: (start, end) => canTravelAlongMainlineSegment(start, end, street, {}, options),
    })
    for (let frame = 1; frame < 2000 && controller.isMoving(); frame += 1) controller.tick(frame * 16)
    expect(controller.isMoving()).toBe(false)
    expect(controller.getCurrentPosition()).toEqual(result.target)
    expect(decisions).toEqual(['interact', 'retry'])
  })

  it.each(['top', 'bottom', 'left', 'right'] as const)('uses the same projected contact contract on the %s facade and side approaches', edge => {
    const metrics = viewports[0], original = context(metrics).geometrySnapshot
    const source = original.units.filter(unit => unit.storefrontId === clothing.id)
    const horizontal = edge === 'top' || edge === 'bottom'
    const store = { ...clothing, edge }
    const units = source.map(unit => horizontal ? { ...unit, edge } : {
      ...unit, edge, x: unit.y, y: unit.x, width: unit.height, height: unit.width,
      visual: { ...unit.visual, cells: unit.visual.cells.map(cell => ({ ...cell, x: cell.y, y: cell.x, orientation: 'vertical' as const })) },
    })
    const geometry = storefrontContactGeometry(store, units, metrics)!
    const scene = { ...street, storefronts: [store], objects: [], passages: [], accessRegions: [], accessBoundaries: [], navigationBarriers: [] }
    const snapshot = { ...original, units, storefronts: new Map([[store.id, geometry]]), objects: new Map(), passages: new Map(), navigationBarriers: [] }
    const options = { screenMetrics: metrics, geometrySnapshot: snapshot }
    const region = mainlineStorefrontInteractionRegion(street, clothing)
    for (const side of [-1, 0, 1]) {
      const from = { x: geometry.center.x + geometry.outward.x * region.radius + geometry.outward.y * region.radius * side, y: geometry.center.y + geometry.outward.y * region.radius + geometry.outward.x * region.radius * side }
      const result = resolveMainlineStorefrontInteraction(scene, store, from, {}, options)
      expect(result.path).not.toBeNull()
      expect(isWalkableMainlinePoint(result.target, scene, {}, options)).toBe(true)
      const contact = mainlineStorefrontPlayerContact(scene, store, from, {}, options)!
      expect(gapPixels(result.target, contact, metrics)).toBeCloseTo(contact.footprint.width * metrics.width / 100 * .25, 3)
    }
  })

  it('keeps viewport typography distinct from an embedded stage and excludes Café', () => {
    const metrics = { width: viewports[1].width, height: viewports[1].height, viewportWidth: viewports[0].width }
    const snapshot = context(metrics).geometrySnapshot
    expect(snapshot.storefronts.get(clothing.id)!.fontSizePx).toBe(15.36)
    const cafe = street.storefronts.find(store => store.portalId)!
    expect(snapshot.storefronts.has(cafe.id)).toBe(false)
    expect(mainlineStorefrontPlayerContact(street, cafe, street.initialPlayerPosition, {}, { geometrySnapshot: snapshot })).toBeNull()
    expect(resolveMainlineStorefrontInteraction(street, cafe, street.initialPlayerPosition).path).toBeNull()
  })
})

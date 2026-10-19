import { describe, expect, it } from 'vitest'
import { mainlineSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canActorReachPassageApproach, findMainlinePath } from '../src/center/runtime/mainlineNavigation'
import { commercialStreetQuestionNarrativeAnchor, commercialStreetQuestionNarrativeShouldTrigger } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineProtagonistDotFootprint, mainlineLabelFootprint } from '../src/center/runtime/sceneLayout'
import { commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'

const street = mainlineScenes['commercial-street']

describe('commercial street phase-one projection', () => {
  it('keeps the complete shared exterior and projects out room-owned content by ownership', () => {
    expect(street.displayRegions).toEqual([])
    expect(street.walkBounds).toMatchObject({ x: 8, y: 10, width: 192, height: 80 })
    expect(street.structures.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'commercial-north-facade', 'commercial-main-lane', 'commercial-south-facade',
    ]))
    expect(street.storefronts).toHaveLength(14)
    expect(street.portals.filter(({ id }) => id.startsWith('street-') && id !== 'street-lakefront-entry')).toHaveLength(14)
    expect(street.portals.some(({ id }) => id === 'commercial-street-lakefront-entry')).toBe(false)
    expect(street.objects).toHaveLength(14)
    expect(street.objects.every(({ kind }) => kind === 'door')).toBe(true)
    expect(street.continuousStructures).toEqual([])
    expect(street.furnitureGroups).toEqual([])
    expect(street.curves.some(({ id }) => id.startsWith('commercial-cafe-'))).toBe(false)
    expect(street.structures.some(({ id }) => id.includes('commercial-cafe-room'))).toBe(false)
    expect(street.npcs.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'commercial-street-pedestrian-west-north', 'commercial-street-pedestrian-west-south',
      'commercial-street-pedestrian-mid-east-north', 'commercial-street-pedestrian-mid-east-south',
      'commercial-street-pedestrian-long', 'commercial-street-pedestrian-shopper',
    ]))
    expect(street.npcs).toHaveLength(6)
    expect(street.npcs.some(({ id }) => id.includes('-clerk') || id.endsWith('-customer') || id === 'milk-tea-clerk')).toBe(false)
    expect(street.ambientNpcRoutes.every(({ steps }) => steps.every((step) => !('kind' in step && step.kind === 'storefront-visit')))).toBe(true)
    const cafeOpenings = street.structures.flatMap((structure) => (structure.openings ?? []).map((opening) => ({ wallId: structure.id, ...opening })))
      .filter((opening) => opening.doorId === 'street-cafe-entry')
    expect(cafeOpenings).toHaveLength(1)
    expect(cafeOpenings[0]?.wallId).toBe('commercial-north-facade')
    expect(mainlineSceneGeometryUnits(street, street.initialPlayerPosition).flatMap(({ visual }) => visual.cells)
      .some((cell) => cell.entityId === 'commercial-cafe-blackboard' || cell.featureId === 'commercial-cafe-blackboard-feature')).toBe(false)
  })

  it('keeps the question marker and trigger at the original authored location and radius', () => {
    expect(commercialStreetQuestionNarrativeAnchor(street)).toEqual({ x: 104, y: 50 })
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, { x: 108, y: 50 })).toBe(true)
    expect(commercialStreetQuestionNarrativeShouldTrigger(street, { x: 108.01, y: 50 })).toBe(false)
  })

  it('allows a real outside-lane approach to all fourteen locked storefront doors', () => {
    expect(street.storefronts).toHaveLength(commercialStreetShops.length)
    for (const storefront of street.storefronts) {
      const passage = street.passages.find(({ id }) => id === storefront.portalId)
      expect(passage, storefront.id).toBeTruthy()
      expect(passage?.access, storefront.id).toBe('locked')
      const approach = canActorReachPassageApproach(street, passage!, street.initialPlayerPosition)
      expect(approach?.path, storefront.id).not.toBeNull()
      expect(approach?.target.x, storefront.id).toBeGreaterThanOrEqual(street.walkBounds.x)
      expect(approach?.target.x, storefront.id).toBeLessThanOrEqual(street.walkBounds.x + street.walkBounds.width)
    }
  })

  it('keeps neighboring storefront labels clear of adjacent signs and door cells', () => {
    const screenMetrics = { width: 1280, height: 720, viewportWidth: 1280 }
    const units = mainlineSceneGeometryUnits(street, street.initialPlayerPosition)
    const labels = street.storefronts.flatMap((storefront) => {
      const signCells = units.filter((unit) => unit.storefrontId === storefront.id)
        .flatMap((unit) => unit.visual.cells).filter((cell) => cell.storefrontRole === 'sign')
      if (signCells.length === 0) return []
      const horizontal = storefront.edge === 'top' || storefront.edge === 'bottom'
      const start = Math.min(...signCells.map((cell) => cell.cellStart ?? (horizontal ? cell.x : cell.y)))
      const end = Math.max(...signCells.map((cell) => cell.cellEnd ?? (horizontal ? cell.x : cell.y)))
      const line = signCells.reduce((sum, cell) => sum + (horizontal ? cell.y : cell.x), 0) / signCells.length
      const fontSizePx = Math.max(12, Math.min(16, screenMetrics.viewportWidth * .012))
      const textExtent = (Array.from(storefront.label).length * 1.08 + .7) * fontSizePx
      const tangentPixels = (end - start) * (horizontal ? screenMetrics.width : screenMetrics.height) / 100
      const extent = Math.min(textExtent, tangentPixels - .15 * fontSizePx)
      const width = (horizontal ? extent : 1.4 * fontSizePx) / screenMetrics.width * 100
      const height = (horizontal ? 1.4 * fontSizePx : extent) / screenMetrics.height * 100
      const center = horizontal ? { x: (start + end) / 2, y: line } : { x: line, y: (start + end) / 2 }
      return [{ id: storefront.id, box: { x: center.x - width / 2, y: center.y - height / 2, width, height } }]
    })
    expect(labels.length).toBeGreaterThan(0)
    const neighborDoors = street.passages.map((passage) => ({ id: passage.id, bounds: passage.doorway }))

    for (let index = 0; index < labels.length; index += 1) {
      const current = labels[index]!
      const ownPortalId = street.storefronts.find(({ id }) => id === current.id)?.portalId
      for (const neighbor of labels.slice(index + 1)) {
        const overlapX = Math.min(current.box.x + current.box.width, neighbor.box.x + neighbor.box.width) - Math.max(current.box.x, neighbor.box.x)
        const overlapY = Math.min(current.box.y + current.box.height, neighbor.box.y + neighbor.box.height) - Math.max(current.box.y, neighbor.box.y)
        expect(overlapX <= 0 || overlapY <= 0, `${current.id} overlaps neighboring ${neighbor.id} label`).toBe(true)
      }
      for (const door of neighborDoors) {
        if (door.id === ownPortalId) continue
        const overlaps = door.bounds.x < current.box.x + current.box.width && door.bounds.x + door.bounds.width > current.box.x
          && door.bounds.y < current.box.y + current.box.height && door.bounds.y + door.bounds.height > current.box.y
        expect(overlaps, `${current.id} label overlaps neighboring ${door.id} door`).toBe(false)
      }
    }
  })

  it('keeps a pedestrian occupying the street as a local obstacle without trapping a player at a neighboring point', () => {
    const npc = street.npcs.find(({ id }) => id === 'commercial-street-pedestrian-mid-east-south')!
    const position = street.npcPlacements.find(({ npcId }) => npcId === npc.id)!.position
    const runtime = createNavigationRuntime()
    const footprint = mainlineLabelFootprint(npc.label, position, { width: 1280, height: 720 }, { lineHeight: 1 })
    runtime.registerActor(npc.id, position, { width: footprint.width, height: footprint.height })
    const playerStart = { x: position.x + 1.2, y: position.y }
    const playerTarget = { x: 34, y: 50 }
    const playerFootprint = mainlineProtagonistDotFootprint(playerStart, { width: 1280, height: 720 })
    const path = findMainlinePath(playerStart, playerTarget, street, {}, {
      actorId: 'protagonist',
      actorFootprint: { width: playerFootprint.width, height: playerFootprint.height },
      navigationRuntime: runtime,
      screenMetrics: { width: 1280, height: 720 },
    })
    expect(path).not.toBeNull()
  })
})

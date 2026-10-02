import { describe, expect, it } from 'vitest'
import { commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId, commercialCafeLaoZhouConversationSeatId } from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, mainlineEntityInteractionCandidates, mainlineInteractionTarget, mainlineNpcInteractionTarget, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isMainlineSeatAvailable, isMainlineSeatLabelSuppressed, isMainlineSeatPrompted, mainlineProtagonistPresentation, mainlineSceneOccupiedSeatIds, mainlineSeatedActorVisualPosition, nextMainlinePlayerSeatId } from '../src/center/runtime/mainlineSeating'
import { sharedFurnitureGeometry } from '../src/center/runtime/twoSeatFurniture'
import { mainlineNpcStagedSeatId, mainlineNpcStagingBehavior } from '../src/center/runtime/mainlineNpcStaging'
import { mainlineEntityTextFootprint, mainlineLabelFootprint, mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

describe('commercial cafe seating and staging', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhouSeatId = 'commercial-cafe-right-window-upper-group-chair-top'

  it('derives Lao Zhou staging from behavior while occupancy remains only a set of seat ids', () => {
    const behavior = mainlineNpcStagingBehavior(cafe, 'lao-zhou')
    const occupiedSeatIds = mainlineSceneOccupiedSeatIds(cafe)

    expect(cafe.npcPlacements).toEqual([])
    expect(behavior).toEqual({ npcId: 'lao-zhou', dutyId: 'lao-zhou.seated', targetId: laoZhouSeatId, targetKind: 'seat' })
    expect(mainlineNpcStagedSeatId(cafe, 'lao-zhou')).toBe(laoZhouSeatId)
    expect(occupiedSeatIds).toEqual(new Set([laoZhouSeatId]))
    expect([...occupiedSeatIds]).not.toContain('lao-zhou')
    expect(resolveMainlineNpcPosition(cafe, 'lao-zhou')).toEqual(resolveMainlineSeatSitPosition(cafe, laoZhouSeatId))
  })

  it('keeps the opposite chair free and lets runtime-only player occupancy appear and clear', () => {
    expect(commercialCafeLaoZhouConversationSeatId).toBe('commercial-cafe-right-window-upper-group-chair-bottom')
    expect(isMainlineSeatAvailable(cafe, laoZhouSeatId)).toBe(false)
    expect(isMainlineSeatAvailable(cafe, commercialCafeLaoZhouConversationSeatId)).toBe(true)

    const playerSeatId = nextMainlinePlayerSeatId(cafe, null, commercialCafeLaoZhouConversationSeatId)
    expect(playerSeatId).toBe(commercialCafeLaoZhouConversationSeatId)
    const seated = mainlineSceneOccupiedSeatIds(cafe, playerSeatId)
    expect(seated).toEqual(new Set([laoZhouSeatId, commercialCafeLaoZhouConversationSeatId]))
    expect(isMainlineSeatAvailable(cafe, commercialCafeLaoZhouConversationSeatId, commercialCafeLaoZhouConversationSeatId)).toBe(false)

    const afterStandingSeatId = nextMainlinePlayerSeatId(cafe, playerSeatId, null)
    expect(afterStandingSeatId).toBeNull()
    const afterStanding = mainlineSceneOccupiedSeatIds(cafe, afterStandingSeatId)
    expect(afterStanding).toEqual(new Set([laoZhouSeatId]))
    expect(isMainlineSeatAvailable(cafe, commercialCafeLaoZhouConversationSeatId)).toBe(true)
  })

  it('suppresses only occupied seat labels and leaves free seat labels available', () => {
    const laoZhouSeat = cafe.objects.find((entity) => entity.id === laoZhouSeatId)!
    const conversationSeat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)!
    const occupied = mainlineSceneOccupiedSeatIds(cafe)

    expect(isMainlineSeatLabelSuppressed(laoZhouSeat, occupied)).toBe(true)
    expect(isMainlineSeatLabelSuppressed(conversationSeat, occupied)).toBe(false)
  })

  it('presents a seated protagonist as 修杰 and prompts only the requested free conversation seat', () => {
    const conversationSeat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)!
    const otherSeat = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-lower-group-chair-bottom')!

    expect(mainlineProtagonistPresentation(null)).toEqual({ kind: 'dot' })
    expect(mainlineProtagonistPresentation(commercialCafeLaoZhouConversationSeatId)).toEqual({ kind: 'seated', label: '修杰' })
    expect(isMainlineSeatPrompted(conversationSeat, commercialCafeLaoZhouConversationSeatId, null)).toBe(true)
    expect(isMainlineSeatPrompted(otherSeat, commercialCafeLaoZhouConversationSeatId, null)).toBe(false)
    expect(isMainlineSeatPrompted(conversationSeat, commercialCafeLaoZhouConversationSeatId, commercialCafeLaoZhouConversationSeatId)).toBe(false)
  })

  // APPROVED CONTRACT MIGRATION: seated runtime and rendered occupant now
  // share one final center; `sit` is transition metadata only.
  it('uses the rendered seat center as the one stable seated runtime and visual anchor', () => {
    const seat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)!
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition, {
      [seat.groupId!]: seat.seat!.pulled,
    })
    const renderedSeatCenter = snapshot.objects.get(seat.id)!.position
    const runtimePosition = resolveMainlineSeatSitPosition(cafe, seat.id, snapshot.layout, { geometrySnapshot: snapshot })!

    expect(renderedSeatCenter).not.toEqual(seat.position)
    expect(runtimePosition).toEqual(renderedSeatCenter)
    expect(mainlineSeatedActorVisualPosition(runtimePosition, seat.id, renderedSeatCenter)).toEqual(renderedSeatCenter)
    expect(mainlineSeatedActorVisualPosition(runtimePosition, null, renderedSeatCenter)).toEqual(runtimePosition)
  })

  // APPROVED CONTRACT MIGRATION: free-seat contact is derived from current
  // chair + actor footprints instead of one authored pulled coordinate.
  it('keeps a free seat reachable through a shared legal edge contact while final seating resolves to its rendered center', () => {
    const seat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)
    const dot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
    const options = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } }
    const candidates = mainlineEntityInteractionCandidates(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition, {}, options.actorFootprint, options)
    const approach = candidates.find((candidate) => candidate.y > seat!.collision!.y + seat!.collision!.height)!
    const selectedContact = mainlineInteractionTarget(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition, {}, undefined, options)
    const path = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition)

    expect(seat?.seat?.sit).toBeDefined()
    expect(seat?.seat?.sit).toEqual({ x: 84, y: 31.4 })
    expect(candidates).toHaveLength(4)
    expect(candidates).toContainEqual(selectedContact)
    expect(approach.y).toBeGreaterThan(seat!.collision!.y + seat!.collision!.height)
    expect(resolveMainlineSeatSitPosition(cafe, commercialCafeLaoZhouConversationSeatId)).toEqual(seat?.position)
    expect(isWalkableMainlinePoint(approach, cafe)).toBe(true)
    expect(path.path).not.toBeNull()
  })

  it('routes from Lao Zhou\'s table-side contact around the table before reaching the opposite free seat', () => {
    const screenMetrics = { width: 834, height: 1194 }
    const runtime = createNavigationRuntime()
    for (const npcId of ['lao-zhou', commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId]) {
      const npc = cafe.npcs.find((candidate) => candidate.id === npcId)!
      const position = resolveMainlineNpcPosition(cafe, npcId)
      const footprint = mainlineLabelFootprint(npc.label, position, screenMetrics, { lineHeight: 1 })
      runtime.registerActor(npcId, position, { width: footprint.width, height: footprint.height })
    }
    const initialDot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition, screenMetrics)
    const initialOptions = {
      actorId: 'protagonist',
      navigationRuntime: runtime,
      screenMetrics,
      actorFootprint: { width: initialDot.width, height: initialDot.height },
    }
    // This is the shared NPC resolver's current table-side contact, not an
    // individually tuned café coordinate.
    const from = mainlineNpcInteractionTarget(cafe, 'lao-zhou', cafe.initialPlayerPosition, {}, undefined, initialOptions)
    const options = {
      ...initialOptions,
      actorFootprint: (() => {
        const dot = mainlineProtagonistDotFootprint(from, screenMetrics)
        return { width: dot.width, height: dot.height }
      })(),
    }
    const route = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, from, {}, options)

    expect(route.path).not.toBeNull()
    expect(route.path!.length).toBeGreaterThan(2)
    expect(route.path!.every((point) => isWalkableMainlinePoint(point, cafe, {}, options))).toBe(true)
  })

  // APPROVED CONTRACT MIGRATION: no invisible corridor closure. Passability
  // comes from visible table/chair gap versus the active actor footprint.
  it('keeps two-seat routes governed by visible table and chair footprints while preserving the exterior seat route', () => {
    const seatIds = [
      commercialCafeLaoZhouConversationSeatId,
      'commercial-cafe-bottom-left-group-chair-bottom',
    ]

    for (const seatId of seatIds) {
      const seat = cafe.objects.find((entity) => entity.id === seatId)!
      const table = cafe.objects.find((entity) => entity.id === seat.seat!.tableId)!
      const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
      const seatCollision = snapshot.objects.get(seat.id)!.collision!
      const tableCollision = snapshot.objects.get(table.id)!.collision!
      const gapCenter = seat.seat!.side === 'bottom' || seat.seat!.side === 'top'
        ? { x: tableCollision.x + tableCollision.width / 2, y: (tableCollision.y + tableCollision.height + seatCollision.y) / 2 }
        : { x: (tableCollision.x + tableCollision.width + seatCollision.x) / 2, y: tableCollision.y + tableCollision.height / 2 }

      expect(isWalkableMainlinePoint(gapCenter, cafe)).toBe(true)
      const visualGap = seat.seat!.side === 'bottom' || seat.seat!.side === 'top'
        ? Math.abs(seatCollision.y - (tableCollision.y + tableCollision.height))
        : Math.abs(seatCollision.x - (tableCollision.x + tableCollision.width))
      const oversizedFootprint = seat.seat!.side === 'bottom' || seat.seat!.side === 'top'
        ? { width: 1, height: visualGap + .01 }
        : { width: visualGap + .01, height: 1 }
      expect(isWalkableMainlinePoint(gapCenter, cafe, {}, { actorFootprint: oversizedFootprint })).toBe(false)
      expect(findMainlinePathToEntity(cafe, seatId, cafe.initialPlayerPosition).path).not.toBeNull()
      const exteriorStart = { x: tableCollision.x - 5, y: gapCenter.y }
      const exteriorEnd = { x: tableCollision.x + tableCollision.width + 5, y: gapCenter.y }
      const exteriorRoute = findMainlinePath(exteriorStart, exteriorEnd, cafe)
      expect(exteriorRoute).not.toBeNull()
      expect(exteriorRoute?.every((point) => isWalkableMainlinePoint(point, cafe))).toBe(true)
    }
  })

  // APPROVED CONTRACT MIGRATION: four-seat furniture now has only visible
  // object footprints plus its four table-chair relation barriers.
  it('uses four relation barriers instead of a hidden four-seat table body', () => {
    const table = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-table')!
    const seats = cafe.objects.filter((entity) => entity.groupId === 'commercial-cafe-bottom-center-group' && entity.kind === 'seat')
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)

    expect(cafe.objects.some((entity) => entity.id === 'commercial-cafe-bottom-center-group-table-top' || entity.id === 'commercial-cafe-bottom-center-group-table-bottom')).toBe(false)
    expect(table.movementCollision).not.toBe('physical')
    expect(table.interactionContactSides).toBeUndefined()
    expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
    expect(snapshot.objects.get(table.id)!.collision!.height).toBeLessThan(3)
    expect(table.position.y).toBe(78)
    expect(seats).toHaveLength(4)
    expect(seats.every((seat) => seat.seat?.tableId === table.id)).toBe(true)
    expect(cafe.navigationBarriers.filter((barrier) => barrier.id.startsWith('commercial-cafe-bottom-center-group-'))).toHaveLength(4)
    const tableRoute = findMainlinePathToEntity(cafe, table.id, cafe.initialPlayerPosition)
    expect(isWalkableMainlinePoint(cafe.initialPlayerPosition, cafe)).toBe(true)
    expect(tableRoute.path).not.toBeNull()
  })

  it('assigns separate counter and floor staging duties while preserving a reachable customer contact region', () => {
    const staffZone = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const coffeeOwnerBehavior = mainlineNpcStagingBehavior(cafe, commercialCafeCoffeeOwnerNpcId)!
    const floorServerBehavior = mainlineNpcStagingBehavior(cafe, commercialCafeFloorServerNpcId)!
    const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, commercialCafeCoffeeOwnerNpcId)!
    const floorServerPosition = resolveMainlineNpcPosition(cafe, commercialCafeFloorServerNpcId)!
    const counterContact = mainlineNpcInteractionTarget(cafe, commercialCafeCoffeeOwnerNpcId, cafe.initialPlayerPosition)
    const counterCollision = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
    const counterLeft = counterCollision.x
    const counterRight = counterCollision.x + counterCollision.width
    const protagonist = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
    const clearance = protagonist.height / 2 + sharedFurnitureGeometry.actorContactGap

    expect(cafe.blockers.some((blocker) => blocker.id === 'commercial-cafe-staff-only')).toBe(false)
    expect(coffeeOwnerBehavior).toMatchObject({ dutyId: 'cafe-coffee-owner.counter-service', targetId: 'commercial-cafe-counter-service', targetKind: 'point' })
    expect(floorServerBehavior).toMatchObject({ dutyId: 'cafe-floor-server.table-service', targetId: 'commercial-cafe-floor-service-staging', targetKind: 'point' })
    expect(coffeeOwnerPosition.x).toBeGreaterThan(staffZone.x)
    expect(coffeeOwnerPosition.x).toBeLessThan(staffZone.x + staffZone.width)
    expect(coffeeOwnerPosition.y).toBeGreaterThan(staffZone.y)
    expect(coffeeOwnerPosition.y).toBeLessThan(staffZone.y + staffZone.height)
    expect(coffeeOwnerPosition.x).toBeCloseTo((counterLeft + counterRight) / 2)
    expect(coffeeOwnerPosition.y).toBeLessThan(counterCollision.y - clearance)
    expect(floorServerPosition.x === coffeeOwnerPosition.x && floorServerPosition.y === coffeeOwnerPosition.y).toBe(false)
    expect(floorServerPosition.x < staffZone.x || floorServerPosition.x > staffZone.x + staffZone.width
      || floorServerPosition.y < staffZone.y || floorServerPosition.y > staffZone.y + staffZone.height).toBe(true)
    expect(counterContact.y).toBeGreaterThan(counterCollision.y + counterCollision.height)
    expect(isWalkableMainlinePoint(counterContact, cafe)).toBe(true)
  })
})

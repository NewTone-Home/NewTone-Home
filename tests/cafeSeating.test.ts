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
const cafeCell = (column: number, row: number) => ({
  x: cafe.walkBounds.x + column * cafe.walkBounds.width / 22,
  y: cafe.walkBounds.y + cafe.walkBounds.height - row * cafe.walkBounds.height / 21,
})
const cafeLocalCell = (point: { x: number; y: number }) => ({
  column: (point.x - cafe.walkBounds.x) / (cafe.walkBounds.width / 22),
  row: (cafe.walkBounds.y + cafe.walkBounds.height - point.y) / (cafe.walkBounds.height / 21),
})

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
    const otherSeat = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-rear-group-chair-bottom')!

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
    expect(seat?.seat?.sit).toBeDefined()
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
    expect(route.path!.length).toBeGreaterThan(1)
    expect(route.path!.every((point) => isWalkableMainlinePoint(point, cafe, {}, options))).toBe(true)
  })

  // APPROVED CONTRACT MIGRATION: no invisible corridor closure. Passability
  // comes from visible table/chair gap versus the active actor footprint.
  it('keeps two-seat routes governed by visible table and chair footprints while preserving the exterior seat route', () => {
    const seatIds = [
      commercialCafeLaoZhouConversationSeatId,
      'commercial-cafe-preview-rear-group-chair-bottom',
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

  it('keeps three two-seat groups, preserves the existing story target and gives the reserved center a new identity', () => {
    const groupIds = cafe.furnitureGroups.map((group) => group.id)
    const seats = cafe.objects.filter((entity) => entity.kind === 'seat')
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
    const reservedGroupId = 'commercial-cafe-preview-middle-reserved-group'
    const reservedSeats = seats.filter((seat) => seat.groupId === reservedGroupId)
    const storyTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-upper-group-table')!
    const storySeat = cafe.objects.find((entity) => entity.id === laoZhouSeatId)!

    expect(groupIds).toEqual([
      'commercial-cafe-right-window-upper-group',
      reservedGroupId,
      'commercial-cafe-preview-rear-group',
    ])
    expect(seats).toHaveLength(6)
    expect(reservedSeats).toHaveLength(2)
    expect(reservedSeats.map((seat) => seat.id)).not.toContain(laoZhouSeatId)
    expect(reservedSeats.every((seat) => seat.id.startsWith(`${reservedGroupId}-`))).toBe(true)
    expect(storySeat.seat?.tableId).toBe(storyTable.id)
    expect(storyTable.position.x).toBeCloseTo(cafeCell(15, 7).x)
    expect(storyTable.position.y).toBeCloseTo(cafeCell(15, 7).y)
    expect(cafe.objects.some((entity) => entity.groupId?.includes('commercial-cafe-bottom-'))).toBe(false)

    for (const [groupId, column, row] of [
      ['commercial-cafe-right-window-upper-group', 15, 7],
      [reservedGroupId, 18, 11],
      ['commercial-cafe-preview-rear-group', 15, 16],
    ] as const) {
      const table = cafe.objects.find((entity) => entity.id === `${groupId}-table`)!
      const groupSeats = seats.filter((seat) => seat.groupId === groupId)
      expect(table.position.x).toBeCloseTo(cafeCell(column, row).x)
      expect(table.position.y).toBeCloseTo(cafeCell(column, row).y)
      expect(groupSeats).toHaveLength(2)
      expect(groupSeats.every((seat) => seat.seat?.tableId === table.id)).toBe(true)
      expect(table.movementCollision).not.toBe('physical')
      expect(table.interactionContactSides).toBeUndefined()
      expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
      expect(cafe.navigationBarriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(2)
    }
  })

  it('maps the L counter, service labels and open storage to distinct one-glyph grid cells', () => {
    const counter = cafe.objects.filter((entity) => /^commercial-cafe-counter(?:-\d+)?$/.test(entity.id))
    const counterCells = counter.map((entity) => ({ entity, local: cafeLocalCell(entity.position) }))
    const main = counterCells.filter(({ local }) => Math.abs(local.row - 16) < 0.01).sort((a, b) => a.local.column - b.local.column)
    const returned = counterCells.filter(({ local }) => Math.abs(local.column - 11) < 0.01 && local.row >= 17 && local.row <= 19)
      .sort((a, b) => a.entity.position.y - b.entity.position.y)
    const mainBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
    const returnBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-return-body')!
    const cellKeys = counterCells.map(({ local }) => `${Math.round(local.column)}:${Math.round(local.row)}`)

    expect(main).toHaveLength(6)
    expect(main.map(({ entity }) => entity.label).join('')).toBe('柜台柜台柜台')
    expect(main.map(({ local }) => Math.round(local.column))).toEqual([6, 7, 8, 9, 10, 11])
    expect(returned).toHaveLength(3)
    expect(returned.map(({ entity }) => entity.label).join('')).toBe('柜台柜')
    expect(new Set(cellKeys).size).toBe(9)
    expect(counter.every(({ label }) => Array.from(label).length === 1)).toBe(true)
    expect(main.every(({ entity }) => entity.interactionStructureId === mainBody.id)).toBe(true)
    expect(returned.every(({ entity }) => entity.interactionBehavior === undefined)).toBe(true)
    expect(mainBody.kind).toBe('counter')
    expect(returnBody.kind).toBe('counter')
    expect(returnBody.y + returnBody.height).toBeCloseTo(mainBody.y, 5)
    expect(mainBody.x).toBeCloseTo(cafeCell(6, 16).x - cafe.walkBounds.width / 44, 5)
    expect(mainBody.width).toBeCloseTo(cafe.walkBounds.width / 22 * 6, 5)

    for (const [id, text, column, row] of [
      ['commercial-cafe-service-menu', '菜单', 4, 3],
      ['commercial-cafe-service-order', '点单', 6, 4],
      ['commercial-cafe-open-storage', '储物', 2, 19],
    ] as const) {
      const glyphs = cafe.objects.filter((entity) => entity.id.startsWith(`${id}-`)).sort((a, b) => a.position.x - b.position.x)
      expect(glyphs.map((entity) => entity.label).join('')).toBe(text)
      expect(glyphs.every((entity, index) => {
        const local = cafeLocalCell(entity.position)
        return Math.abs(local.column - column - index) < 0.01 && Math.abs(local.row - row) < 0.01
          && entity.interactive === false && entity.collision === undefined
      })).toBe(true)
    }
  })

  it('keeps cafe customers, all six chair approaches, the center aisle, staff route and locked rear door reachable', () => {
    const frontPortal = cafe.portals.find((portal) => portal.id === 'street-cafe-entry')!
    const rearPortal = cafe.portals.find((portal) => portal.id === 'cafe-back-door')!
    const customerPoint = cafeCell(6, 4)
    const staffPoint = cafeCell(8.5, 18)
    const ownerOptions = { actorId: commercialCafeCoffeeOwnerNpcId }

    expect(frontPortal.access).toBe('open')
    expect(frontPortal.endpoint).toMatchObject({ doorPosition: { x: 8, y: 68 }, threshold: { x: 12, y: 68 }, crossingTarget: { x: 10, y: 68 } })
    expect(rearPortal.access).toBe('locked')
    expect(rearPortal.endpoint).toMatchObject({ doorPosition: { x: 48, y: 7 }, threshold: { x: 48, y: 12 }, crossingTarget: { x: 48, y: 9 } })
    expect(cafe.walkBounds).toEqual({ x: 8, y: 7, width: 90, height: 86 })
    expect(cafe.viewport).toBe('fixed-frame')
    expect(findMainlinePath(cafe.initialPlayerPosition, customerPoint, cafe)).not.toBeNull()
    expect(findMainlinePath(cafe.initialPlayerPosition, staffPoint, cafe)).toBeNull()
    expect(findMainlinePath(cafe.initialPlayerPosition, staffPoint, cafe, {}, ownerOptions)).not.toBeNull()
    expect(findMainlinePath(staffPoint, rearPortal.endpoint.threshold, cafe, {}, ownerOptions)).not.toBeNull()

    for (const column of [11, 12]) {
      expect(findMainlinePath(cafeCell(column, 1), cafeCell(column, 20), cafe), `central aisle column ${column}`).not.toBeNull()
    }
    for (const seat of cafe.objects.filter((entity) => entity.kind === 'seat')) {
      expect(seat.seat?.sit).toBeDefined()
      expect(seat.seat?.pulled).toBeDefined()
      expect(findMainlinePathToEntity(cafe, seat.id, cafe.initialPlayerPosition).path, `${seat.id} pull/stand approach`).not.toBeNull()
      const approachRow = seat.groupId === 'commercial-cafe-right-window-upper-group' ? 7
        : seat.groupId === 'commercial-cafe-preview-middle-reserved-group' ? 11 : 16
      expect(findMainlinePathToEntity(cafe, seat.id, cafeCell(13, approachRow)).path, `${seat.id} approach from central aisle`).not.toBeNull()
    }
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

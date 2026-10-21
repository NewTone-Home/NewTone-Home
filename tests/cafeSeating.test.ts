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
import { currentCafeStart, currentCafeOptions, currentCafeRoom } from './helpers/currentCafe'

describe('commercial cafe seating and staging', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhouSeatId = 'commercial-cafe-right-window-upper-group-chair-top'

  it('derives Lao Zhou staging from behavior while occupancy remains only a set of seat ids', () => {
    const behavior = mainlineNpcStagingBehavior(cafe, 'lao-zhou')
    const occupiedSeatIds = mainlineSceneOccupiedSeatIds(cafe)

    expect(cafe.npcPlacements.filter(p => ['lao-zhou', commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId].includes(p.npcId))).toEqual([])
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
    const otherSeat = cafe.objects.find((entity) => entity.id === 'cafe-trial-table-group-4-chair-bottom')!

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
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, currentCafeStart, {
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
    const dot = mainlineProtagonistDotFootprint(currentCafeStart)
    const options = { actorId: 'protagonist', actorFootprint: { width: dot.width, height: dot.height } }
    const candidates = mainlineEntityInteractionCandidates(cafe, commercialCafeLaoZhouConversationSeatId, currentCafeStart, {}, options.actorFootprint, options)
    const approach = candidates.find((candidate) => candidate.y > seat!.collision!.y + seat!.collision!.height)!
    const selectedContact = mainlineInteractionTarget(cafe, commercialCafeLaoZhouConversationSeatId, currentCafeStart, {}, undefined, options)
    const path = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, currentCafeStart)

    expect(seat?.seat?.sit).toBeDefined()
    expect(seat?.seat?.sit).toEqual(seat?.position)
    expect(candidates).toHaveLength(4)
    expect(candidates).toContainEqual(selectedContact)
    expect(approach.y).toBeGreaterThan(seat!.collision!.y + seat!.collision!.height)
    expect(resolveMainlineSeatSitPosition(cafe, commercialCafeLaoZhouConversationSeatId)).toEqual(seat?.position)
    expect(isWalkableMainlinePoint(approach, cafe)).toBe(true)
    expect(path.path).not.toBeNull()
  })

  it('routes from Lao Zhou\'s table-side contact around the table before reaching the opposite free seat', () => {
    const screenMetrics = currentCafeOptions.screenMetrics
    const runtime = createNavigationRuntime()
    for (const npcId of ['lao-zhou', commercialCafeCoffeeOwnerNpcId, commercialCafeFloorServerNpcId]) {
      const npc = cafe.npcs.find((candidate) => candidate.id === npcId)!
      const position = resolveMainlineNpcPosition(cafe, npcId)
      const footprint = mainlineLabelFootprint(npc.label, position, screenMetrics, { lineHeight: 1 })
      runtime.registerActor(npcId, position, { width: footprint.width, height: footprint.height })
    }
    const initialDot = mainlineProtagonistDotFootprint(currentCafeStart, screenMetrics)
    const initialOptions = {
      actorId: 'protagonist',
      navigationRuntime: runtime,
      screenMetrics,
      actorFootprint: { width: initialDot.width, height: initialDot.height },
    }
    // This is the shared NPC resolver's current table-side contact, not an
    // individually tuned café coordinate.
    const from = mainlineNpcInteractionTarget(cafe, 'lao-zhou', currentCafeStart, {}, undefined, initialOptions)
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
  it('keeps the approved six-pixel table-chair gaps visibly open but impassable, with legal outer seat routes', () => {
 const seats = cafe.objects.filter(o => o.roomId === currentCafeRoom.id && o.seat)
 expect(seats).toHaveLength(8)
 const snapshot = createMainlineSceneGeometrySnapshot(cafe, currentCafeStart, {}, currentCafeOptions.screenMetrics)
 for (const seat of seats) {
  const table = snapshot.objects.get(seat.seat!.tableId)!, chair = snapshot.objects.get(seat.id)!
  const gap = Math.abs(chair.position.y - table.position.y) - (chair.collision!.height + table.collision!.height) / 2
  expect(gap * 10.8).toBeCloseTo(6, 3)
  const center = { x: table.position.x, y: (chair.position.y + table.position.y) / 2 }
  for (const size of [11,16]) expect(isWalkableMainlinePoint(center,cafe,{}, { ...currentCafeOptions, actorFootprint:{width:size/19.2,height:size/10.8} })).toBe(false)
  expect(findMainlinePathToEntity(cafe,seat.id,currentCafeStart,{},currentCafeOptions).path,seat.id).not.toBeNull()
 }
})

  // APPROVED CONTRACT MIGRATION: four-seat furniture now has only visible
  // object footprints plus its four table-chair relation barriers.
  it('uses four current two-seat groups with character-sized table bodies and no retired four-seat or invisible relation objects', () => {
 const tables = cafe.objects.filter(o => o.roomId === currentCafeRoom.id && o.kind === 'table')
 expect(tables).toHaveLength(4)
 const snapshot = createMainlineSceneGeometrySnapshot(cafe,currentCafeStart,{},currentCafeOptions.screenMetrics)
 for (const table of tables) {
  const seats = cafe.objects.filter(o => o.seat?.tableId === table.id)
  expect(seats).toHaveLength(2)
  expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table,table.position,currentCafeOptions.screenMetrics))
  expect(snapshot.objects.get(table.id)!.collision!.width*19.2).toBeCloseTo(32,2)
  expect(snapshot.objects.get(table.id)!.collision!.height*10.8).toBeCloseTo(16,2)
  expect(findMainlinePathToEntity(cafe,table.id,currentCafeStart,{},currentCafeOptions).path).not.toBeNull()
 }
 expect(cafe.objects.some(o=>o.id.startsWith('commercial-cafe-bottom-center-group'))).toBe(false)
 expect(cafe.navigationBarriers.filter(b=>b.id.includes('cafe')&&b.kind!=='access-boundary')).toHaveLength(0)
})

  it('assigns separate counter and floor staging duties while preserving a reachable customer contact region', () => {
 const staff = cafe.accessRegions.find(r=>r.id==='commercial-cafe-staff-area')!
 const owner = resolveMainlineNpcPosition(cafe,commercialCafeCoffeeOwnerNpcId)
 const floor = resolveMainlineNpcPosition(cafe,commercialCafeFloorServerNpcId)
 const body = cafe.continuousStructures.find(s=>s.id==='cafe-trial-counter-long-body')!
 expect(mainlineNpcStagingBehavior(cafe,commercialCafeCoffeeOwnerNpcId)).toMatchObject({dutyId:'cafe-coffee-owner.counter-service',targetId:'commercial-cafe-counter-service',targetKind:'point'})
 expect(mainlineNpcStagingBehavior(cafe,commercialCafeFloorServerNpcId)).toMatchObject({dutyId:'cafe-floor-server.table-service',targetId:'commercial-cafe-floor-service-staging',targetKind:'point'})
 expect(owner.x).toBeGreaterThan(staff.x);expect(owner.x).toBeLessThan(staff.x+staff.width)
 expect(floor.x).toBeGreaterThan(staff.x+staff.width)
 expect(isWalkableMainlinePoint(owner,cafe,{}, {...currentCafeOptions,actorId:commercialCafeCoffeeOwnerNpcId})).toBe(true)
 const contact = mainlineNpcInteractionTarget(cafe,commercialCafeCoffeeOwnerNpcId,currentCafeStart,{},undefined,currentCafeOptions)
 expect(contact.x).toBeGreaterThan(body.x+body.width)
 expect(isWalkableMainlinePoint(contact,cafe,{},currentCafeOptions)).toBe(true)
 expect(findMainlinePath(currentCafeStart,contact,cafe,{},currentCafeOptions)).not.toBeNull()
})
})

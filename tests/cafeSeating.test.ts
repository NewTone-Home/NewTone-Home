import { describe, expect, it } from 'vitest'
import { commercialCafeLaoZhouConversationSeatId } from '../src/center/runtime/commercialCafeStory'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, mainlineInteractionTarget, mainlineNpcInteractionTarget, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isMainlineSeatAvailable, isMainlineSeatLabelSuppressed, isMainlineSeatPrompted, mainlineProtagonistPresentation, mainlineSceneOccupiedSeatIds, mainlineSeatedActorVisualPosition, nextMainlinePlayerSeatId } from '../src/center/runtime/mainlineSeating'
import { sharedFurnitureGeometry } from '../src/center/runtime/twoSeatFurniture'
import { mainlineNpcStagedSeatId, mainlineNpcStagingBehavior } from '../src/center/runtime/mainlineNpcStaging'

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

  it('keeps seated actor runtime positions at sit points while rendering occupant labels at the projected seat center', () => {
    const seat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)!
    const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition, {
      [seat.groupId!]: seat.seat!.pulled,
    })
    const renderedSeatCenter = snapshot.objects.get(seat.id)!.position
    const runtimePosition = resolveMainlineSeatSitPosition(cafe, seat.id, snapshot.layout, { geometrySnapshot: snapshot })!

    expect(renderedSeatCenter).not.toEqual(seat.position)
    expect(runtimePosition.x).toBe(renderedSeatCenter.x)
    expect(runtimePosition.y - renderedSeatCenter.y).toBe(seat.seat!.sit.y - seat.position.y)
    expect(mainlineSeatedActorVisualPosition(runtimePosition, seat.id, renderedSeatCenter)).toEqual(renderedSeatCenter)
    expect(mainlineSeatedActorVisualPosition(runtimePosition, null, renderedSeatCenter)).toEqual(runtimePosition)
  })

  it('keeps a free seat spatially reachable while seating resolves to its authored sit point', () => {
    const seat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)
    const approach = mainlineInteractionTarget(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition)
    const path = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition)

    expect(seat?.seat?.sit).toBeDefined()
    expect(seat?.seat?.sit).toEqual({ x: 84, y: 31.4 })
    expect(approach).toEqual(seat?.seat?.pulled)
    expect(resolveMainlineSeatSitPosition(cafe, commercialCafeLaoZhouConversationSeatId)).toEqual(seat?.seat?.sit)
    expect(isWalkableMainlinePoint(approach, cafe)).toBe(true)
    expect(path.path).not.toBeNull()
  })

  it('closes ordinary table-seat corridors for two-seat and four-seat groups while preserving the pulled seat route', () => {
    const seatIds = [
      commercialCafeLaoZhouConversationSeatId,
      'commercial-cafe-bottom-left-group-chair-bottom',
    ]

    for (const seatId of seatIds) {
      const seat = cafe.objects.find((entity) => entity.id === seatId)!
      const table = cafe.objects.find((entity) => entity.id === seat.seat!.tableId)!
      const seatCollision = seat.collision!
      const tableCollision = table.collision!
      const gapCenter = seat.seat!.side === 'bottom' || seat.seat!.side === 'top'
        ? { x: tableCollision.x + tableCollision.width / 2, y: (tableCollision.y + tableCollision.height + seatCollision.y) / 2 }
        : { x: (tableCollision.x + tableCollision.width + seatCollision.x) / 2, y: tableCollision.y + tableCollision.height / 2 }

      expect(isWalkableMainlinePoint(gapCenter, cafe)).toBe(false)
      expect(findMainlinePathToEntity(cafe, seatId, cafe.initialPlayerPosition).path).not.toBeNull()
      const exteriorStart = { x: tableCollision.x - 5, y: gapCenter.y }
      const exteriorEnd = { x: tableCollision.x + tableCollision.width + 5, y: gapCenter.y }
      const exteriorRoute = findMainlinePath(exteriorStart, exteriorEnd, cafe)
      expect(exteriorRoute).not.toBeNull()
      expect(exteriorRoute?.every((point) => isWalkableMainlinePoint(point, cafe))).toBe(true)
    }
  })

  it('derives server staging from a semantic ambient duty while preserving a reachable customer contact region', () => {
    const staffZone = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const serverBehavior = mainlineNpcStagingBehavior(cafe, 'server')!
    const serverPosition = resolveMainlineNpcPosition(cafe, 'server')
    const serverContact = mainlineNpcInteractionTarget(cafe, 'server', cafe.initialPlayerPosition)
    const counterSegments = cafe.objects.filter((entity) => entity.id === 'commercial-cafe-counter' || entity.id.startsWith('commercial-cafe-counter-'))
    const counterLeft = Math.min(...counterSegments.map((entity) => entity.collision!.x))
    const counterRight = Math.max(...counterSegments.map((entity) => entity.collision!.x + entity.collision!.width))
    const counterCollision = counterSegments[0]!.collision!
    const clearance = sharedFurnitureGeometry.playerRadius + sharedFurnitureGeometry.actorContactGap

    expect(cafe.blockers.some((blocker) => blocker.id === 'commercial-cafe-staff-only')).toBe(false)
    expect(serverBehavior).toMatchObject({ dutyId: 'server.counter-service', targetId: 'commercial-cafe-counter-service', targetKind: 'point' })
    expect(serverPosition.x).toBeGreaterThan(staffZone.x)
    expect(serverPosition.x).toBeLessThan(staffZone.x + staffZone.width)
    expect(serverPosition.y).toBeGreaterThan(staffZone.y)
    expect(serverPosition.y).toBeLessThan(staffZone.y + staffZone.height)
    expect(serverPosition.x).toBeCloseTo((counterLeft + counterRight) / 2)
    expect(serverPosition.y).toBeLessThan(counterCollision.y - clearance)
    expect(serverContact.y).toBeGreaterThan(counterCollision.y + counterCollision.height)
    expect(isWalkableMainlinePoint(serverContact, cafe)).toBe(true)
  })
})

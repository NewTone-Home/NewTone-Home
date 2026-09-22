import { describe, expect, it } from 'vitest'
import { commercialCafeLaoZhouConversationSeatId } from '../src/center/runtime/commercialCafeStory'
import { findMainlinePathToEntity, isWalkableMainlinePoint, mainlineInteractionTarget, mainlineNpcInteractionTarget, resolveMainlineNpcPosition, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isMainlineSeatAvailable, isMainlineSeatLabelSuppressed, isMainlineSeatPrompted, mainlineProtagonistPresentation, mainlineSceneOccupiedSeatIds, nextMainlinePlayerSeatId } from '../src/center/runtime/mainlineSeating'
import { sharedFurnitureGeometry } from '../src/center/runtime/twoSeatFurniture'

describe('commercial cafe seating and staging', () => {
  const cafe = mainlineScenes['commercial-cafe']
  const laoZhouSeatId = 'commercial-cafe-right-window-upper-group-chair-top'

  it('uses placement for Lao Zhou while occupancy remains only a set of seat ids', () => {
    const placement = cafe.npcPlacements.find((candidate) => candidate.npcId === 'lao-zhou')
    const occupiedSeatIds = mainlineSceneOccupiedSeatIds(cafe)

    expect(placement).toEqual({ npcId: 'lao-zhou', seatId: laoZhouSeatId })
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

  it('derives the server home from the counter staff side while preserving a reachable customer contact point', () => {
    const staffZone = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
    const serverPlacement = cafe.npcPlacements.find((candidate) => candidate.npcId === 'server')!
    const serverPosition = resolveMainlineNpcPosition(cafe, 'server')
    const serverContact = mainlineNpcInteractionTarget(cafe, 'server', cafe.initialPlayerPosition)
    const counterSegments = cafe.objects.filter((entity) => entity.id === 'commercial-cafe-counter' || entity.id.startsWith('commercial-cafe-counter-'))
    const counterLeft = Math.min(...counterSegments.map((entity) => entity.collision!.x))
    const counterRight = Math.max(...counterSegments.map((entity) => entity.collision!.x + entity.collision!.width))
    const counterCollision = counterSegments[0]!.collision!
    const clearance = sharedFurnitureGeometry.playerRadius + sharedFurnitureGeometry.actorContactGap

    expect(cafe.blockers.some((blocker) => blocker.id === 'commercial-cafe-staff-only')).toBe(false)
    expect(serverPlacement.position).toEqual(serverPosition)
    expect(serverPosition.x).toBeGreaterThan(staffZone.x)
    expect(serverPosition.x).toBeLessThan(staffZone.x + staffZone.width)
    expect(serverPosition.y).toBeGreaterThan(staffZone.y)
    expect(serverPosition.y).toBeLessThan(staffZone.y + staffZone.height)
    expect(serverPosition.x).toBeCloseTo((counterLeft + counterRight) / 2)
    expect(serverPosition.y).toBeCloseTo(counterCollision.y - clearance)
    expect(serverPlacement.interactionApproach).toEqual(serverContact)
    expect(serverContact.y).toBeCloseTo(counterCollision.y + counterCollision.height + clearance)
    expect(isWalkableMainlinePoint(serverContact, cafe)).toBe(true)
  })
})

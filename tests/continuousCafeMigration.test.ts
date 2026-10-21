import { describe, it, expect } from 'vitest'
import { mainlineScenes, mainlineSceneRoute, resolveMainlineSceneId, resolveLegacyCafeEntryPosition, legacyCafeEntryPosition, getMainlineSceneEntity } from '../src/center/runtime/mainlineScenes'
import { mainlineSceneBlueprints } from '../src/center/runtime/mainlineSceneModel'
import { sanitizePlayerSave, createInitialPlayerSave } from '../src/center/runtime/playerSave'
import { hasContinuousCafe, continuousCafeRoomId, cafeStoryTableId, cafeConversationSeatId, isPointInContinuousCafe } from '../src/center/runtime/continuousCafe'
import { isWalkableMainlinePoint, resolveMainlineSafeSpawnPosition, findMainlinePath, findMainlinePathToEntity, canActorReachPassageApproach, resolveMainlineNpcPosition, canTravelAlongMainlineSegment } from '../src/center/runtime/mainlineNavigation'
import { commercialCafeStoryStateFromSceneState, resolveCommercialCafeCoffeePrepIntent, resolveCommercialCafeCoffeeDeliveryIntent, resolveCommercialCafeNpcInteraction, shouldCompleteCommercialCafeStoryOnTransition } from '../src/center/runtime/commercialCafeStory'
import { mainlineNpcStagedPoint, mainlineNpcStagedSeatId } from '../src/center/runtime/mainlineNpcStaging'
import { mainlineSceneOccupiedSeatIds } from '../src/center/runtime/mainlineSeating'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const options = { screenMetrics: sceneDesignReferenceMetrics }
const counterPublicContact = mainlineScenes['commercial-street'].objects.find(o => o.id === 'cafe-trial-order')!.position
describe('retired standalone Cafe compatibility in one continuous world', () => {
  it('keeps the actual conversation chair reachable from the customer counter contact', () => {
    const result = findMainlinePathToEntity(street, cafeConversationSeatId, counterPublicContact, {}, options)
    expect(result?.path).not.toBeNull()
    expect(result?.path?.length).toBeGreaterThan(1)
  })
  it('routes Lao Zhou around the semantic staff region instead of rejecting a path through it', () => {
    const npcOptions = { ...options, actorId: 'lao-zhou', occupiedSeatIds: mainlineSceneOccupiedSeatIds(street) }
    const from = resolveMainlineNpcPosition(street, 'lao-zhou', {}, npcOptions)
    const passage = street.passages.find(p => p.id === 'street-cafe-entry')!
    const route = canActorReachPassageApproach(street, passage, from, {}, npcOptions)
    expect(route).not.toBeNull()
    for (let i = 1; i < route!.path.length; i++) expect(canTravelAlongMainlineSegment(route!.path[i - 1], route!.path[i], street, {}, npcOptions)).toBe(true)
    const region = street.accessRegions.find(region => region.id === 'commercial-cafe-staff-area')!
    const target = { x: region.x + region.width / 2, y: region.y + region.height / 2 }
    expect(isWalkableMainlinePoint(target, street, {}, npcOptions)).toBe(false)
    expect(isWalkableMainlinePoint(target, street, {}, { ...npcOptions, actorId: 'cafe-coffee-owner' })).toBe(true)
  })

  it('does not generate or enumerate a second Cafe world; compatibility lookup is the same object', () => {
    expect(Object.keys(mainlineScenes)).not.toContain('commercial-cafe')
    expect(Object.keys(mainlineSceneBlueprints)).not.toContain('commercial-cafe')
    expect(mainlineScenes['commercial-cafe']).toBe(street)
    expect(mainlineSceneBlueprints['commercial-cafe']).toBe(mainlineSceneBlueprints['commercial-street'])
    expect(street.structures.some(wall => wall.id === 'commercial-cafe-room')).toBe(false)
    expect(street.curves.some(curve => curve.id === 'commercial-cafe-glass-front')).toBe(false)
    expect(street.rooms.filter(room => room.id === continuousCafeRoomId)).toHaveLength(1)
    expect(street.passages.find(passage => passage.id === 'street-cafe-entry')).toMatchObject({ routeThrough: true, access: 'open', toRoomId: continuousCafeRoomId })
    expect(street.passages.find(passage => passage.id === `${continuousCafeRoomId}-rear-door`)).toMatchObject({ access: 'locked' })
  })

  it('redirects legacy URLs and route construction to the actual continuous Cafe doorway', () => {
    expect(resolveMainlineSceneId('?scene=commercial-cafe')).toBe('commercial-street')
    const entry = resolveLegacyCafeEntryPosition('?scene=commercial-cafe')!
    expect(entry).toEqual(legacyCafeEntryPosition())
    expect(isPointInContinuousCafe(street, entry)).toBe(true)
    expect(isWalkableMainlinePoint(entry, street, {}, options)).toBe(true)
    expect(mainlineSceneRoute('commercial-cafe')).toBe(mainlineSceneRoute('commercial-street', entry))
    expect(resolveLegacyCafeEntryPosition('?scene=commercial-street')).toBeUndefined()
  })

  it.each([{ x: 18, y: 68 }, { x: 84, y: 26 }, { x: 48, y: 20 }])('migrates a legacy room save once, retaining all story/contact/item state: %j', oldPoint => {
    const old = { ...createInitialPlayerSave('commercial-cafe'), currentPosition: oldPoint, scenePositions: { 'commercial-cafe': oldPoint }, sceneState: { 'commercial-cafe': { commercialCafeNarrativeCursor: 5, commercialCafeCoffeeStatus: 'ready', commercialCafeStoryStatus: 'available' }, 'commercial-street': { milkTeaHeld: true } }, phoneContactNotes: { old: 'kept' } }
    const migrated = sanitizePlayerSave(old, 'commercial-street')
    expect(migrated.currentSceneId).toBe('commercial-street')
    expect(isPointInContinuousCafe(street, migrated.currentPosition!)).toBe(true)
    const safe = resolveMainlineSafeSpawnPosition(street, migrated.currentPosition, {}, options)!
    expect(safe).not.toBeNull()
    expect(isPointInContinuousCafe(street, safe)).toBe(true)
    expect(migrated.scenePositions['commercial-cafe']).toBeUndefined()
    expect(migrated.sceneState).toEqual(old.sceneState)
    expect(migrated.phoneContactNotes).toEqual(old.phoneContactNotes)
    expect(sanitizePlayerSave(migrated, 'commercial-street')).toEqual(migrated)
  })

  it('keeps ordinary street and other-world continuation in place', () => {
    for (const currentSceneId of ['commercial-street', 'zhongshuyuan-office'] as const) {
      const old = { ...createInitialPlayerSave(currentSceneId), currentPosition: { x: 80, y: 50 }, scenePositions: { [currentSceneId]: { x: 80, y: 50 } } }
      expect(sanitizePlayerSave(old, 'commercial-street')).toMatchObject(old)
    }
  })

  it('retains the conversation table/seat/NPC identity and coffee prep/delivery triggers in the live room', () => {
    expect(hasContinuousCafe(street)).toBe(true)
    expect(getMainlineSceneEntity(street, cafeStoryTableId).roomId).toBe(continuousCafeRoomId)
    expect(getMainlineSceneEntity(street, cafeConversationSeatId).seat?.tableId).toBe(cafeStoryTableId)
    expect(mainlineNpcStagedSeatId(street, 'lao-zhou')).toBe('commercial-cafe-right-window-upper-group-chair-top')
    const story = commercialCafeStoryStateFromSceneState(undefined)
    expect(resolveCommercialCafeNpcInteraction({ sceneId: street.id, npcId: 'lao-zhou', story, playerSeatId: cafeConversationSeatId })).toEqual({ kind: 'start-narrative' })
    expect(resolveCommercialCafeCoffeeDeliveryIntent({ scene: street, coffeeStatus: 'ready', narrativePhase: 'coffee-delivery' })?.targetEntityId).toBe(cafeStoryTableId)
    const prep = resolveCommercialCafeCoffeePrepIntent(street)!
    expect(prep.targetId).toBe('commercial-cafe-prep-station')
    expect(findMainlinePath(mainlineNpcStagedPoint(street, 'cafe-coffee-owner')!, prep.target!, street, {}, { ...options, actorId: 'cafe-coffee-owner' })).not.toBeNull()
  })

  it('completes the old leaving beat only across the real Cafe front from inside to street', () => {
    const story = { ...commercialCafeStoryStateFromSceneState(undefined), status: 'ready-to-leave' as const }
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: street.id, story, targetSceneId: street.id, passageId: 'street-cafe-entry', leavingRoom: true })).toBe(true)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: street.id, story, targetSceneId: street.id, passageId: 'street-cafe-entry', leavingRoom: false })).toBe(false)
    expect(shouldCompleteCommercialCafeStoryOnTransition({ sceneId: street.id, story, targetSceneId: street.id, passageId: 'commercial-north-slot-1-entry', leavingRoom: true })).toBe(false)
  })
})

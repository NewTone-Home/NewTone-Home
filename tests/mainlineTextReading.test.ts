import { describe, expect, it } from 'vitest'
import { mainlineAvailableReadingWidthPx, mainlineCanRenderFirstReadingGlyph, mainlineInteractionRoom, mainlineInteractionSpace, mainlineIsInteriorSpace, mainlineMaximumReadingWidthPx, mainlineReadingActorOpacity, mainlineReadingBounds, mainlineReadingCameraOffset, mainlineReadingFadeTransitionMs, mainlineReadingFontSizePx, mainlineReadingStaticOpacity, mainlineReadingStaticOpacityForBoundsUnion, mainlineObservationTypingIntervalMs, mainlineReadingOpacityForActor, resolveMainlineDialogueParticipants } from '../src/center/runtime/mainlineTextReading'
import type { MainlineSceneDialogue } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline reading-space effects', () => {
  it('keeps the existing compact-portrait CSS reading size', () => {
    expect(mainlineReadingFontSizePx({ width: 411, height: 914 })).toBe(12)
  })

  it('uses the approved slower local fade and observation typing timings', () => {
    expect(mainlineReadingFadeTransitionMs).toBe(400)
    expect(mainlineObservationTypingIntervalMs).toBe(45)
  })

  it('lets static objects reach full transparency at the text and recover outside its fade area', () => {
    const reading = { x: 50, y: 50 }
    const box = { widthPx: 180, heightPx: 40 }
    expect(mainlineReadingStaticOpacity(reading, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 50.5, y: 50 }, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 55, y: 50 }, reading, box, 1)).toBeGreaterThan(0)
    expect(mainlineReadingStaticOpacity({ x: 80, y: 50 }, reading, box, 1)).toBe(1)
  })

  it('fades a whole L counter from the union of its legs without treating the empty corner as counter', () => {
    const lCounter = [
      { x: 40, y: 0, width: 4, height: 30 },
      { x: 0, y: 28, width: 44, height: 4 },
    ]
    const box = { widthPx: 120, heightPx: 40 }

    expect(mainlineReadingStaticOpacityForBoundsUnion(lCounter, { x: 10, y: 10 }, box, 1)).toBe(1)
    expect(mainlineReadingStaticOpacityForBoundsUnion(lCounter, { x: 20, y: 30 }, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacityForBoundsUnion(lCounter, { x: 42, y: 10 }, box, 1)).toBe(0)
  })

  it('keeps actors visible while marking actors crossing the reading surface semi-transparent', () => {
    const reading = { x: 50, y: 50 }
    const box = { widthPx: 180, heightPx: 40 }
    expect(mainlineReadingActorOpacity(reading, reading, box, 1)).toBe(.44)
    expect(mainlineReadingActorOpacity({ x: 80, y: 50 }, reading, box, 1)).toBe(1)
  })

  it('uses whichever authored interior contains the protagonist, not only the Cafe id', () => {
    const source = mainlineScenes['commercial-street']
    const room = { id: 'test-interior', kind: 'room' as const, bounds: { x: 30, y: 30, width: 40, height: 40 } }
    const scene = { ...source, rooms: [room] }
    const position = { x: 45, y: 55 }
    expect(mainlineInteractionSpace(scene, position)).toEqual(room.bounds)
    expect(mainlineIsInteriorSpace(scene, position)).toBe(true)
  })

  it('uses authored corridor and room bounds as exclusive text spaces, with public corridor ownership on shared edges', () => {
    const city = mainlineScenes['commercial-street']
    const lane = city.rooms.find(room => room.id === 'commercial-street-public-lane')!
    const cityLanePoint = { x: lane.bounds.x + lane.bounds.width / 2, y: lane.bounds.y + lane.bounds.height / 2 }
    expect(mainlineInteractionRoom(city, cityLanePoint)?.id).toBe(lane.id)
    expect(mainlineInteractionSpace(city, cityLanePoint)).toEqual(lane.bounds)
    for (const shop of city.rooms.filter(room => room.id.endsWith('-interior'))) {
      const shopPoint = { x: shop.bounds.x + shop.bounds.width / 2, y: shop.bounds.y + shop.bounds.height / 2 }
      expect(mainlineInteractionRoom(city, shopPoint)?.id).toBe(shop.id)
      expect(mainlineInteractionSpace(city, shopPoint)).toEqual(shop.bounds)
    }
    const citySharedShop = city.rooms.find(room => room.id.endsWith('-interior')
      && Math.abs(room.bounds.y + room.bounds.height - lane.bounds.y) < .001
      && room.bounds.x < lane.bounds.x + lane.bounds.width && room.bounds.x + room.bounds.width > lane.bounds.x)
    if (!citySharedShop) throw new Error('Commercial Street needs an authored shop-to-lane boundary.')
    const cityDoorEdge = { x: Math.max(citySharedShop.bounds.x, lane.bounds.x), y: lane.bounds.y }
    expect(mainlineInteractionRoom(city, cityDoorEdge)?.id).toBe(lane.id)

    const office = mainlineScenes['zhongshuyuan-office']
    const corridor = office.rooms.find(room => room.id === 'zhongshuyuan-office-corridor')!
    const officeRoom = office.rooms.find(room => room.id === 'zhongshuyuan-office-north-room-1')!
    const corridorPoint = { x: corridor.bounds.x + corridor.bounds.width / 2, y: corridor.bounds.y + corridor.bounds.height / 2 }
    const officePoint = { x: officeRoom.bounds.x + officeRoom.bounds.width / 2, y: officeRoom.bounds.y + officeRoom.bounds.height / 2 }
    expect(mainlineInteractionRoom(office, corridorPoint)?.id).toBe(corridor.id)
    expect(mainlineInteractionRoom(office, officePoint)?.id).toBe(officeRoom.id)
    expect(mainlineInteractionSpace(office, officePoint)).toEqual(officeRoom.bounds)
  })

  it('keeps mining street and each shop separate instead of falling back to the full walk bounds', () => {
    for (const sceneId of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[sceneId]
      const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!
      const lanePoint = { x: lane.bounds.x + lane.bounds.width / 2, y: lane.bounds.y + lane.bounds.height / 2 }
      expect(mainlineInteractionRoom(scene, lanePoint)?.id).toBe(lane.id)
      expect(mainlineInteractionSpace(scene, lanePoint)).toEqual(lane.bounds)
      expect(mainlineInteractionSpace(scene, lanePoint)).not.toEqual(scene.walkBounds)
      for (const shop of scene.rooms.filter(room => room.id.startsWith('mining-shop-'))) {
        const shopPoint = { x: shop.bounds.x + shop.bounds.width / 2, y: shop.bounds.y + shop.bounds.height / 2 }
        expect(mainlineInteractionRoom(scene, shopPoint)?.id).toBe(shop.id)
        expect(mainlineInteractionSpace(scene, shopPoint)).toEqual(shop.bounds)
      }
      const sharedShop = scene.rooms.find(room => room.id.startsWith('mining-shop-')
        && Math.abs(room.bounds.y + room.bounds.height - lane.bounds.y) < .001
        && room.bounds.x < lane.bounds.x + lane.bounds.width && room.bounds.x + room.bounds.width > lane.bounds.x)
      if (!sharedShop) throw new Error(`${sceneId} needs an authored shop-to-lane boundary.`)
      const doorEdge = { x: Math.max(sharedShop.bounds.x, lane.bounds.x), y: lane.bounds.y }
      expect(mainlineInteractionRoom(scene, doorEdge)?.id).toBe(lane.id)
    }
  })

  it('limits street text to the public-road viewport intersection and pans within the road to recover width', () => {
    const scene = mainlineScenes['commercial-street']
    const lane = scene.rooms.find(room => room.id === 'commercial-street-public-lane')!
    const metrics = { width: 1280, height: 720 }
    const position = { x: lane.bounds.x + lane.bounds.width - 2, y: lane.bounds.y + lane.bounds.height / 2 }
    const offset = { x: 0, y: 0 }
    const before = mainlineReadingBounds(scene, position, metrics, .65, offset)
    const currentWidth = mainlineAvailableReadingWidthPx(scene, position, metrics, .65, offset)
    const maxWidth = mainlineMaximumReadingWidthPx(scene, position, metrics, .65)
    const panned = mainlineReadingCameraOffset(scene, position, metrics, .65, offset)
    const afterWidth = mainlineAvailableReadingWidthPx(scene, position, metrics, .65, panned)
    expect(before.x).toBeGreaterThanOrEqual(lane.bounds.x)
    expect(before.x + before.width).toBeLessThanOrEqual(lane.bounds.x + lane.bounds.width)
    expect(currentWidth).toBeLessThan(maxWidth)
    expect(afterWidth).toBeGreaterThan(currentWidth)
    expect(afterWidth).toBeLessThanOrEqual(maxWidth)
  })

  it('protects only identified speakers and never exempts every NPC for an unresolved label', () => {
    const scene = mainlineScenes['commercial-street']
    const dialogue: Pick<MainlineSceneDialogue, 'triggerEntityId' | 'lines'> = {
      triggerEntityId: 'lao-zhou',
      lines: [{ id: 'one', speaker: '修杰', text: '你好' }, { id: 'two', speaker: '老周', speakerNpcId: 'lao-zhou', text: '好' }],
    }
    const resolved = resolveMainlineDialogueParticipants(scene, dialogue)
    expect(resolved.npcIds.has('lao-zhou')).toBe(true)
    expect(resolved.npcIds.has('cafe-coffee-owner')).toBe(false)
    expect(resolved.npcIds.has('cafe-floor-server')).toBe(false)
    expect(resolved.unresolvedSpeakers).toEqual([])
    expect(mainlineReadingOpacityForActor('lao-zhou', resolved.npcIds, .44)).toBe(1)
    expect(mainlineReadingOpacityForActor('pedestrian', resolved.npcIds, .44)).toBe(.44)

    const deliveryLine: MainlineSceneDialogue['lines'][number] = {
      id: 'commercial-cafe-coffee-delivery',
      speaker: '店员',
      speakerNpcId: 'cafe-coffee-owner',
      text: '咖啡',
    }
    const delivery = resolveMainlineDialogueParticipants(scene, { triggerEntityId: 'lao-zhou', lines: [] }, deliveryLine)
    expect(delivery.npcIds.has('cafe-coffee-owner')).toBe(true)
    expect(delivery.npcIds.has('cafe-floor-server')).toBe(false)

    const unknown = resolveMainlineDialogueParticipants(scene, {
      triggerEntityId: 'unknown-trigger',
      lines: [{ id: 'unknown', speaker: '店员', text: '你好' }],
    })
    expect(unknown.npcIds.size).toBe(0)
    expect(unknown.unresolvedSpeakers).toEqual(['店员'])
  })

  it('keeps every character in the DOM segment sequence when even one glyph cannot fit', () => {
    expect(splitMainlineInteractionTextToFit('甲乙', 0, 16, () => 16)).toEqual(['甲', '乙'])
  })
})

describe('complete-glyph reading gate', () => {
  const measure = (glyph: string) => glyph === 'W' ? 8.25 : 16

  it('hides zero-width and sub-glyph reading areas, accepts exact glyph width, and resumes without losing the current segment', () => {
    let segmentIndex = 3
    const advanceIfRenderable = (width: number) => {
      if (mainlineCanRenderFirstReadingGlyph('中XYZ', width, 16, measure)) segmentIndex += 1
    }

    expect(mainlineCanRenderFirstReadingGlyph('中XYZ', 0, 16, measure)).toBe(false)
    expect(mainlineCanRenderFirstReadingGlyph('中XYZ', 15.99, 16, measure)).toBe(false)
    expect(mainlineCanRenderFirstReadingGlyph('中XYZ', 16, 16, measure)).toBe(true)
    expect(mainlineCanRenderFirstReadingGlyph('WXYZ', 8.25, 16, measure)).toBe(true)

    advanceIfRenderable(0)
    advanceIfRenderable(15.99)
    expect(segmentIndex).toBe(3)
    advanceIfRenderable(28)
    expect(segmentIndex).toBe(4)
  })
})

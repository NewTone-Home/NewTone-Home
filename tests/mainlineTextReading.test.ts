import { describe, expect, it } from 'vitest'
import { mainlineAvailableReadingWidthPx, mainlineCanRenderFirstReadingGlyph, mainlineDialogueParticipantNpcIds, mainlineInteractionSpace, mainlineIsInteriorSpace, mainlineMaximumReadingWidthPx, mainlineReadingActorOpacity, mainlineReadingBounds, mainlineReadingCameraOffset, mainlineReadingFontSizePx, mainlineReadingStaticOpacity } from '../src/center/runtime/mainlineTextReading'
import type { MainlineSceneDialogue } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'

describe('mainline reading-space effects', () => {
  it('keeps the existing compact-portrait CSS reading size', () => {
    expect(mainlineReadingFontSizePx({ width: 411, height: 914 })).toBe(12)
  })

  it('lets static objects reach full transparency at the text and recover outside its fade area', () => {
    const reading = { x: 50, y: 50 }
    const box = { widthPx: 180, heightPx: 40 }
    expect(mainlineReadingStaticOpacity(reading, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 50.5, y: 50 }, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 55, y: 50 }, reading, box, 1)).toBeGreaterThan(0)
    expect(mainlineReadingStaticOpacity({ x: 80, y: 50 }, reading, box, 1)).toBe(1)
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

  it('protects every speaker-matched actor and conservatively protects all actors for an unknown voice', () => {
    const scene = mainlineScenes['commercial-street']
    const dialogue: Pick<MainlineSceneDialogue, 'triggerEntityId' | 'lines'> = {
      triggerEntityId: 'commercial-cafe-right-window-upper-group-table',
      lines: [{ id: 'one', speaker: '老周', text: '你好。' }, { id: 'two', speaker: '店员', text: '请坐。' }],
    }
    const protectedIds = mainlineDialogueParticipantNpcIds(scene, dialogue)
    expect(protectedIds.has('lao-zhou')).toBe(true)
    expect(protectedIds.has('cafe-coffee-owner')).toBe(true)
    expect(protectedIds.has('cafe-floor-server')).toBe(true)

    const unknown = mainlineDialogueParticipantNpcIds(scene, {
      triggerEntityId: 'unknown-trigger',
      lines: [{ id: 'unknown', speaker: '不明角色' as MainlineSceneDialogue['lines'][number]['speaker'], text: '你好。' }],
    })
    expect(unknown.size).toBe(scene.npcs.length)
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

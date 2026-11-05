import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SceneCharacters } from '../src/center/runtime/SceneCharacters'
import { intersectVisualRectWithClip, unionVisualRects, sceneElementVisualScale, sceneFocusVisualGapPx, sceneFrameBoundsInLocalSpace, sceneGlyphVisualRect } from '../src/center/runtime/sceneVisualBounds'
import { mainlineEntityCollision } from '../src/center/runtime/sceneLayout'
import { mainlineScenes, mainlineScenePassageCollision } from '../src/center/runtime/mainlineScenes'

describe('characters, visual frames and world boundaries', () => {
  it('renders arbitrary typography without adding behavior or identity', () => {
    const html = renderToStaticMarkup(<SceneCharacters style={{ color: 'red', writingMode: 'vertical-rl' }}>窗</SceneCharacters>)
    expect(html).toContain('data-scene-characters="true"')
    expect(html).toContain('vertical-rl')
    expect(html).not.toContain('button')
    expect(html).not.toContain('data-focus-target')
  })
  it('unions visible text rectangles and ignores empty ranges', () => {
    expect(unionVisualRects([{ left: 10, top: 4, right: 20, bottom: 14 }, { left: 30, top: 7, right: 45, bottom: 17 }])).toEqual({ left: 10, top: 4, right: 45, bottom: 17 })
    expect(unionVisualRects([{ left: 0, top: 0, right: 0, bottom: 0 }])).toBeNull()
    expect(sceneFocusVisualGapPx).toBe(2)
  })
  it('clips overflow-hidden glyphs to their local switch slot', () => {
    expect(intersectVisualRectWithClip(
      { left: 4, top: -3, right: 14, bottom: 7 },
      { left: 0, top: 0, right: 20, bottom: 20 },
    )).toEqual({ left: 4, top: 0, right: 14, bottom: 7 })
    expect(intersectVisualRectWithClip(
      { left: 4, top: -12, right: 14, bottom: -2 },
      { left: 0, top: 0, right: 20, bottom: 20 },
    )).toBeNull()
  })
  it.each([2 / 3, 1, 1.5])('keeps ink and frame bounds in matching units at world scale %s, including a zero-size host', worldScale => {
    const world = {
      offsetWidth: 1920,
      offsetHeight: 1080,
      parentElement: null,
      getBoundingClientRect: () => ({ width: 1920 * worldScale, height: 1080 * worldScale }),
    } as unknown as HTMLElement
    const zeroSizeHost = {
      offsetWidth: 0,
      offsetHeight: 0,
      parentElement: world,
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
    } as unknown as HTMLElement
    const glyph = {
      offsetWidth: 100,
      offsetHeight: 40,
      parentElement: world,
      getBoundingClientRect: () => ({ width: 100 * worldScale * 1.12, height: 40 * worldScale * 1.12 }),
    } as unknown as HTMLElement

    const hostScale = sceneElementVisualScale(zeroSizeHost)
    expect(hostScale.x).toBeCloseTo(worldScale)
    expect(hostScale.y).toBeCloseTo(worldScale)
    const glyphScale = sceneElementVisualScale(glyph)
    expect(glyphScale.x).toBeCloseTo(worldScale * 1.12)
    expect(glyphScale.y).toBeCloseTo(worldScale * 1.12)

    const ink = sceneGlyphVisualRect(
      { left: 100, top: 200, right: 180, bottom: 260 },
      20,
      10,
      glyphScale,
    )!
    expect(ink.right - ink.left).toBeCloseTo(22.4 * worldScale)
    expect(ink.bottom - ink.top).toBeCloseTo(11.2 * worldScale)

    const margins = { left: 3, top: 3, right: 3, bottom: 3 }
    const frame = sceneFrameBoundsInLocalSpace(ink, { left: 100, top: 200 }, margins, hostScale)
    expect(frame.width).toBeCloseTo(22.4 + 6 / worldScale)
    expect(frame.height).toBeCloseTo(11.2 + 6 / worldScale)
  })
  it('preserves growing text occupancy while a physical doorway ignores its displayed glyph', () => {
    const scene = mainlineScenes['jijia-ancestral-home']
    const entity = scene.objects.find(object => object.surface === 'floor' && object.collision && object.movementCollision !== 'physical')!
    const narrow = mainlineEntityCollision(scene, { ...entity, label: '出租车' }, {})!
    const wide = mainlineEntityCollision(scene, { ...entity, label: '公共汽车' }, {})!
    expect(wide.width).toBeGreaterThan(narrow.width)
    const street = mainlineScenes['commercial-street']
    const before = mainlineScenePassageCollision(street, 'street-cafe-entry')
    const replaced = { ...street, objects: street.objects.map(object => object.id === 'street-cafe-entry' ? { ...object, label: '窗' } : object) }
    expect(mainlineScenePassageCollision(replaced, 'street-cafe-entry')).toEqual(before)
  })
})

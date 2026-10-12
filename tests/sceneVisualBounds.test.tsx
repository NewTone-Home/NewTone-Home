import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SceneCharacters } from '../src/center/runtime/SceneCharacters'
import { unionVisualRects, sceneFocusVisualGapPx } from '../src/center/runtime/sceneVisualBounds'
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

import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneTextPresentationPosition } from '../src/center/runtime/sceneTextPresentation'

const desktop = { width: 1280, height: 720 }

describe('scene text presentation policy', () => {
  it('keeps fixed scenes at their authored anchor regardless of the interaction object', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    expect(scene.presentation.mode).toBe('fixed')
    if (scene.presentation.mode !== 'fixed') throw new Error('Office needs a fixed text presentation policy.')
    const lowerLeft = { x: scene.walkBounds.x, y: scene.walkBounds.y + scene.walkBounds.height }
    const upperRight = { x: scene.walkBounds.x + scene.walkBounds.width, y: scene.walkBounds.y }
    expect(sceneTextPresentationPosition(scene, lowerLeft, '办公桌上的文件整齐地摆着。', desktop)).toEqual(scene.presentation.anchor)
    expect(sceneTextPresentationPosition(scene, upperRight, '窗边没有人。', desktop)).toEqual(scene.presentation.anchor)
  })

  it('pins Commercial Street text to the authored road reading rail', () => {
    const scene = mainlineScenes['commercial-street']
    expect(scene.presentation.mode).toBe('actor-relative')
    if (scene.presentation.mode !== 'actor-relative') throw new Error('Commercial Street needs an actor-relative text presentation policy.')
    const protagonist = {
      x: scene.walkBounds.x + scene.walkBounds.width / 2,
      y: scene.walkBounds.y + scene.walkBounds.height / 2,
    }
    const rail = scene.presentation.readingRail
    if (!rail) throw new Error('Commercial Street must define a reading rail.')
    const right = sceneTextPresentationPosition(scene, protagonist, '门边的木架上堆着几本薄薄的杂志。', desktop)
    expect(right.y).toBe(rail.centerY)
    expect(right.x).toBeGreaterThan(protagonist.x)
    const left = sceneTextPresentationPosition(scene, { x: rail.maxX - 2, y: rail.centerY }, '门边的木架上堆着几本薄薄的杂志。', desktop)
    expect(left.y).toBe(rail.centerY)
    expect(left.x).toBeLessThan(rail.maxX - 2)
  })
})

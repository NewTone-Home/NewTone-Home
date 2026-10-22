import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneTextPresentationPosition } from '../src/center/runtime/sceneTextPresentation'
import { mainlineInteractionSpace } from '../src/center/runtime/mainlineTextReading'

const desktop = { width: 1280, height: 720 }

function expectInsideCurrentSpace(scene: typeof mainlineScenes[keyof typeof mainlineScenes], actor: { x: number; y: number }, point: { x: number; y: number }) {
  const bounds = mainlineInteractionSpace(scene, actor)
  expect(point.x).toBeGreaterThanOrEqual(bounds.x)
  expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(point.y).toBeGreaterThanOrEqual(bounds.y)
  expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height)
}

describe('scene text presentation policy', () => {
  it('keeps fixed-scene reading text inside the protagonist\'s current room', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    expect(scene.presentation.mode).toBe('fixed')
    if (scene.presentation.mode !== 'fixed') throw new Error('Office needs a fixed text presentation policy.')
    const lowerLeft = { x: scene.walkBounds.x, y: scene.walkBounds.y + scene.walkBounds.height }
    const upperRight = { x: scene.walkBounds.x + scene.walkBounds.width, y: scene.walkBounds.y }
    expectInsideCurrentSpace(scene, lowerLeft, sceneTextPresentationPosition(scene, lowerLeft, '办公桌上的文件整齐地摆着。', desktop))
    expectInsideCurrentSpace(scene, upperRight, sceneTextPresentationPosition(scene, upperRight, '窗边没有人。', desktop))
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

  it('centers Cafe dialogue in the cafe room while keeping observations near the protagonist', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')
    if (!room) throw new Error('Commercial Street must contain its continuous cafe room.')
    const protagonist = { x: room.bounds.x + room.bounds.width * .72, y: room.bounds.y + room.bounds.height * .27 }
    const dialogue = sceneTextPresentationPosition(scene, protagonist, '一段正式对话', desktop, 'dialogue', .65)
    const observation = sceneTextPresentationPosition(scene, protagonist, '角落短观察', desktop, 'observation', .65)
    expect(dialogue).toEqual({ x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })
    expect(observation.x).toBe(protagonist.x)
    expect(observation.y).toBe(protagonist.y)
    expect(observation.x).toBeGreaterThanOrEqual(room.bounds.x)
    expect(observation.x).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
    expect(observation.y).toBeGreaterThanOrEqual(room.bounds.y)
    expect(observation.y).toBeLessThanOrEqual(room.bounds.y + room.bounds.height)
  })
})

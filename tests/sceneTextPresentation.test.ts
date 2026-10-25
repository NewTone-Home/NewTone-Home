import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneTextPresentationPosition } from '../src/center/runtime/sceneTextPresentation'
import { mainlineInteractionSpace, mainlineMaximumReadingWidthPx, mainlineReadingFontSizePx } from '../src/center/runtime/mainlineTextReading'
import { mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'
import { splitMainlineInteractionTextToFit } from '../src/center/runtime/mainlineTextSegments'
import { mainlineFitReadingText } from '../src/center/runtime/mainlineReadingProtection'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const desktop = { width: 1280, height: 720 }

function expectInsideCurrentSpace(scene: typeof mainlineScenes[keyof typeof mainlineScenes], actor: { x: number; y: number }, point: { x: number; y: number }) {
  const bounds = mainlineInteractionSpace(scene, actor)
  expect(point.x).toBeGreaterThanOrEqual(bounds.x)
  expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(point.y).toBeGreaterThanOrEqual(bounds.y)
  expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height)
}

function expectReadingFrameInsideCurrentSpace(scene: typeof mainlineScenes[keyof typeof mainlineScenes], actor: { x: number; y: number }, text: string, metrics: typeof desktop, kind: 'observation' | 'dialogue', worldScale: number, speaker?: string) {
  const space = mainlineInteractionSpace(scene, actor)
  const source = sceneTextPresentationPosition(scene, actor, text, metrics, kind, worldScale)
  const maximumWidthPx = mainlineMaximumReadingWidthPx(scene, actor, metrics, worldScale)
  const readingFit = mainlineFitReadingText(scene, source, text, speaker, maximumWidthPx, [], metrics, worldScale, { x: 0, y: 0 }, [text])
  expect(readingFit.fits).toBe(true)
  for (const page of readingFit.segments) {
    const layout = mainlineEchoLayout(page, metrics, { speaker, maxWidthPx: readingFit.maxWidthPx })
    const halfWidth = layout.widthPx / worldScale / sceneDesignReferenceMetrics.width * 50
    const halfHeight = layout.heightPx / worldScale / sceneDesignReferenceMetrics.height * 50
    expect(readingFit.position.x - halfWidth).toBeGreaterThanOrEqual(space.x - .0001)
    expect(readingFit.position.x + halfWidth).toBeLessThanOrEqual(space.x + space.width + .0001)
    expect(readingFit.position.y - halfHeight).toBeGreaterThanOrEqual(space.y - .0001)
    expect(readingFit.position.y + halfHeight).toBeLessThanOrEqual(space.y + space.height + .0001)
  }
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

  it('uses each authored single-space scene boundary for centered dialogue and protagonist-near observations', () => {
    for (const sceneId of ['jijia-ancestral-home', 'jijia-ancestral-interior', 'zhongshuyuan-passage'] as const) {
      const scene = mainlineScenes[sceneId]
      const room = scene.rooms[0]
      if (!room) throw new Error(`${sceneId} must have an authored text-space boundary.`)
      const protagonist = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const dialogue = sceneTextPresentationPosition(scene, protagonist, 'һ����ʽ�Ի�', desktop, 'dialogue', .65)
      const observation = sceneTextPresentationPosition(scene, protagonist, '����̹۲�', desktop, 'observation', .65)
      expect(dialogue).toEqual({ x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })
      expect(observation.x).toBe(protagonist.x)
      expect(Math.abs(observation.y - protagonist.y)).toBeLessThanOrEqual(14)
      expectInsideCurrentSpace(scene, protagonist, dialogue)
      expectInsideCurrentSpace(scene, protagonist, observation)
    }
  })

  it('keeps an office dialogue in the current office or corridor and places observations near the player', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    for (const roomId of ['zhongshuyuan-office-corridor', 'zhongshuyuan-office-north-room-1', 'zhongshuyuan-office-south-room-1']) {
      const room = scene.rooms.find(candidate => candidate.id === roomId)
      if (!room) throw new Error(`Missing authored office text-space ${roomId}.`)
      const protagonist = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const dialogue = sceneTextPresentationPosition(scene, protagonist, 'һ����ʽ�Ի�', desktop, 'dialogue', .65)
      const observation = sceneTextPresentationPosition(scene, protagonist, '����̹۲�', desktop, 'observation', .65)
      expect(dialogue).toEqual({ x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })
      expect(observation.x).toBe(protagonist.x)
      expect(observation.y).toBe(protagonist.y)
      expectInsideCurrentSpace(scene, protagonist, dialogue)
      expectInsideCurrentSpace(scene, protagonist, observation)
    }
  })

  it('keeps complete reading frames inside small office rooms at corners after long-text pagination', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const room = scene.rooms.find(candidate => candidate.id === 'zhongshuyuan-office-north-room-2')
    if (!room) throw new Error('Missing the small office room used for reading-frame bounds.')
    const text = '办公室角落里的长句需要按当前房间可容纳的宽度分段显示，文字框也必须完整留在本间办公室里面。'
    const actors = [
      { x: room.bounds.x + .05, y: room.bounds.y + .05 },
      { x: room.bounds.x + room.bounds.width - .05, y: room.bounds.y + room.bounds.height - .05 },
    ]
    expect(splitMainlineInteractionTextToFit(text, mainlineMaximumReadingWidthPx(scene, actors[0]!, desktop, .65), mainlineReadingFontSizePx(desktop)).length).toBeGreaterThan(1)
    for (const metrics of [desktop, { width: 390, height: 844 }]) {
      for (const actor of actors) {
        expectReadingFrameInsideCurrentSpace(scene, actor, text, metrics, 'observation', .65)
        expectReadingFrameInsideCurrentSpace(scene, actor, text, metrics, 'dialogue', .65, '修杰')
      }
    }
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
    const right = sceneTextPresentationPosition(scene, protagonist, '门边的木架上堆着几本薄薄的杂志。', desktop, "dialogue")
    expect(right.y).toBe(rail.centerY)
    expect(right.x).toBeGreaterThan(protagonist.x)
    const left = sceneTextPresentationPosition(scene, { x: rail.maxX - 2, y: rail.centerY }, '门边的木架上堆着几本薄薄的杂志。', desktop, "dialogue")
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

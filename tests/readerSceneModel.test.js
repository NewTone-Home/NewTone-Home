import { describe, expect, it } from 'vitest'
import { READER_PAGE_MODES, READER_TRANSITION_TYPES, validateReaderContent } from '../src/data/readerContent'
import { READER_STEP_ACTIONS } from '../src/reader/readerAdvance'
import {
  createReaderSceneModel,
  getReaderSceneFocus,
  resolveReaderSceneStep,
} from '../src/reader/readerSceneModel'

function beat(id, sceneId, text) {
  return {
    id,
    source: { chapterId: 'chapter_01', sceneId },
    blocks: [{ id: 'block-0', type: 'paragraph', text, source: { chapterId: 'chapter_01', sceneId } }],
    worldState: { worldLayer: 'surface', locationId: sceneId, locationLabel: sceneId },
  }
}

function fixture() {
  const page = {
    id: 'chapter_01',
    chapterId: 'chapter_01',
    chapterTitle: '第一章',
    protagonistId: 'protagonist',
    mode: READER_PAGE_MODES.FOCUS_SEQUENCE,
    supportedModes: [READER_PAGE_MODES.FOCUS_SEQUENCE],
    scene: { id: 'chapter_01', label: '第一章' },
    beats: [
      beat('chapter_01_scene_01', 'chapter_01_scene_01', '第一幕'),
      beat('chapter_01_scene_01_reader_02', 'chapter_01_scene_01', '第一幕第二段'),
      beat('chapter_01_scene_02', 'chapter_01_scene_02', '第二幕'),
    ],
    transitionType: READER_TRANSITION_TYPES.CHAPTER_END,
    boundary: { kind: 'continuous', transitionType: READER_TRANSITION_TYPES.CHAPTER_END },
  }
  return [{ id: 'M1', title: 'Reader', pages: [page] }]
}

describe('Reader Scene runtime model', () => {
  it('groups compatibility beats by stable Scene ID before rendering', () => {
    const content = fixture()
    validateReaderContent(content)
    const model = createReaderSceneModel(content)

    expect(model.scenes.map(scene => scene.id)).toEqual([
      'chapter_01_scene_01',
      'chapter_01_scene_02',
    ])
    expect(model.scenes[0].beats).toHaveLength(2)
    expect(model.scenes[0].next.id).toBe('chapter_01_scene_02')
    expect(getReaderSceneFocus(model, { phaseId: 'M1', pageId: 'chapter_01', beatIndex: 1 }).localBeatIndex).toBe(1)
  })

  it('returns a Scene navigation action at the Scene boundary', () => {
    const model = createReaderSceneModel(fixture())
    const action = resolveReaderSceneStep({
      sceneModel: model,
      location: { phaseId: 'M1', pageId: 'chapter_01', beatIndex: 1 },
      steps: 1,
    })

    expect(action.type).toBe(READER_STEP_ACTIONS.SCENE)
    expect(action.location.beatIndex).toBe(2)
    expect(action.scene.id).toBe('chapter_01_scene_02')
  })

  it('keeps completion at the final Scene instead of treating every Scene as a page end', () => {
    const model = createReaderSceneModel(fixture())
    const action = resolveReaderSceneStep({
      sceneModel: model,
      location: { phaseId: 'M1', pageId: 'chapter_01', beatIndex: 2 },
      steps: 1,
    })

    expect(action.type).toBe(READER_STEP_ACTIONS.CHAPTER_END)
  })
})

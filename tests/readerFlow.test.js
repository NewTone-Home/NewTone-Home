import { describe, expect, it } from 'vitest'
import { createReaderFlow, getSceneBoundaryProgress, getSceneBoundaryState } from '../src/reader/readerFlow'

function element(top, height = 40) {
  return { getBoundingClientRect: () => ({ top, height }) }
}

describe('continuous Reader flow', () => {
  it('flattens ordered Scenes and retains each Scene range', () => {
    const sceneModel = {
      scenes: [
        { id: 'scene-01', beats: [{ id: 'beat-01' }], locations: [{ linearIndex: 0 }] },
        { id: 'scene-02', beats: [{ id: 'beat-02' }, { id: 'beat-03' }], locations: [{ linearIndex: 1 }, { linearIndex: 2 }] },
      ],
    }

    const flow = createReaderFlow(sceneModel)

    expect(flow.beats.map(beat => beat.id)).toEqual(['beat-01', 'beat-02', 'beat-03'])
    expect(flow.sceneRanges).toEqual([
      { sceneId: 'scene-01', startIndex: 0, endIndex: 0 },
      { sceneId: 'scene-02', startIndex: 1, endIndex: 2 },
    ])
    expect(flow.sceneBoundaries).toEqual([{
      fromIndex: 0,
      toIndex: 1,
      toEndIndex: 2,
      fromSceneId: 'scene-01',
      toSceneId: 'scene-02',
    }])
  })

  it('reports an upcoming Scene as hidden until the boundary is consumed', () => {
    const viewport = { clientHeight: 600, getBoundingClientRect: () => ({ top: 0 }) }
    const from = element(600)
    const to = element(1000)
    const flowElement = { children: [from, to] }
    const boundaries = [{ fromIndex: 0, toIndex: 1, toEndIndex: 1 }]

    const upcoming = getSceneBoundaryState(viewport, flowElement, boundaries)
    expect(upcoming.active).toBe(false)
    expect(upcoming.progress).toBe(0)
    expect(upcoming.targetScrollTop).toBeUndefined()
    expect(getSceneBoundaryProgress(viewport, flowElement, boundaries)).toBe(1)

    from.getBoundingClientRect = () => ({ top: 280, height: 40 })
    to.getBoundingClientRect = () => ({ top: 680, height: 40 })
    const active = getSceneBoundaryState(viewport, flowElement, boundaries)
    expect(active.active).toBe(true)
    expect(active.progress).toBe(0)
    expect(active.targetScrollTop).toBeUndefined()

    from.getBoundingClientRect = () => ({ top: -120, height: 40 })
    to.getBoundingClientRect = () => ({ top: 280, height: 40 })
    expect(getSceneBoundaryProgress(viewport, flowElement, boundaries)).toBe(1)
  })
})

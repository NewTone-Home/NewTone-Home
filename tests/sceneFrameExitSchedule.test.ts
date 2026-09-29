import { describe, expect, it } from 'vitest'
import { sceneFrameGroupsDueForExit, type SceneFocusFrameMotionProfile } from '../src/center/runtime/sceneFrameExitSchedule'

const profile: readonly SceneFocusFrameMotionProfile[] = [
  { group: 'frame-a', durationMs: 1100 },
  { group: 'frame-b', durationMs: 1300 },
  { group: 'frame-c', durationMs: 1600 },
]

describe('scene frame exit schedule', () => {
  it('starts each frame only when its own duration fits the live remaining ETA', () => {
    const requested = new Set<string>()

    expect(sceneFrameGroupsDueForExit(profile, requested, 1700)).toEqual([])

    const first = sceneFrameGroupsDueForExit(profile, requested, 1550)
    expect(first).toEqual(['frame-c'])
    first.forEach((group) => requested.add(group))

    const second = sceneFrameGroupsDueForExit(profile, requested, 1250)
    expect(second).toEqual(['frame-b'])
    second.forEach((group) => requested.add(group))

    expect(sceneFrameGroupsDueForExit(profile, requested, 1000)).toEqual(['frame-a'])
  })

  it('never requests the same group twice', () => {
    const requested = new Set(['frame-c'])

    expect(sceneFrameGroupsDueForExit(profile, requested, 1000)).toEqual(['frame-a', 'frame-b'])
  })

  it('requests every group immediately when traversal begins inside every duration', () => {
    expect(sceneFrameGroupsDueForExit(profile, new Set(), 1000)).toEqual(['frame-a', 'frame-b', 'frame-c'])
  })

  it('starts a replacement traversal with an empty request set after cancellation', () => {
    const cancelledTraversalRequests = new Set(['frame-b', 'frame-c'])
    cancelledTraversalRequests.clear()

    expect(sceneFrameGroupsDueForExit(profile, cancelledTraversalRequests, 1700)).toEqual([])
  })

  it('does not schedule anything without a live ETA', () => {
    expect(sceneFrameGroupsDueForExit(profile, new Set(), Number.POSITIVE_INFINITY)).toEqual([])
  })
})

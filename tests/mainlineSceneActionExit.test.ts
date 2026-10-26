import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEntryExitSteps } from '../src/components/entryButtonTimeline'
import { commitMainlineSceneActionExit, completeMainlineSceneActionOptionExit, createMainlineSceneActionExitBarrier, mainlineSceneActionExitMayUnmount } from '../src/center/runtime/mainlineSceneActionExit'

const buttonExitDurationMs = createEntryExitSteps().reduce((duration, step) => duration + step.duration, 0)

describe('mainline scene option exit timing', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the original action mounted until every button timeline and the choice commit finish', () => {
    vi.useFakeTimers()
    const actionId = 17
    let barrier = createMainlineSceneActionExitBarrier(actionId, 2)
    let mounted = true
    const completeButton = (index: number) => {
      barrier = completeMainlineSceneActionOptionExit(barrier, actionId, index)
      if (mainlineSceneActionExitMayUnmount(barrier)) mounted = false
    }
    const commitChoice = () => {
      barrier = commitMainlineSceneActionExit(barrier, actionId)
      if (mainlineSceneActionExitMayUnmount(barrier)) mounted = false
    }

    // The selected EntryButtonSurface starts its own activation exit. The other
    // surface receives visible=false in the same committing render and starts
    // its dismiss exit on the following animation frame.
    setTimeout(() => completeButton(0), buttonExitDurationMs)
    setTimeout(() => completeButton(1), buttonExitDurationMs + 16)
    setTimeout(commitChoice, buttonExitDurationMs)

    vi.advanceTimersByTime(buttonExitDurationMs - 1)
    expect(mounted).toBe(true)
    vi.advanceTimersByTime(1)
    expect(mounted).toBe(true)
    vi.advanceTimersByTime(15)
    expect(mounted).toBe(true)
    vi.advanceTimersByTime(1)
    expect(mounted).toBe(false)
  })

  it('ignores duplicate and stale exit completions from an older action', () => {
    let barrier = createMainlineSceneActionExitBarrier(22, 2)
    barrier = completeMainlineSceneActionOptionExit(barrier, 21, 0)
    barrier = completeMainlineSceneActionOptionExit(barrier, 22, 0)
    barrier = completeMainlineSceneActionOptionExit(barrier, 22, 0)
    barrier = commitMainlineSceneActionExit(barrier, 21)
    expect(mainlineSceneActionExitMayUnmount(barrier)).toBe(false)
    barrier = commitMainlineSceneActionExit(barrier, 22)
    expect(mainlineSceneActionExitMayUnmount(barrier)).toBe(false)
    barrier = completeMainlineSceneActionOptionExit(barrier, 22, 1)
    expect(mainlineSceneActionExitMayUnmount(barrier)).toBe(true)
  })
})

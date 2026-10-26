import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEntryExitSteps } from '../src/components/entryButtonTimeline'
import { cancelMainlineSceneActionExit, commitMainlineSceneActionExit, completeMainlineSceneActionOptionExit, createMainlineSceneActionExitBarrier, mainlineSceneActionExitMayUnmount } from '../src/center/runtime/mainlineSceneActionExit'

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

  it('releases a null-result action after its buttons exit and ignores callbacks after a new action starts', () => {
    let current = createMainlineSceneActionExitBarrier(30, 2)

    // The page's null-resolution branch commits lifecycle completion without
    // applying a choice side effect; each EntryButtonSurface still owns exit.
    current = commitMainlineSceneActionExit(current, 30)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = completeMainlineSceneActionOptionExit(current, 30, 0)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = completeMainlineSceneActionOptionExit(current, 30, 1)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(true)

    current = createMainlineSceneActionExitBarrier(31, 1)
    current = completeMainlineSceneActionOptionExit(current, 30, 0)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = commitMainlineSceneActionExit(current, 31)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = completeMainlineSceneActionOptionExit(current, 31, 0)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(true)
  })

  it('keeps an unselected action mounted until every original option exits', () => {
    let current = createMainlineSceneActionExitBarrier(40, 2)
    const applyChoiceSideEffect = vi.fn()
    current = cancelMainlineSceneActionExit(current, 40)
    expect(applyChoiceSideEffect).not.toHaveBeenCalled()
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = completeMainlineSceneActionOptionExit(current, 40, 0)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = completeMainlineSceneActionOptionExit(current, 40, 1)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(true)

    current = createMainlineSceneActionExitBarrier(41, 1)
    current = completeMainlineSceneActionOptionExit(current, 40, 1)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(false)
    current = cancelMainlineSceneActionExit(current, 41)
    current = completeMainlineSceneActionOptionExit(current, 41, 0)
    expect(mainlineSceneActionExitMayUnmount(current)).toBe(true)
  })
})

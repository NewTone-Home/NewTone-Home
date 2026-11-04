import { describe, expect, it } from 'vitest'
import { mainlineReadingSessionTextIsFinal, mainlineReadingTextMotionAfterAdvance, mainlineReadingTextMotionAfterAnimation, mainlineReadingTextMotionCanAnimate, startMainlineReadingTextMotion, mainlineReadingTextMotionCompletionMatches, mainlineReadingTextMotionVisibleCount, type MainlineReadingTextMotion } from '../src/center/runtime/mainlineReadingTextMotion'

function press(motion: MainlineReadingTextMotion, isSessionEnd: boolean) {
  return mainlineReadingTextMotionAfterAdvance(motion, isSessionEnd)
}

describe('whole-session reading text motion', () => {
  it('types only the opening text, rolls through internal pages without restarting, and deletes only at the session end', () => {
    let motion: MainlineReadingTextMotion = 'typing'
    motion = mainlineReadingTextMotionAfterAnimation(motion)
    expect(motion).toBe('static')

    // A phone-fit page or an internal authored segment does not create a new session.
    expect(motion).toBe('static')
    expect(press(motion, false)).toBe('static')
    expect(press('static', false)).toBe('static')
    expect(press('static', true)).toBe('deleting')
    expect(mainlineReadingTextMotionAfterAnimation('deleting')).toBe('deleted')
  })

  it('uses type-in and delete-out for a one-text session', () => {
    expect(mainlineReadingTextMotionAfterAnimation('typing')).toBe('static')
    expect(press('static', true)).toBe('deleting')
    expect(mainlineReadingTextMotionAfterAnimation('deleting')).toBe('deleted')
  })

  it('lets the opening type-in be fast-forwarded without advancing the reading session', () => {
    expect(press('typing', false)).toBe('static')
    expect(press('typing', true)).toBe('static')
    expect(press('static', false)).toBe('static')
  })

  it('does not advance again while the final sentence is deleting', () => {
    expect(press('deleting', true)).toBe('deleting')
    expect(press('deleted', true)).toBe('deleted')
  })

  it('ignores a completion callback from a previous dialogue session', () => {
    expect(mainlineReadingTextMotionCompletionMatches('dialogue:8', 'dialogue:7')).toBe(false)
    expect(mainlineReadingTextMotionCompletionMatches('echo:3', 'echo:3')).toBe(true)
  })

  it('recognizes authored text/session ends independently from fitted screen pages', () => {
    expect(mainlineReadingSessionTextIsFinal(0, 2, 0, 1)).toBe(false)
    expect(mainlineReadingSessionTextIsFinal(1, 2, 0, 2)).toBe(false)
    expect(mainlineReadingSessionTextIsFinal(1, 2, 1, 2)).toBe(true)
    // A fitted mobile page index is deliberately not an input to this boundary.
    expect(mainlineReadingSessionTextIsFinal(0, 1, 0, 1)).toBe(true)
  })

  it('waits for an incoming roll to settle before typing or deleting, then animates text by character', () => {
    expect(mainlineReadingTextMotionCanAnimate('typing', false)).toBe(false)
    expect(mainlineReadingTextMotionVisibleCount('typing', 3, 0, 40)).toBe(1)
    expect(mainlineReadingTextMotionVisibleCount('typing', 3, 80, 40)).toBe(3)
    expect(mainlineReadingTextMotionCanAnimate('deleting', false)).toBe(false)
    expect(mainlineReadingTextMotionCanAnimate('deleting', true)).toBe(true)
    expect(mainlineReadingTextMotionVisibleCount('deleting', 3, 0, 40)).toBe(2)
    expect(mainlineReadingTextMotionVisibleCount('deleting', 3, 80, 40)).toBe(0)
    expect(mainlineReadingTextMotionCanAnimate('static', true)).toBe(false)
  })

  it('deletes a 21-character visible page against elapsed time, completing at 900 ms', () => {
    let queued: ((now: number) => void) | null = null
    let completedAt: number | null = null
    let lastTick = 0
    const counts: number[] = []
    const stop = startMainlineReadingTextMotion({
      motion: 'deleting', textLength: 21, visibleCount: 21, intervalMs: 45,
      request: callback => { queued = callback; return 1 }, cancel: () => { queued = null },
      isPaused: () => false,
      onProgress: count => counts.push(count),
      onComplete: () => { completedAt ??= lastTick },
    })
    const tick = (now: number) => {
      lastTick = now
      const callback = queued
      queued = null
      callback?.(now)
    }

    tick(0)
    for (let now = 15; now <= 900; now += 15) tick(now)
    stop()

    expect(counts[0]).toBe(20)
    expect(counts.at(-1)).toBe(0)
    expect(completedAt).toBe(900)
    expect(queued).toBeNull()
  })
})


describe('reading motion when no space is available', () => {
  it.each(['typing', 'deleting'] as const)('pauses %s without completing and resumes from the visible count', motion => {
    let queued: ((now: number) => void) | null = null
    let paused = false
    let count = motion === 'typing' ? 0 : 5
    let completed = 0
    const start = () => startMainlineReadingTextMotion({
      motion, textLength: 5, visibleCount: count, intervalMs: 40,
      request: callback => { queued = callback; return 1 }, cancel: () => { queued = null },
      isPaused: () => paused, onProgress: value => { count = value }, onComplete: () => { completed += 1 },
    })
    const tick = (now: number) => { const callback = queued; queued = null; if (callback) (callback as (now: number) => void)(now) }
    let stop = start()
    tick(0); tick(80)
    const beforePause = count
    expect(beforePause).toBe(motion === 'typing' ? 3 : 2)
    paused = true
    tick(1000)
    expect(count).toBe(beforePause)
    expect(completed).toBe(0)
    stop()
    paused = false
    stop = start()
    tick(2000)
    expect(count).toBe(beforePause)
    tick(2080)
    expect(count).toBe(motion === 'typing' ? 5 : 0)
    expect(completed).toBe(1)
    stop()
  })
})

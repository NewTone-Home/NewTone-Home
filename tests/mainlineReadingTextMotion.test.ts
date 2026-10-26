import { describe, expect, it } from 'vitest'
import { mainlineReadingSessionTextIsFinal, mainlineReadingTextMotionAfterAdvance, mainlineReadingTextMotionAfterAnimation, mainlineReadingTextMotionCanAnimate, mainlineReadingTextMotionCompletionMatches, mainlineReadingTextMotionVisibleCount, type MainlineReadingTextMotion } from '../src/center/runtime/mainlineReadingTextMotion'

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
})

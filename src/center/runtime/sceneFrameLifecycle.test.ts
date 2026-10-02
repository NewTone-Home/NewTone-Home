import { describe, expect, it } from 'vitest'
import { beginFrameRetraction, completeFrameTransition, preserveFrameRetractCorner, resumeFrameAppearance, type SceneFrameRuntime } from './sceneFrameLifecycle'

function runtime(overrides: Partial<SceneFrameRuntime> = {}): SceneFrameRuntime {
  return {
    corner: 'bottom-right',
    phase: 'retracting',
    fullyCollapsed: false,
    preserveCornerOnResume: true,
    resumeCorner: 'bottom-right',
    transitionDirection: 'retracting',
    transitionStartedAt: 100,
    initialized: true,
    hovered: false,
    locked: false,
    ...overrides,
  }
}

describe('frame retract cancellation', () => {
  it('returns a requested retract along its existing corner instead of randomizing it', () => {
    const current = runtime()

    resumeFrameAppearance(current, 'top-left', 300)

    expect(current).toMatchObject({
      corner: 'bottom-right',
      phase: 'appearing',
      fullyCollapsed: false,
      preserveCornerOnResume: false,
      resumeCorner: null,
      transitionDirection: 'appearing',
      transitionStartedAt: 300,
    })
  })

  it('keeps normal draw-in randomization for a fully unrelated hidden frame', () => {
    const current = runtime({ phase: 'hidden', preserveCornerOnResume: false, resumeCorner: null, corner: 'bottom-right' })

    resumeFrameAppearance(current, 'top-left', 300)

    expect(current.corner).toBe('top-left')
  })

  it('allows a current retract completion to collapse the frame', () => {
    const current = runtime()

    expect(completeFrameTransition(current, true, 1200, 1100, true)).toBe(true)
    expect(current).toMatchObject({ phase: 'hidden', fullyCollapsed: true, transitionDirection: null })
  })

  it('keeps the retract corner through a late cancellation path', () => {
    const current = runtime({ preserveCornerOnResume: false, resumeCorner: null })
    beginFrameRetraction(current, 200, true)

    resumeFrameAppearance(current, 'top-left', 300)

    expect(current).toMatchObject({ corner: 'bottom-right', resumeCorner: null, phase: 'appearing' })
  })

  it('upgrades an already-retracting door frame to preserve its corner for a scene exit', () => {
    const current = runtime({ preserveCornerOnResume: false, resumeCorner: null })

    preserveFrameRetractCorner(current)
    resumeFrameAppearance(current, 'top-left', 300)

    expect(current.corner).toBe('bottom-right')
  })

  it('ignores an old retract completion after cancellation has begun appearing', () => {
    const current = runtime()
    resumeFrameAppearance(current, 'top-left', 300)

    expect(completeFrameTransition(current, false, 320, 1100, false)).toBe(false)
    expect(current).toMatchObject({ corner: 'bottom-right', phase: 'appearing', fullyCollapsed: false, transitionDirection: 'appearing' })
  })

  it('can resume a cancelled retract that completed immediately before the cancellation commit', () => {
    const current = runtime({ phase: 'hidden', fullyCollapsed: true, transitionDirection: null })

    resumeFrameAppearance(current, 'top-left', 300)

    expect(current).toMatchObject({ corner: 'bottom-right', phase: 'appearing', fullyCollapsed: false, transitionDirection: 'appearing' })
  })

  it('marks a current cancellation draw as visible only when it reaches its own endpoint', () => {
    const current = runtime()
    resumeFrameAppearance(current, 'top-left', 300)

    expect(completeFrameTransition(current, false, 600, 1100, false)).toBe(false)
    expect(completeFrameTransition(current, false, 1400, 1100, true)).toBe(true)
    expect(current).toMatchObject({ phase: 'visible', fullyCollapsed: false, transitionDirection: null })
  })

  it('does not let an earlier retract completion pollute a later retract generation', () => {
    const current = runtime()
    resumeFrameAppearance(current, 'top-left', 300)
    beginFrameRetraction(current, 500, true)
    resumeFrameAppearance(current, 'top-left', 700)

    expect(completeFrameTransition(current, false, 900, 1100, false)).toBe(false)
    expect(current.phase).toBe('appearing')
  })
})

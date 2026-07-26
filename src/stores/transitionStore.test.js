import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProgressStore } from './progressStore'
import { useTransitionStore } from './transitionStore'
import { getDefinition } from '../transitions/transitionDefinitions'

describe('transition target readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useProgressStore.getState().reset()
    useProgressStore.setState({ centerUnlocked: true })
    useTransitionStore.getState().reset()
  })

  afterEach(() => {
    useTransitionStore.getState().reset()
    vi.useRealTimers()
  })

  it('keeps the cover closed until Center reports ready', () => {
    const preset = 'reader-to-core'
    const timings = getDefinition(preset).timings
    expect(useTransitionStore.getState().transitionTo('center', { preset })).toBe(true)
    vi.advanceTimersByTime(timings.leaving)

    expect(useProgressStore.getState().currentView).toBe('center')
    expect(useTransitionStore.getState().phase).toBe('covered')
    expect(useTransitionStore.getState().waitingForTarget).toBe(true)

    vi.advanceTimersByTime(timings.coveredHold + 100)
    expect(useTransitionStore.getState().phase).toBe('covered')

    expect(useTransitionStore.getState().notifyTargetReady('center')).toBe(true)
    vi.advanceTimersByTime(timings.coveredHold)
    expect(useTransitionStore.getState().phase).toBe('entering')

    vi.advanceTimersByTime(timings.entering)
    expect(useTransitionStore.getState().phase).toBe('idle')
  })

  it('allows the explicit Reader return control to unlock and enter Center', () => {
    const preset = 'reader-to-core'
    const timings = getDefinition(preset).timings
    useProgressStore.setState({ currentView: 'reader', centerUnlocked: false })

    expect(useTransitionStore.getState().transitionTo('center', { preset })).toBe(true)
    vi.advanceTimersByTime(timings.leaving)

    expect(useProgressStore.getState().centerUnlocked).toBe(true)
    expect(useProgressStore.getState().currentView).toBe('center')
    expect(useTransitionStore.getState().phase).toBe('covered')
  })

  it('does not wait for stable Reader and Landing transitions', () => {
    const preset = 'core-to-reader'
    const timings = getDefinition(preset).timings
    useProgressStore.setState({ currentView: 'center' })
    useTransitionStore.getState().transitionTo('reader', { preset, payload: { mode: 'continue' } })
    vi.advanceTimersByTime(timings.leaving)
    expect(useTransitionStore.getState().waitingForTarget).toBe(false)
    vi.advanceTimersByTime(timings.coveredHold)
    expect(useTransitionStore.getState().phase).toBe('entering')
  })
})

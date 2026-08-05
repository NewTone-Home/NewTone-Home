import { describe, expect, it } from 'vitest'
import { createReaderRestoreCoordinator } from '../src/reader/readerRestore'

describe('Reader restore readiness', () => {
  it('waits for location, viewport measurement, and focus positioning', () => {
    const coordinator = createReaderRestoreCoordinator()
    coordinator.markLocationRestored()
    expect(coordinator.commitReady()).toBe(false)
    coordinator.markViewportMeasured()
    expect(coordinator.commitReady()).toBe(false)
    coordinator.markFocusPositioned()
    expect(coordinator.commitReady()).toBe(true)
  })

  it('commits ready only once under StrictMode-style replay', () => {
    const coordinator = createReaderRestoreCoordinator()
    coordinator.markLocationRestored()
    coordinator.markViewportMeasured()
    coordinator.markFocusPositioned()
    expect(coordinator.commitReady()).toBe(true)
    expect(coordinator.commitReady()).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { createSceneFocusFrameDeferredMeasureScheduler } from '../src/center/runtime/sceneFocusFrameDeferredMeasure'

function frameClock() {
  let nextId = 1
  const pending = new Map<number, FrameRequestCallback>()
  return {
    pending,
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = nextId++
      pending.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) { pending.delete(id) },
    flush() {
      const callbacks = [...pending.values()]
      pending.clear()
      callbacks.forEach(callback => callback(0))
    },
  }
}

describe('late first focus-frame measurements', () => {
  it('retries only after a later target mutation, then stops when the visible glyph has size', () => {
    const clock = frameClock()
    const scheduler = createSceneFocusFrameDeferredMeasureScheduler(clock)
    let glyphSize = 0
    let attempts = 0
    const measure = () => { attempts += 1; return glyphSize > 0 }

    // The mounted frame and target initially have no layout box.
    expect(measure()).toBe(false)
    // A later target DOM mutation requests one bounded measurement without a
    // menu click or a scene-wide RAF loop.
    scheduler.request('outdoor-table', measure)
    expect(clock.pending.size).toBe(1)
    clock.flush()
    expect(attempts).toBe(2)

    // The glyph arrives after that first retry; its mutation can request one
    // more measurement and supplies valid geometry.
    glyphSize = 22
    scheduler.request('outdoor-table', measure)
    clock.flush()
    expect(attempts).toBe(3)
    scheduler.request('outdoor-table', measure)
    expect(clock.pending.size).toBe(0)
    expect(attempts).toBe(3)
    scheduler.dispose()
  })

  it('coalesces duplicate requests and cancels queued work on unmount', () => {
    const clock = frameClock()
    const scheduler = createSceneFocusFrameDeferredMeasureScheduler(clock)
    let attempts = 0
    scheduler.request('plant', () => { attempts += 1; return false })
    scheduler.request('plant', () => { attempts += 1; return false })
    expect(clock.pending.size).toBe(1)
    scheduler.dispose()
    expect(clock.pending.size).toBe(0)
    clock.flush()
    expect(attempts).toBe(0)
  })

  it('keeps retry count bounded for a target that never becomes measurable', () => {
    const clock = frameClock()
    const scheduler = createSceneFocusFrameDeferredMeasureScheduler(clock, 2)
    let attempts = 1 // initial synchronous measurement
    const measure = () => { attempts += 1; return false }
    scheduler.request('door', measure)
    clock.flush()
    scheduler.request('door', measure)
    clock.flush()
    scheduler.request('door', measure)
    expect(attempts).toBe(3)
    expect(clock.pending.size).toBe(0)
    scheduler.dispose()
  })
})

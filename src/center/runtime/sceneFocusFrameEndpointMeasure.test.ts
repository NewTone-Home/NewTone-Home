import { describe, expect, it } from 'vitest'
import { createEndpointMeasurementScheduler } from './sceneFocusFrameEndpointMeasure'

function createRafHarness() {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const cancelled = new Set<number>()
  const win = {
    requestAnimationFrame(callback: FrameRequestCallback) {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    },
    cancelAnimationFrame(id: number) {
      cancelled.add(id)
      callbacks.delete(id)
    },
  }
  const flush = () => {
    const batch = [...callbacks.entries()]
    callbacks.clear()
    batch.forEach(([id, callback]) => {
      if (!cancelled.has(id)) callback(0)
    })
  }
  return { win, flush, callbacks }
}

describe('scene focus frame endpoint measurement scheduling', () => {
  it('measures once after two frames while the same endpoint remains current', () => {
    const raf = createRafHarness()
    let measured = 0
    const scheduler = createEndpointMeasurementScheduler(raf.win, () => 1, () => { measured += 1 })

    scheduler.progressChanged()
    raf.flush()
    expect(measured).toBe(0)
    raf.flush()

    expect(measured).toBe(1)
    expect(raf.callbacks.size).toBe(0)
  })

  it('cancels an endpoint measurement when the glyph reverses before the second frame', () => {
    const raf = createRafHarness()
    let progress = 1
    let measured = 0
    const scheduler = createEndpointMeasurementScheduler(raf.win, () => progress, () => { measured += 1 })

    scheduler.progressChanged()
    raf.flush()
    progress = 0.5
    scheduler.progressChanged()
    raf.flush()

    expect(measured).toBe(0)
    expect(raf.callbacks.size).toBe(0)
  })

  it('rejects a queued measurement if progress changes before its frame runs', () => {
    const raf = createRafHarness()
    let progress = 0
    let measured = 0
    const scheduler = createEndpointMeasurementScheduler(raf.win, () => progress, () => { measured += 1 })

    scheduler.progressChanged()
    progress = 1
    raf.flush()

    expect(measured).toBe(0)
    expect(raf.callbacks.size).toBe(0)
  })

  it('cancels outstanding frames on effect cleanup', () => {
    const raf = createRafHarness()
    let measured = 0
    const scheduler = createEndpointMeasurementScheduler(raf.win, () => 1, () => { measured += 1 })

    scheduler.progressChanged()
    scheduler.dispose()
    raf.flush()

    expect(measured).toBe(0)
    expect(raf.callbacks.size).toBe(0)
  })
})

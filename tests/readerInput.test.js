import { describe, expect, it } from 'vitest'
import {
  READER_INTENTS,
  accumulateWheelSteps,
  intentToReaderSteps,
  isNativeReaderScrollTarget,
  keyToReaderIntent,
  normalizeWheelDelta,
  touchToReaderIntent,
} from '../src/reader/readerInput'

describe('Reader input normalization', () => {
  it('accumulates wheel deltas into immediate signed steps', () => {
    const partial = accumulateWheelSteps(0, 40)
    const complete = accumulateWheelSteps(partial.accumulated, 40)

    expect(partial).toEqual({ accumulated: 40, steps: 0 })
    expect(complete).toEqual({ accumulated: 0, steps: 1 })
  })

  it('emits at most one step for each wheel event', () => {
    expect(accumulateWheelSteps(0, 245)).toEqual({ accumulated: 0, steps: 1 })
    expect(accumulateWheelSteps(0, -245)).toEqual({ accumulated: 0, steps: -1 })
  })

  it('lets reverse input cancel the retained remainder immediately', () => {
    expect(accumulateWheelSteps(55, -100)).toEqual({ accumulated: -45, steps: 0 })
    expect(accumulateWheelSteps(55, -140)).toEqual({ accumulated: 0, steps: -1 })
  })

  it('normalizes pixel, line, and page wheel delta modes', () => {
    expect(normalizeWheelDelta(12, 0, 900)).toBe(12)
    expect(normalizeWheelDelta(3, 1, 900)).toBe(48)
    expect(normalizeWheelDelta(1, 2, 900)).toBe(900)
  })

  it('maps Arrow, Page, Space, and Shift+Space keys', () => {
    expect(keyToReaderIntent({ key: 'ArrowDown' })).toBe(READER_INTENTS.FORWARD)
    expect(keyToReaderIntent({ key: 'PageDown' })).toBe(READER_INTENTS.FORWARD)
    expect(keyToReaderIntent({ key: ' ' })).toBe(READER_INTENTS.FORWARD)
    expect(keyToReaderIntent({ key: 'ArrowUp' })).toBe(READER_INTENTS.BACKWARD)
    expect(keyToReaderIntent({ key: 'PageUp' })).toBe(READER_INTENTS.BACKWARD)
    expect(keyToReaderIntent({ key: ' ', shiftKey: true })).toBe(READER_INTENTS.BACKWARD)
  })

  it('maps vertical touch gestures and ignores short movement', () => {
    expect(touchToReaderIntent(400, 340)).toBe(READER_INTENTS.FORWARD)
    expect(touchToReaderIntent(340, 400)).toBe(READER_INTENTS.BACKWARD)
    expect(touchToReaderIntent(400, 390)).toBeNull()
  })

  it('maps normalized intents to signed target steps', () => {
    expect(intentToReaderSteps(READER_INTENTS.FORWARD)).toBe(1)
    expect(intentToReaderSteps(READER_INTENTS.BACKWARD)).toBe(-1)
    expect(intentToReaderSteps(null)).toBe(0)
  })

  it('leaves wheel input inside the native Flow container to the browser', () => {
    const originalHTMLElement = globalThis.HTMLElement
    class TestHTMLElement {
      constructor(nativeScroll) {
        this.nativeScroll = nativeScroll
      }

      closest(selector) {
        return selector === '.reader-beat-stack[data-native-scroll="true"]' && this.nativeScroll ? this : null
      }
    }
    globalThis.HTMLElement = TestHTMLElement
    try {
      expect(isNativeReaderScrollTarget(new TestHTMLElement(true))).toBe(true)
      expect(isNativeReaderScrollTarget(new TestHTMLElement(false))).toBe(false)
    } finally {
      globalThis.HTMLElement = originalHTMLElement
    }
  })
})

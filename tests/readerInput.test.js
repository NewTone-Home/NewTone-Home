import { describe, expect, it } from 'vitest'
import {
  INPUT_QUEUE_LIMIT,
  READER_INTENTS,
  accumulateWheelIntent,
  consumeReaderIntent,
  enqueueReaderIntent,
  keyToReaderIntent,
  touchToReaderIntent,
} from '../src/reader/readerInput'

describe('Reader input normalization', () => {
  it('accumulates wheel deltas to exactly one intent', () => {
    const partial = accumulateWheelIntent(0, 40)
    const complete = accumulateWheelIntent(partial.accumulated, 40)

    expect(partial.intent).toBeNull()
    expect(complete).toEqual({ accumulated: 0, intent: READER_INTENTS.FORWARD })
  })

  it('caps queued input and cancels opposite directions', () => {
    let queue = []
    queue = enqueueReaderIntent(queue, READER_INTENTS.FORWARD)
    queue = enqueueReaderIntent(queue, READER_INTENTS.FORWARD)
    queue = enqueueReaderIntent(queue, READER_INTENTS.FORWARD)
    expect(queue).toHaveLength(INPUT_QUEUE_LIMIT)

    queue = enqueueReaderIntent(queue, READER_INTENTS.BACKWARD)
    expect(queue).toEqual([READER_INTENTS.FORWARD])
  })

  it('consumes at most one queued intent', () => {
    expect(consumeReaderIntent([
      READER_INTENTS.FORWARD,
      READER_INTENTS.BACKWARD,
    ])).toEqual({
      intent: READER_INTENTS.FORWARD,
      queue: [READER_INTENTS.BACKWARD],
    })
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
})

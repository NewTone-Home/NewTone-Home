import { describe, expect, it } from 'vitest'
import {
  createReaderReturnFlowState,
  reduceReaderReturnFlow,
  READER_RETURN_EVENT,
  READER_RETURN_STATE,
} from '../src/reader/readerReturnFlow'

const reduce = (state, ...events) => events.reduce(reduceReaderReturnFlow, state)

describe('Reader return flow', () => {
  it('accepts the staged contract event vocabulary', () => {
    const revealing = reduce(createReaderReturnFlowState(), READER_RETURN_EVENT.LAST_CONTENT_REACHED)
    const ready = reduce(revealing, READER_RETURN_EVENT.RETURN_TEXT_STABLE)
    const armed = reduce(ready, READER_RETURN_EVENT.ACTIVATE)
    const dismissed = reduce(armed, READER_RETURN_EVENT.REVERSE_GESTURE)
    const hidden = reduce(dismissed, READER_RETURN_EVENT.DISMISS_COMPLETED)

    expect(revealing.state).toBe(READER_RETURN_STATE.REVEALING)
    expect(ready.state).toBe(READER_RETURN_STATE.READY)
    expect(armed.state).toBe(READER_RETURN_STATE.ARMED)
    expect(dismissed).toMatchObject({
      state: READER_RETURN_STATE.DISMISSING,
      effect: 'dismiss-start',
    })
    expect(hidden).toMatchObject({
      state: READER_RETURN_STATE.HIDDEN,
      dismissed: true,
    })
  })

  it('reveals exactly once when the real content boundary is reached', () => {
    const initial = createReaderReturnFlowState()
    const visible = reduce(initial, { type: READER_RETURN_EVENT.BOUNDARY_REACHED, atBottom: true })

    expect(visible).toMatchObject({
      state: READER_RETURN_STATE.REVEALING,
      effect: 'entry-visible',
      instanceId: 1,
      dismissed: false,
    })
    expect(reduce(visible, { type: READER_RETURN_EVENT.BOUNDARY_REACHED, atBottom: true })).toEqual(visible)
  })

  it('requires activation before a forward gesture can return to Landing', () => {
    const ready = reduce(
      createReaderReturnFlowState(),
      { type: READER_RETURN_EVENT.BOUNDARY_REACHED, atBottom: true },
      READER_RETURN_EVENT.ARM,
    )
    const returned = reduce(ready, READER_RETURN_EVENT.FORWARD_GESTURE)

    expect(ready.state).toBe(READER_RETURN_STATE.ARMED)
    expect(returned).toMatchObject({
      state: READER_RETURN_STATE.DISMISSING,
      effect: 'return-start',
      returnToLanding: true,
    })
  })

  it('keeps reverse dismissal separate from navigation and marks the boundary suppressed', () => {
    const ready = reduce(
      createReaderReturnFlowState(),
      { type: READER_RETURN_EVENT.BOUNDARY_REACHED, atBottom: true },
      READER_RETURN_EVENT.REVERSE_GESTURE,
    )
    const dismissed = reduce(ready, READER_RETURN_EVENT.EXIT_COMPLETE)

    expect(ready.state).toBe(READER_RETURN_STATE.DISMISSING)
    expect(ready.returnToLanding).toBe(false)
    expect(dismissed).toMatchObject({
      state: READER_RETURN_STATE.HIDDEN,
      effect: null,
      dismissed: true,
    })
  })
})

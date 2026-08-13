import { describe, expect, it } from 'vitest'
import {
  createUpdatesReturnFlowState,
  reduceUpdatesReturnFlow,
  UPDATES_RETURN_EVENT,
  UPDATES_RETURN_REASON,
  UPDATES_RETURN_STATE,
} from '../src/landing/landingUpdatesReturnFlow'

const reduce = (state, ...events) => events.reduce(reduceUpdatesReturnFlow, state)

describe('Landing updates return flow', () => {
  it('accepts the staged contract event vocabulary', () => {
    const ready = reduce(
      createUpdatesReturnFlowState(),
      UPDATES_RETURN_EVENT.SURFACE_STABLE,
      UPDATES_RETURN_EVENT.TEXT_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_READY,
      UPDATES_RETURN_EVENT.ARROW_TURNED,
    )
    const withdrawal = reduce(ready, {
      type: UPDATES_RETURN_EVENT.WHEEL_RETURN,
      returnToLanding: true,
    })
    const hidden = reduce(
      withdrawal,
      UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE,
      UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE,
      UPDATES_RETURN_EVENT.WITHDRAW_ANIMATION_COMPLETE,
    )

    expect(ready.state).toBe(UPDATES_RETURN_STATE.READY)
    expect(withdrawal.state).toBe(UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN)
    expect(hidden).toMatchObject({
      state: UPDATES_RETURN_STATE.HIDDEN,
      effect: 'navigation-ready',
      returnToLanding: true,
    })
  })

  it('keeps reveal order explicit and creates one instance per entry', () => {
    const initial = createUpdatesReturnFlowState()
    const visible = reduce(initial, UPDATES_RETURN_EVENT.BEGIN)
    const ready = reduce(
      visible,
      UPDATES_RETURN_EVENT.TEXT_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_TURNED,
    )

    expect(visible).toMatchObject({
      state: UPDATES_RETURN_STATE.TEXT_REVEAL,
      effect: 'entry-visible',
      instanceId: 1,
    })
    expect(ready).toMatchObject({
      state: UPDATES_RETURN_STATE.READY,
      effect: 'ready',
      instanceId: 1,
    })
  })

  it('withdraws from an armed entry and emits navigation only after text exit', () => {
    const ready = reduce(
      createUpdatesReturnFlowState(),
      UPDATES_RETURN_EVENT.BEGIN,
      UPDATES_RETURN_EVENT.TEXT_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_TURNED,
    )
    const withdrawal = reduce(ready, {
      type: UPDATES_RETURN_EVENT.WITHDRAW,
      reason: UPDATES_RETURN_REASON.WHEEL,
      returnToLanding: true,
    })

    expect(withdrawal).toMatchObject({
      state: UPDATES_RETURN_STATE.WITHDRAW_ARROW_TURN,
      effect: 'withdraw-start',
      returnToLanding: true,
      reason: UPDATES_RETURN_REASON.WHEEL,
    })
    expect(reduce(withdrawal, UPDATES_RETURN_EVENT.ARROW_TURN_COMPLETE)).toMatchObject({
      state: UPDATES_RETURN_STATE.WITHDRAW_ARROW,
      effect: null,
    })
    expect(reduce(
      withdrawal,
      UPDATES_RETURN_EVENT.ARROW_TURN_COMPLETE,
      UPDATES_RETURN_EVENT.ARROW_WITHDRAWN,
      UPDATES_RETURN_EVENT.TEXT_WITHDRAWN,
    )).toMatchObject({
      state: UPDATES_RETURN_STATE.HIDDEN,
      effect: 'navigation-ready',
      returnToLanding: true,
    })
  })

  it('cancels a coarse activation without issuing navigation', () => {
    const ready = reduce(
      createUpdatesReturnFlowState(),
      UPDATES_RETURN_EVENT.BEGIN,
      UPDATES_RETURN_EVENT.TEXT_REVEALED,
      UPDATES_RETURN_EVENT.ARROW_REVEALED,
      UPDATES_RETURN_EVENT.MOBILE_ACTIVATE,
      UPDATES_RETURN_EVENT.ARROW_TURNED,
    )

    expect(ready.state).toBe(UPDATES_RETURN_STATE.READY)
    expect(reduce(ready, UPDATES_RETURN_EVENT.CANCEL)).toMatchObject({
      state: UPDATES_RETURN_STATE.ARROW_REVEAL,
      effect: 'cancel',
      returnToLanding: false,
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  CENTER_INTERACTION_MODE,
  centerInteractionReducer,
  initialCenterInteraction,
  resolveEntityVisualState,
} from '../src/center/interaction/centerInteraction'

describe('Center interaction state machine', () => {
  it('maps hover focus, selection, open, and close without requiring animation completion', () => {
    const focused = centerInteractionReducer(initialCenterInteraction, { type: 'FOCUS', entityId: 'memory-archive' })
    expect(focused.mode).toBe(CENTER_INTERACTION_MODE.FOCUS)
    expect(resolveEntityVisualState(focused, 'memory-archive')).toBe('focus')

    const selected = centerInteractionReducer(focused, { type: 'SELECT', entityId: 'memory-archive' })
    expect(selected).toEqual({ mode: 'selected', focusedId: null, selectedId: 'memory-archive', openId: null })

    const opened = centerInteractionReducer(selected, { type: 'OPEN' })
    expect(opened.mode).toBe(CENTER_INTERACTION_MODE.OPEN)
    expect(resolveEntityVisualState(opened, 'memory-archive')).toBe('open')

    const closed = centerInteractionReducer(opened, { type: 'CLOSE_OPEN' })
    expect(closed.mode).toBe(CENTER_INTERACTION_MODE.SELECTED)
    expect(closed.selectedId).toBe('memory-archive')
  })

  it('keeps selection stable when another entity receives transient focus', () => {
    const selected = centerInteractionReducer(initialCenterInteraction, { type: 'SELECT', entityId: 'south-station' })
    const focused = centerInteractionReducer(selected, { type: 'FOCUS', entityId: 'relay-17' })
    expect(focused.mode).toBe('selected')
    expect(focused.selectedId).toBe('south-station')
    expect(resolveEntityVisualState(focused, 'relay-17')).toBe('focus')
  })
})


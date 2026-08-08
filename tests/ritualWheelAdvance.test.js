import { describe, expect, it } from 'vitest'
import {
  resolveRitualArmAction,
  resolveRitualSwipeAction,
  resolveRitualWheelAction,
} from '../src/interactions/ritualWheelAdvance'

describe('initial Reader ritual wheel advance', () => {
  it('advances language only from the primary option on downward scroll', () => {
    expect(resolveRitualWheelAction('language-active', 'primary', 24)).toEqual({ type: 'language' })
    expect(resolveRitualWheelAction('language-active', 'secondary', 24)).toBeNull()
    expect(resolveRitualWheelAction('language-active', 'primary', -24)).toBeNull()
  })

  it('maps mode choices to their reading modes', () => {
    expect(resolveRitualWheelAction('mode-active', 'primary', 24)).toEqual({ type: 'mode', mode: 'immersive' })
    expect(resolveRitualWheelAction('mode-active', 'secondary', 24)).toEqual({ type: 'mode', mode: 'standard' })
  })

  it('ignores tiny wheel noise and inactive phases', () => {
    expect(resolveRitualWheelAction('mode-active', 'primary', 4)).toBeNull()
    expect(resolveRitualWheelAction('mode-leaving', 'primary', 24)).toBeNull()
  })

  it('arms touch and pen choices without treating mouse clicks as mobile selection', () => {
    expect(resolveRitualArmAction('language-active', 'primary', 'touch')).toEqual({ type: 'language' })
    expect(resolveRitualArmAction('language-active', 'primary', 'pen')).toEqual({ type: 'language' })
    expect(resolveRitualArmAction('language-active', 'secondary', 'touch')).toBeNull()
    expect(resolveRitualArmAction('mode-active', 'secondary', 'pen')).toEqual({ type: 'mode', mode: 'standard' })
    expect(resolveRitualArmAction('mode-active', 'primary', 'mouse')).toBeNull()
  })

  it('confirms an armed touch or pen choice only after an upward swipe', () => {
    expect(resolveRitualSwipeAction({ phase: 'language-active', selectorOption: 'primary', pointerType: 'touch', startY: 500, endY: 430 })).toEqual({ type: 'language' })
    expect(resolveRitualSwipeAction({ phase: 'mode-active', selectorOption: 'secondary', pointerType: 'pen', startY: 500, endY: 430 })).toEqual({ type: 'mode', mode: 'standard' })
    expect(resolveRitualSwipeAction({ phase: 'mode-active', selectorOption: 'primary', pointerType: 'touch', startY: 500, endY: 475 })).toBeNull()
    expect(resolveRitualSwipeAction({ phase: 'mode-active', selectorOption: 'primary', pointerType: 'touch', startY: 430, endY: 500 })).toBeNull()
  })
})

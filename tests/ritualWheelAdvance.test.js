import { describe, expect, it } from 'vitest'
import { resolveRitualTapAction, resolveRitualWheelAction } from '../src/interactions/ritualWheelAdvance'

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

  it('allows touch taps to confirm only the actionable setup choices', () => {
    expect(resolveRitualTapAction('language-active', 'primary', 'touch')).toEqual({ type: 'language' })
    expect(resolveRitualTapAction('language-active', 'secondary', 'touch')).toBeNull()
    expect(resolveRitualTapAction('mode-active', 'primary', 'touch')).toEqual({ type: 'mode', mode: 'immersive' })
    expect(resolveRitualTapAction('mode-active', 'secondary', 'touch')).toEqual({ type: 'mode', mode: 'standard' })
    expect(resolveRitualTapAction('mode-active', 'primary', 'mouse')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { incenseBurnDurationMs, incenseBurnPhase, incenseBurnRemainingMs, resolveMainlineSceneEchoChoice, resolveMainlineSceneExploration } from '../src/center/runtime/mainlineSceneInteractions'

describe('incense relight state ownership', () => {
  const scene = mainlineScenes['jijia-ancestral-interior']
  const burner = scene.objects.find(entity => entity.id === 'jijia-incense-burner')!
  it('offers the real relight action without lighting merely from viewing', () => {
    const result = resolveMainlineSceneExploration(scene, burner, { incensePhase: 'unlit', plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface' })
    expect(result.choice?.options).toEqual(['重新点香'])
    expect(result).not.toHaveProperty('stateChange')
    expect(resolveMainlineSceneEchoChoice(scene, burner, '取消', 1234)).not.toHaveProperty('stateChange')
  })
  it('only the successful relight choice writes the burn timestamp', () => {
    expect(resolveMainlineSceneEchoChoice(scene, burner, '重新点香', 1234)).toMatchObject({ stateChange: { key: 'incenseLitAt', value: 1234 }, dismiss: true })
  })
  it('restores remaining burn time rather than restarting on entry', () => {
    const started = 1000
    expect(incenseBurnPhase(null, 2000)).toBe('unlit')
    expect(incenseBurnPhase(started, started + 1000)).toBe('fresh')
    expect(incenseBurnRemainingMs(started, started + 1000)).toBe(incenseBurnDurationMs - 1000)
    expect(incenseBurnPhase(started, started + incenseBurnDurationMs)).toBe('burned')
  })
})

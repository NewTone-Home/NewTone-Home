import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCENE_ENVIRONMENT,
  TIMES_OF_DAY,
  allowedWeather,
  coerceWeather,
  isWeatherAllowed,
  resolveEnvironment,
} from './environmentModel'
import type { SceneEnvironmentState, TimeOfDay, Weather, WorldLayer } from './environmentTypes'

function scene(patch: Partial<SceneEnvironmentState> = {}): SceneEnvironmentState {
  return { ...DEFAULT_SCENE_ENVIRONMENT, ...patch }
}

describe('世界层与天气分离', () => {
  it('worldLayer 不是一种天色：时间与天气是彼此独立的轴', () => {
    const times: TimeOfDay[] = [...TIMES_OF_DAY]
    expect(times).toEqual(['morning', 'noon', 'dusk', 'night'])
    // inner 不在时间轴上，也不在天气轴上
    expect(times as string[]).not.toContain('inner')
    expect(allowedWeather('surface') as string[]).not.toContain('inner')
    expect(allowedWeather('inner') as string[]).not.toContain('inner')
  })

  it('每个世界层与每个时间可以自由组合', () => {
    for (const worldLayer of ['surface', 'inner'] as WorldLayer[]) {
      for (const time of TIMES_OF_DAY) {
        expect(resolveEnvironment(scene({ worldLayer, time })).sky.variant).toBe(`${worldLayer}-${time}`)
      }
    }
  })
})

describe('第一版时间系统', () => {
  it('只有四档', () => {
    expect(TIMES_OF_DAY).toHaveLength(4)
  })

  it('清晨与黄昏是低角度，正午是高角度', () => {
    const morning = resolveEnvironment(scene({ time: 'morning' })).celestial
    const noon = resolveEnvironment(scene({ time: 'noon' })).celestial
    const dusk = resolveEnvironment(scene({ time: 'dusk' })).celestial

    expect(noon.yPct).toBeLessThan(morning.yPct)
    expect(noon.yPct).toBeLessThan(dusk.yPct)
    // 清晨偏东、黄昏偏西
    expect(morning.xPct).toBeLessThan(noon.xPct)
    expect(dusk.xPct).toBeGreaterThan(noon.xPct)
    expect(noon.xPct).toBeGreaterThan(60)
    expect(noon.xPct).not.toBe(50)
  })

  it('夜晚没有太阳，换成月亮；晴朗夜晚才有星星', () => {
    const clearNight = resolveEnvironment(scene({ time: 'night', weather: 'clear' })).celestial
    expect(clearNight.body).toBe('moon')
    expect(clearNight.stars).toBe(true)
    expect(clearNight.xPct).toBeGreaterThan(70)

    const rainyNight = resolveEnvironment(scene({ time: 'night', weather: 'rain' })).celestial
    expect(rainyNight.body).toBe('moon')
    expect(rainyNight.stars).toBe(false)
  })

  it('白天一律是太阳', () => {
    for (const time of ['morning', 'noon', 'dusk'] as TimeOfDay[]) {
      expect(resolveEnvironment(scene({ time })).celestial.body).toBe('sun')
    }
  })
})

describe('第一版天气系统', () => {
  it('只有三种，且没有沙尘 / 雷暴 / 雾 / 风暴', () => {
    expect(allowedWeather('surface')).toEqual(['clear', 'rain', 'snow'])
    for (const banned of ['dust', 'thunderstorm', 'fog', 'storm']) {
      expect(allowedWeather('surface') as string[]).not.toContain(banned)
    }
  })

  it('天气只影响云量与降水，不搬动天体', () => {
    const clear = resolveEnvironment(scene({ time: 'noon', weather: 'clear' }))
    const rain = resolveEnvironment(scene({ time: 'noon', weather: 'rain' }))

    expect(rain.weather.cloudCover).toBeGreaterThan(clear.weather.cloudCover)
    expect(rain.weather.intensity).toBeGreaterThan(0)
    // 同一时间下太阳位置不因天气改变 —— 天体不画进天气贴图
    expect(rain.celestial.xPct).toBe(clear.celestial.xPct)
    expect(rain.celestial.yPct).toBe(clear.celestial.yPct)
    // 只是被云遮蔽
    expect(rain.celestial.occlusion).toBeGreaterThan(clear.celestial.occlusion)
  })

  it('clear 不产生降水', () => {
    expect(resolveEnvironment(scene({ weather: 'clear' })).weather.intensity).toBe(0)
  })
})

describe('里世界天气规则', () => {
  it('是同一套枚举的子集，不是第二套天气系统', () => {
    const inner = allowedWeather('inner')
    const surface = allowedWeather('surface')
    expect(inner.every(w => surface.includes(w))).toBe(true)
    expect(inner).toEqual(['clear', 'rain'])
  })

  it('里世界不下雪', () => {
    expect(isWeatherAllowed('inner', 'snow')).toBe(false)
    expect(isWeatherAllowed('surface', 'snow')).toBe(true)
  })

  it('不被允许的天气被收窄，而不是留下无效状态', () => {
    expect(coerceWeather('inner', 'snow')).toBe('clear')
    expect(coerceWeather('inner', 'rain')).toBe('rain')
    expect(resolveEnvironment(scene({ worldLayer: 'inner', weather: 'snow' })).weather.kind).toBe('clear')
    expect(resolveEnvironment(scene({ worldLayer: 'inner', weather: 'snow' })).scene.weather).toBe('clear')
  })

  it('里世界渗透是空气参数，不是一种天气', () => {
    expect(resolveEnvironment(scene({ worldLayer: 'surface' })).atmosphere.seepage).toBe(0)
    expect(resolveEnvironment(scene({ worldLayer: 'inner' })).atmosphere.seepage).toBeGreaterThan(0)
  })
})

describe('解算是纯函数', () => {
  it('不改动入参', () => {
    const input = scene({ worldLayer: 'inner', weather: 'snow' })
    const snapshot = { ...input }
    resolveEnvironment(input)
    expect(input).toEqual(snapshot)
  })

  it('所有归一化参数都落在 0..1', () => {
    for (const worldLayer of ['surface', 'inner'] as WorldLayer[]) {
      for (const time of TIMES_OF_DAY) {
        for (const weather of ['clear', 'rain', 'snow'] as Weather[]) {
          const r = resolveEnvironment({ worldLayer, time, weather })
          for (const value of [
            r.sky.luminance,
            r.celestial.occlusion,
            r.weather.intensity,
            r.weather.cloudCover,
            r.atmosphere.haze,
            r.atmosphere.seepage,
          ]) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  READER_ENVIRONMENT_OPTIONS,
  resolveReaderEnvironmentPreview,
} from '../src/data/reader-experiments/readerEnvironmentPreview'

describe('Reader-only environment preview', () => {
  it('resolves every Reader preview combination without changing the Center schema', () => {
    const results = []
    for (const worldLayer of READER_ENVIRONMENT_OPTIONS.worldLayers.map(option => option.value)) {
      for (const time of READER_ENVIRONMENT_OPTIONS.times.map(option => option.value)) {
        for (const weather of READER_ENVIRONMENT_OPTIONS.weather.map(option => option.value)) {
          results.push(resolveReaderEnvironmentPreview({ worldLayer, time, weather }))
        }
      }
    }

    expect(results).toHaveLength(
      READER_ENVIRONMENT_OPTIONS.worldLayers.length
      * READER_ENVIRONMENT_OPTIONS.times.length
      * READER_ENVIRONMENT_OPTIONS.weather.length,
    )
    for (const result of results) {
      expect(result.style['--reader-paper']).toMatch(/^rgb\(/)
      expect(result.style['--reader-environment-light-rgb']).toBeTruthy()
    }
  })

  it('keeps all Reader times visibly distinct in both worlds', () => {
    for (const worldLayer of ['surface', 'inner']) {
      const papers = READER_ENVIRONMENT_OPTIONS.times.map(({ value: time }) => (
        resolveReaderEnvironmentPreview({ worldLayer, time, weather: 'clear' }).style['--reader-paper']
      ))
      expect(new Set(papers).size).toBe(READER_ENVIRONMENT_OPTIONS.times.length)
    }
  })

  it('keeps clear, overcast, rain, and snow visually distinct in both worlds', () => {
    for (const worldLayer of ['surface', 'inner']) {
      const papers = READER_ENVIRONMENT_OPTIONS.weather.map(({ value: weather }) => (
        resolveReaderEnvironmentPreview({ worldLayer, time: 'morning', weather }).style['--reader-paper']
      ))
      expect(new Set(papers).size).toBe(4)
    }
  })

  it('raises precipitation contrast on light paper while keeping night particles luminous', () => {
    const daylight = resolveReaderEnvironmentPreview({ worldLayer: 'surface', time: 'noon', weather: 'rain' }).style
    const night = resolveReaderEnvironmentPreview({ worldLayer: 'surface', time: 'night', weather: 'snow' }).style

    expect(daylight['--reader-rain-rgb']).toBe('38 63 82')
    expect(daylight['--reader-rain-contrast']).toBe(1.55)
    expect(daylight['--reader-snow-rgb']).toBe('133 153 164')
    expect(night['--reader-rain-rgb']).toBe('174 195 210')
    expect(night['--reader-snow-rgb']).toBe('242 247 249')
  })
})

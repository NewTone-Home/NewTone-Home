import { describe, expect, it } from 'vitest'
import { mainlineReadingActorOpacity, mainlineReadingFontSizePx, mainlineReadingStaticOpacity } from '../src/center/runtime/mainlineTextReading'

describe('mainline reading-space effects', () => {
  it('keeps the existing compact-portrait CSS reading size', () => {
    expect(mainlineReadingFontSizePx({ width: 411, height: 914 })).toBe(12)
  })

  it('lets static objects reach full transparency at the text and recover outside its fade area', () => {
    const reading = { x: 50, y: 50 }
    const box = { widthPx: 180, heightPx: 40 }
    expect(mainlineReadingStaticOpacity(reading, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 50.5, y: 50 }, reading, box, 1)).toBe(0)
    expect(mainlineReadingStaticOpacity({ x: 55, y: 50 }, reading, box, 1)).toBeGreaterThan(0)
    expect(mainlineReadingStaticOpacity({ x: 80, y: 50 }, reading, box, 1)).toBe(1)
  })

  it('keeps actors visible while marking actors crossing the reading surface semi-transparent', () => {
    const reading = { x: 50, y: 50 }
    const box = { widthPx: 180, heightPx: 40 }
    expect(mainlineReadingActorOpacity(reading, reading, box, 1)).toBe(.44)
    expect(mainlineReadingActorOpacity({ x: 80, y: 50 }, reading, box, 1)).toBe(1)
  })
})

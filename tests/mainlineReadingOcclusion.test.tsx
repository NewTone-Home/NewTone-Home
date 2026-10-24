import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineReadingOcclusionMask } from '../src/center/runtime/MainlineReadingOcclusionMask'
import { mainlineReadingOcclusionAlpha, mainlineReadingOcclusionMaskRegion, mainlineReadingOcclusionRect } from '../src/center/runtime/mainlineReadingOcclusion'

describe('mainline spatial reading occlusion', () => {
  it('maps the CSS reading layout into the 1920×1080 world without changing its screen size', () => {
    const rect = mainlineReadingOcclusionRect({ x: 50, y: 50 }, { widthPx: 320, heightPx: 160 }, .65)
    expect(rect.x + rect.width / 2).toBe(960)
    expect(rect.y + rect.height / 2).toBe(540)
    expect(rect.width * .65).toBeCloseTo(320)
    expect(rect.height * .65).toBeCloseTo(160)
  })

  it('keeps one world-character feather at portrait and desktop projection scales', () => {
    for (const viewportWidth of [360, 411, 1280, 1920]) {
      for (const worldScale of [.65, 1]) {
        const cssWidth = Math.max(120, Math.min(600, viewportWidth - 24))
        const rect = mainlineReadingOcclusionRect({ x: 50, y: 50 }, { widthPx: cssWidth, heightPx: 60 }, worldScale)
        expect(rect.width * worldScale).toBeCloseTo(cssWidth)
        expect(mainlineReadingOcclusionAlpha({ x: rect.x + rect.width + 8, y: rect.y + rect.height / 2 }, rect)).toBeCloseTo(.5)
      }
    }
  })

  it('uses a one-character linear alpha ramp, including the rectangle corners', () => {
    const rect = { x: 100, y: 200, width: 300, height: 80 }
    expect(mainlineReadingOcclusionAlpha({ x: 250, y: 240 }, rect)).toBe(0)
    expect(mainlineReadingOcclusionAlpha({ x: 404, y: 240 }, rect)).toBeCloseTo(.25)
    expect(mainlineReadingOcclusionAlpha({ x: 400 + 8 / Math.sqrt(2), y: 280 + 8 / Math.sqrt(2) }, rect)).toBeCloseTo(.5)
    expect(mainlineReadingOcclusionAlpha({ x: 416, y: 240 }, rect)).toBe(1)
  })

  it('bounds the mask to scene, reading, and protected visuals instead of a huge full-world surface', () => {
    const region = mainlineReadingOcclusionMaskRegion(
      { x: -5, y: -2, width: 110, height: 104 },
      { x: 1900, y: 1050, width: 200, height: 100 },
      [{ x: 400, y: 200, width: 32, height: 32 }],
    )
    expect(region.x).toBe(-128)
    expect(region.y).toBe(-53.6)
    expect(region.width).toBe(2260)
    expect(region.height).toBeCloseTo(1235.6)
  })

  it('renders a shared world-space mask with smooth entry/exit and separate protected entity holes', () => {
    const html = renderToStaticMarkup(<MainlineReadingOcclusionMask
      id="reading-mask-test"
      readingRect={{ x: 100, y: 200, width: 300, height: 80 }}
      protectedRects={[{ x: 500, y: 400, width: 32, height: 32 }, { x: 700, y: 400, width: 32, height: 32 }]}
      region={{ x: -100, y: -100, width: 1000, height: 1000 }}
      active={false}
    />)
    expect(html).toContain('maskUnits="userSpaceOnUse"')
    expect(html).toContain('mask-type="luminance"')
    expect(html).toContain('data-reading-mask-core="true"')
    expect(html).toContain('data-reading-mask-progress="0"')
    expect(html).toContain('transition:opacity 400ms linear')
    expect(html).toContain('data-reading-mask-protection="true"')
    expect(html).toContain('reading-mask-test-top-left')
    expect(html).toContain('reading-mask-test-bottom-right')
    expect(html).toContain('data-reading-mask-feather-world-px="16"')
    expect(html.match(/data-reading-mask-protection=/g)).toHaveLength(2)
  })
})

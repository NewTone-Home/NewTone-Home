import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineReadingOcclusionMask } from '../src/center/runtime/MainlineReadingOcclusionMask'
import { mainlineReadingOcclusionAlpha, mainlineReadingOcclusionRect } from '../src/center/runtime/mainlineReadingOcclusion'

describe('mainline spatial reading occlusion', () => {
  it('maps the CSS reading layout into the 1920×1080 world without changing its screen size', () => {
    const rect = mainlineReadingOcclusionRect({ x: 50, y: 50 }, { widthPx: 320, heightPx: 160 }, .65)
    expect(rect.x + rect.width / 2).toBe(960)
    expect(rect.y + rect.height / 2).toBe(540)
    expect(rect.width * .65).toBeCloseTo(320)
    expect(rect.height * .65).toBeCloseTo(160)
  })

  it('uses a one-character linear alpha ramp, including the rectangle corners', () => {
    const rect = { x: 100, y: 200, width: 300, height: 80 }
    expect(mainlineReadingOcclusionAlpha({ x: 250, y: 240 }, rect)).toBe(0)
    expect(mainlineReadingOcclusionAlpha({ x: 404, y: 240 }, rect)).toBeCloseTo(.25)
    expect(mainlineReadingOcclusionAlpha({ x: 400 + 8 / Math.sqrt(2), y: 280 + 8 / Math.sqrt(2) }, rect)).toBeCloseTo(.5)
    expect(mainlineReadingOcclusionAlpha({ x: 416, y: 240 }, rect)).toBe(1)
  })

  it('renders a shared world-space mask with smooth entry/exit and separate protected entity holes', () => {
    const html = renderToStaticMarkup(<MainlineReadingOcclusionMask
      id="reading-mask-test"
      readingRect={{ x: 100, y: 200, width: 300, height: 80 }}
      protectedRects={[{ x: 500, y: 400, width: 32, height: 32 }]}
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
  })
})

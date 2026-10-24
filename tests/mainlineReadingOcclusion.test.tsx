import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineReadingOcclusionMask } from '../src/center/runtime/MainlineReadingOcclusionMask'
import { MainlineReadingIdentityPlane } from '../src/center/runtime/MainlineReadingIdentityPlane'
import { mainlineReadingOcclusionAlpha, mainlineReadingOcclusionMaskRegion, mainlineReadingOcclusionRect, retainMainlineReadingOcclusionSnapshot } from '../src/center/runtime/mainlineReadingOcclusion'

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

  it('bounds the shared mask to scene and reading rectangles instead of a huge full-world surface', () => {
    const region = mainlineReadingOcclusionMaskRegion(
      { x: -5, y: -2, width: 110, height: 104 },
      { x: 1900, y: 1050, width: 200, height: 100 },
    )
    expect(region.x).toBe(-128)
    expect(region.y).toBe(-53.6)
    expect(region.width).toBe(2260)
    expect(region.height).toBeCloseTo(1235.6)
  })

  it('renders a shared world-space mask with a fadeable shape and no spatial protection holes', () => {
    const html = renderToStaticMarkup(<MainlineReadingOcclusionMask
      id="reading-mask-test"
      readingRect={{ x: 100, y: 200, width: 300, height: 80 }}
      region={{ x: -100, y: -100, width: 1000, height: 1000 }}
      active={false}
    />)
    expect(html).toContain('maskUnits="userSpaceOnUse"')
    expect(html).toContain('mask-type="luminance"')
    expect(html).toContain('data-reading-mask-core="true"')
    expect(html).toContain('data-reading-mask-progress="0"')
    expect(html).toContain('transition:opacity 400ms linear')
    expect(html).not.toContain('data-reading-mask-protection')
    expect(html).toContain('reading-mask-test-top-left')
    expect(html).toContain('reading-mask-test-bottom-right')
    expect(html).toContain('data-reading-mask-feather-world-px="16"')
  })

  it('does not replace retained React state when per-render geometry has the same values', () => {
    const current = { sessionKey: 'reading:1', rect: { x: 20, y: 30, width: 400, height: 80 }, region: { x: -32, y: -32, width: 500, height: 180 }, protectedEntityIds: new Set(['menu']) }
    const recomputed = { sessionKey: 'reading:1', rect: { ...current.rect }, region: { ...current.region }, protectedEntityIds: new Set(['menu']) }
    expect(retainMainlineReadingOcclusionSnapshot(current, recomputed)).toBe(current)
    const changedRect = { ...recomputed, rect: { ...recomputed.rect, x: 21 } }
    expect(retainMainlineReadingOcclusionSnapshot(current, changedRect)).toBe(changedRect)
    expect(retainMainlineReadingOcclusionSnapshot(current, { ...recomputed, protectedEntityIds: new Set(['table']) })).not.toBe(current)
  })

  it('protects only the active identity when target and neighbor occupy the same pixels', () => {
    const html = renderToStaticMarkup(<>
      <MainlineReadingIdentityPlane entityId="menu" protectedEntityIds={new Set(['menu'])} maskStyle={{ maskImage: 'url(#shared-reading-mask)' }}>
        <span data-overlap="target-menu">菜单及其框</span>
      </MainlineReadingIdentityPlane>
      <MainlineReadingIdentityPlane entityId="neighbor-wall" protectedEntityIds={new Set(['menu'])} maskStyle={{ maskImage: 'url(#shared-reading-mask)' }}>
        <span data-overlap="neighbor-wall">墙</span>
      </MainlineReadingIdentityPlane>
    </>)
    const target = html.match(/<div[^>]*data-reading-occlusion-entity-id="menu"[^>]*>/)?.[0]
    const neighbor = html.match(/<div[^>]*data-reading-occlusion-entity-id="neighbor-wall"[^>]*>/)?.[0]
    expect(target).toContain('data-reading-occlusion-protected="true"')
    expect(target).not.toContain('mask-image')
    expect(neighbor).not.toContain('data-reading-occlusion-protected')
    expect(neighbor).toContain('mask-image:url(#shared-reading-mask)')
    expect(html).toContain('data-overlap="target-menu"')
    expect(html).toContain('data-overlap="neighbor-wall"')
  })
})

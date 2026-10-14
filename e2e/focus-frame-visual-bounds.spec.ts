import { expect, test } from '@playwright/test'

const viewports = [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 838, height: 2048 }]
const scenes = ['jijia-ancestral-home', 'jijia-ancestral-interior', 'zhongshuyuan-office', 'commercial-street']

for (const viewport of viewports) for (const scene of scenes) {
  test(`focus frames follow visible glyph bounds for ${scene} at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await page.goto('/?scene=' + scene)
    await page.waitForSelector('.mainline-scene-stage')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1700)
    const result = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')!
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      const frames = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame[data-focus-frame-phase="visible"]')]
      const bounds = (elements: HTMLElement[]) => {
        const ink: DOMRect[] = []
        for (const element of elements) {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            const style = getComputedStyle(text.parentElement ?? element)
            context.font = style.font
            const value = text.textContent ?? ''
            let offset = 0
            for (const glyph of value) {
              const start = offset
              offset += glyph.length
              if (/^\s+$/u.test(glyph)) continue
              const range = document.createRange()
              range.setStart(text, start); range.setEnd(text, offset)
              const layout = range.getBoundingClientRect()
              const metric = context.measureText(glyph)
              const measuredWidth = metric.actualBoundingBoxLeft + metric.actualBoundingBoxRight
              const measuredHeight = metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent
              const sideways = style.writingMode.startsWith('vertical') && style.textOrientation !== 'upright'
              const width = Math.min(layout.width, sideways ? measuredHeight : measuredWidth)
              const height = Math.min(layout.height, sideways ? measuredWidth : measuredHeight)
              if (width > 0 && height > 0) ink.push(new DOMRect(layout.left + (layout.width - width) / 2, layout.top + (layout.height - height) / 2, width, height))
            }
          }
        }
        if (!ink.length) return null
        const left = Math.min(...ink.map(rect => rect.left)), top = Math.min(...ink.map(rect => rect.top))
        const right = Math.max(...ink.map(rect => rect.right)), bottom = Math.max(...ink.map(rect => rect.bottom))
        return { left, top, right, bottom, width: right - left, height: bottom - top }
      }
      return frames.map(frame => {
        const group = frame.dataset.focusFrameGroup
        const texts = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')].filter(node => node.dataset.focusVisualGroup === group)
        const text = bounds(texts)
        if (!text) return { group, error: 'missing glyph bounds' }
        const box = frame.getBoundingClientRect()
        const inset = 1
        const halfStroke = .5
        const gap = {
          left: text.left - (box.left + inset + halfStroke), right: (box.right - inset - halfStroke) - text.right,
          top: text.top - (box.top + inset + halfStroke), bottom: (box.bottom - inset - halfStroke) - text.bottom,
        }
        const neighbors = [...stage.querySelectorAll<HTMLElement>('.scene-mainline-wall')]
          .filter(node => !texts.some(textNode => textNode === node || textNode.contains(node) || node.contains(textNode)))
          .map(node => bounds([node]))
          .filter((rect): rect is NonNullable<typeof rect> => rect !== null)
        const strokeRects = [
          { left: box.left + inset, right: box.right - inset, top: box.top + inset - halfStroke, bottom: box.top + inset + halfStroke },
          { left: box.left + inset, right: box.right - inset, top: box.bottom - inset - halfStroke, bottom: box.bottom - inset + halfStroke },
          { left: box.left + inset - halfStroke, right: box.left + inset + halfStroke, top: box.top + inset + halfStroke, bottom: box.bottom - inset - halfStroke },
          { left: box.right - inset - halfStroke, right: box.right - inset + halfStroke, top: box.top + inset + halfStroke, bottom: box.bottom - inset - halfStroke },
        ]
        const overlapNeighbors = neighbors.flatMap(rect => strokeRects.some(stroke => stroke.left < rect.right && stroke.right > rect.left && stroke.top < rect.bottom && stroke.bottom > rect.top)
          ? [{ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }] : [])
        return { group, text, frame: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }, gap, overlapNeighbors }
      })
    })
    expect(result.length).toBeGreaterThan(0)
    for (const frame of result) {
      expect('error' in frame ? frame.error : frame.group).not.toBe('missing glyph bounds')
      if ('error' in frame) continue
      // SVG paths sit 1px inside the measured box and use a 1px stroke.
      // Adaptive margins may approach adjacent glyphs, so validate the actual
      // visible stroke gap rather than assuming a fixed outer box padding.
      for (const side of Object.values(frame.gap)) expect(side).toBeGreaterThanOrEqual(0)
      expect(frame.frame.width).toBeCloseTo(frame.text.width + frame.gap.left + frame.gap.right + 3, 1)
      expect(frame.frame.height).toBeCloseTo(frame.text.height + frame.gap.top + frame.gap.bottom + 3, 1)
      expect(frame.overlapNeighbors, JSON.stringify(frame)).toHaveLength(0)
    }
    await page.screenshot({ path: info.outputPath('focus-frames-' + scene + '.png') })
  })
}

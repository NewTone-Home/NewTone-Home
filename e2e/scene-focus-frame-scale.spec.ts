import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { sceneFocusFrameGeometry } from '../src/center/runtime/SceneFocusFrames'

// Raster equality catches missing SVG dash segments that DOM/path assertions miss.
const css = readFileSync('src/center/runtime/scene.css', 'utf8')
for (const scale of [.5, .740741, 1, 1.5]) {
  test(`focus stroke draws and retracts completely at world scale ${scale}`, async ({ page }, testInfo) => {
    const geometry = sceneFocusFrameGeometry(80, 30)
    await page.setViewportSize({ width: 600, height: 400 })
    await page.setContent(`<style>${css}
      body { margin:0; background:white }
      #world { position:absolute; left:20px; top:20px; transform-origin:0 0; transform:scale(${scale}) }
      .scene-focus-frame { left:0; top:0; width:${80 / scale}px; height:${30 / scale}px; color:black; opacity:1;
        --scene-focus-stroke-offset:1; --scene-focus-frame-duration:600ms }
      </style><div id="world"><span class="scene-focus-frame" data-focus-frame-phase="collapsed">
      <svg viewBox="${geometry.viewBox}" preserveAspectRatio="none"><path pathLength="1" d="${geometry.paths['top-left']}"/></svg></span></div>`)
    const frame = page.locator('.scene-focus-frame')
    const blank = await page.screenshot()
    await frame.evaluate(e => e.setAttribute('data-focus-frame-phase', 'appearing'))
    await frame.evaluate(e => (e as HTMLElement).style.setProperty('--scene-focus-stroke-offset', '0'))
    await page.waitForTimeout(250)
    const drawing = await page.screenshot({ path: testInfo.outputPath('drawing.png') })
    await page.waitForTimeout(450)
    const visible = await page.screenshot({ path: testInfo.outputPath('visible.png') })
    // Compare straight edge interiors: dashed/solid closed paths can rasterize
    // their start-corner cap/join differently without leaving a missing segment.
    const edges = [
      { x: 23, y: 20, width: 74, height: 3 },
      { x: 20, y: 23, width: 3, height: 24 },
      { x: 23, y: 47, width: 74, height: 3 },
      { x: 97, y: 23, width: 3, height: 24 },
    ]
    const actual = []
    for (const clip of edges) actual.push(await page.screenshot({ clip }))
    await page.locator('path').evaluate(e => (e as SVGPathElement).style.strokeDasharray = 'none')
    await page.screenshot({ path: testInfo.outputPath('solid-reference.png') })
    for (let i = 0; i < edges.length; i += 1) {
      const reference = await page.screenshot({ clip: edges[i] })
      const difference = await page.evaluate(async (images) => {
        const pixels = await Promise.all(images.map(async (base64) => {
          const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'image/png' }))
          const canvas = document.createElement('canvas')
          canvas.width = bitmap.width
          canvas.height = bitmap.height
          const context = canvas.getContext('2d')!
          context.drawImage(bitmap, 0, 0)
          return context.getImageData(0, 0, bitmap.width, bitmap.height).data
        }))
        return pixels[0].reduce((max, value, index) => Math.max(max, Math.abs(value - pixels[1][index])), 0)
      }, [actual[i].toString('base64'), reference.toString('base64')])
      // Subpixel SVG rasterization can differ by one channel level.
      expect(difference, `edge ${i} must rasterize as a full solid edge`).toBeLessThanOrEqual(2)
    }
    expect(drawing.equals(visible), 'appearance must progressively draw the perimeter').toBe(false)
    await page.locator('path').evaluate(e => (e as SVGPathElement).style.removeProperty('stroke-dasharray'))
    await frame.evaluate(e => {
      e.setAttribute('data-focus-frame-phase', 'retracting')
      ;(e as HTMLElement).style.setProperty('--scene-focus-stroke-offset', '1')
    })
    await page.waitForTimeout(250)
    const retracting = await page.screenshot({ path: testInfo.outputPath('retracting.png') })
    expect(retracting.equals(visible), 'retraction must remove perimeter progressively').toBe(false)
    await page.waitForTimeout(450)
    await frame.evaluate(e => e.setAttribute('data-focus-frame-phase', 'collapsed'))
    expect((await page.screenshot()).equals(blank), 'collapsed frame must leave no pixels').toBe(true)
  })
}

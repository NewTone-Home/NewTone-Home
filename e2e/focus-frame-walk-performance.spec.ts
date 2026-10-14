import { expect, test } from '@playwright/test'
import { mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import { storefrontCharacterCells } from '../src/center/runtime/storefrontPresentation'

declare global {
  interface Window {
    __focusMeasurementProbe?: {
      rangeRects: number
      canvasMeasures: number
      focusQueries: number
      resizeCallbacks: number
      mutationBatches: number
      mutationSamples: string[]
    }
    __walkFrameProbe?: { gaps: number[]; last: number | null; handle: number }
  }
}

const street = mainlineScenes['commercial-street']
const cafe = street.storefronts.find(storefront => storefront.id === 'commercial-cafe-slot')!

test('walking does not repeatedly measure focus characters, and Café switch cells follow responsive geometry', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { rangeRects: 0, canvasMeasures: 0, focusQueries: 0, resizeCallbacks: 0, mutationBatches: 0, mutationSamples: [] as string[] }
    window.__focusMeasurementProbe = probe
    const rangeRect = Range.prototype.getBoundingClientRect
    Range.prototype.getBoundingClientRect = function () {
      probe.rangeRects += 1
      return rangeRect.call(this)
    }
    const measureText = CanvasRenderingContext2D.prototype.measureText
    CanvasRenderingContext2D.prototype.measureText = function (text: string) {
      probe.canvasMeasures += 1
      return measureText.call(this, text)
    }
    const queryAll = Element.prototype.querySelectorAll
    Element.prototype.querySelectorAll = function (selectors: string) {
      if (selectors.includes('data-focus-visual-group') || selectors.includes('data-scene-characters')) probe.focusQueries += 1
      return queryAll.call(this, selectors)
    } as typeof Element.prototype.querySelectorAll
    const NativeResizeObserver = window.ResizeObserver
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          probe.resizeCallbacks += 1
          callback(entries, observer)
        })
      }
    }
    const NativeMutationObserver = window.MutationObserver
    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super((records, observer) => {
          probe.mutationBatches += 1
          records.slice(0, 3).forEach(record => {
            if (probe.mutationSamples.length < 12) {
              const target = record.target instanceof Element ? record.target : record.target.parentElement
              probe.mutationSamples.push(`${record.type}:${record.attributeName ?? record.type}:${target?.tagName}.${typeof target?.className === 'string' ? target.className : ''}`)
            }
          })
          callback(records, observer)
        })
      }
    }
  })

  let stage = page.locator('.mainline-scene-stage')
  const viewportCases = [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
  for (const viewport of viewportCases) {
    await page.setViewportSize(viewport)
    await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
    await page.evaluate(() => document.fonts.ready)
    stage = page.locator('.mainline-scene-stage')
    const cells = stage.locator(`.scene-portal-characters[data-storefront-id="${cafe.id}"] [data-storefront-cell-id]`)
    await expect.poll(async () => {
      const metrics = await stage.evaluate(() => ({ width: 1280, height: 720, viewportWidth: window.innerWidth }))
      const expected = storefrontCharacterCells(street, cafe, mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe), metrics))
        .map(cell => ({ id: cell.id, x: cell.x, y: cell.y }))
      const actual = await cells.evaluateAll(nodes => nodes.map(node => ({
        id: (node as HTMLElement).dataset.storefrontCellId,
        x: Number.parseFloat((node as HTMLElement).style.left),
        y: Number.parseFloat((node as HTMLElement).style.top),
      })))
      return actual.length === 3 && JSON.stringify(actual) === JSON.stringify(expected)
    }, { timeout: 8_000 }).toBe(true)
    const metrics = await stage.evaluate(() => ({ width: 1280, height: 720, viewportWidth: window.innerWidth }))
    const expectedCells = storefrontCharacterCells(street, cafe, mainlineSceneGeometryUnits(street, mainlineStorefrontApproach(street, cafe), metrics))
    const actualCells = await cells.evaluateAll(nodes => nodes.map(node => ({
      id: (node as HTMLElement).dataset.storefrontCellId,
      x: Number.parseFloat((node as HTMLElement).style.left),
      y: Number.parseFloat((node as HTMLElement).style.top),
    })))
    expect(actualCells).toEqual(expectedCells.map(cell => ({ id: cell.id, x: cell.x, y: cell.y })))
    expect(actualCells).toHaveLength(3)
    const visualBounds = await cells.evaluateAll(nodes => nodes.map(node => {
      const rect = node.querySelector<HTMLElement>('.scene-character-switch')?.getBoundingClientRect()
      return rect ? { x: Number(rect.x.toFixed(1)), y: Number(rect.y.toFixed(1)), width: Number(rect.width.toFixed(1)), height: Number(rect.height.toFixed(1)) } : null
    }))
    console.log('[cafe-responsive-glyphs]', JSON.stringify({ viewport, metrics, actualCells, visualBounds }))
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  // Use a dialogue-free office route for repeatable movement measurements.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto('/?scene=zhongshuyuan-office&debugRuntimeEvidence=1')
  await page.evaluate(() => document.fonts.ready)
  stage = page.locator('.mainline-scene-stage')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  await expect(protagonist).toBeVisible()
  await page.waitForTimeout(1200)
  const metrics = await stage.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) }
  })

  await page.evaluate(() => {
    const probe = window.__focusMeasurementProbe!
    probe.rangeRects = 0
    probe.canvasMeasures = 0
    probe.focusQueries = 0
    probe.resizeCallbacks = 0
    probe.mutationBatches = 0
    probe.mutationSamples = []
  })
  const camera = await stage.evaluate(element => ({
    x: Number(element.getAttribute('data-camera-offset-x') ?? 0),
    y: Number(element.getAttribute('data-camera-offset-y') ?? 0),
  }))
  const clickPoint = { x: ((65 + camera.x) / 100) * metrics.width, y: ((50 + camera.y) / 100) * metrics.height }
  await stage.click({ position: clickPoint })
  await expect(protagonist).toHaveClass(/is-moving/)
  const currentActorX = () => protagonist.evaluate(element => {
    const node = element as HTMLElement
    return Number.parseFloat(node.dataset.runtimeX ?? node.style.left)
  })
  const startX = await currentActorX()
  await page.evaluate(() => {
    const frameProbe = { gaps: [] as number[], last: null as number | null, handle: 0 }
    const sample = (now: number) => {
      const actor = document.querySelector('[data-actor-id="protagonist"]')
      if (actor?.classList.contains('is-moving')) {
        if (frameProbe.last !== null) frameProbe.gaps.push(now - frameProbe.last)
        frameProbe.last = now
      } else frameProbe.last = null
      frameProbe.handle = requestAnimationFrame(sample)
    }
    frameProbe.handle = requestAnimationFrame(sample)
    window.__walkFrameProbe = frameProbe
  })
  await page.waitForTimeout(5_000)
  const measurement = await page.evaluate(() => {
    const frameProbe = window.__walkFrameProbe!
    cancelAnimationFrame(frameProbe.handle)
    const sorted = [...frameProbe.gaps].sort((first, second) => first - second)
    const total = frameProbe.gaps.reduce((sum, gap) => sum + gap, 0)
    return {
      ...window.__focusMeasurementProbe!,
      frameCount: frameProbe.gaps.length,
      activeMs: Number(total.toFixed(1)),
      fps: Number((frameProbe.gaps.length * 1000 / total).toFixed(1)),
      p95Ms: Number((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0).toFixed(1)),
      over50ms: frameProbe.gaps.filter(gap => gap > 50).length,
      maxFrameMs: Number((sorted.at(-1) ?? 0).toFixed(1)),
    }
  })
  const endX = await currentActorX()
  console.log('[focus-frame-walk-performance]', JSON.stringify({ ...measurement, startX, endX }))
  expect(Math.abs(endX - startX)).toBeGreaterThan(1)
  const measurements = measurement
  await cdp.detach()
  expect(measurements.rangeRects, JSON.stringify(measurements)).toBe(0)
  expect(measurements.canvasMeasures, JSON.stringify(measurements)).toBe(0)
  expect(measurements.focusQueries, JSON.stringify(measurements)).toBe(0)
})

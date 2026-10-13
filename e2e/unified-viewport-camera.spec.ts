import { expect, test } from '@playwright/test'
import { createMainlineViewportProjection } from '../src/center/runtime/mainlineViewport'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const viewports = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 834, height: 1194 },
  { width: 1194, height: 834 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]

test('one continuous world projection keeps pointer walking aligned across viewport sizes', async ({ page }, testInfo) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
    const stage = page.locator('.mainline-scene-stage')
    const before = await stage.evaluate((element) => {
      const node = element as HTMLElement
      return {
        width: node.clientWidth,
        height: node.clientHeight,
        scale: Number(node.dataset.cameraScale),
        worldWidth: Number(node.dataset.worldSizeWidth),
        worldHeight: Number(node.dataset.worldSizeHeight),
      }
    })
    const projection = createMainlineViewportProjection({ width: before.width, height: before.height })
    expect(before.scale).toBeCloseTo(projection.scale, 5)
    expect(before.worldWidth).toBe(1280)
    expect(before.worldHeight).toBe(720)
    const actor = page.locator('[data-actor-id="protagonist"]')
    const initialX = Number(await actor.getAttribute('data-runtime-x'))
    const initialY = Number(await actor.getAttribute('data-runtime-y'))
    // Click at a stage-local screen point; the runtime's inverse projection
    // should map this into the walkable world at every aspect ratio.
    const screenPoint = { x: Math.round(before.width * .67), y: Math.round(before.height * .56) }
    await stage.click({ position: screenPoint })
    await expect(actor).toHaveClass(/is-moving/, { timeout: 10_000 })
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 30_000 })
    const arrived = {
      x: Number(await actor.getAttribute('data-runtime-x')),
      y: Number(await actor.getAttribute('data-runtime-y')),
    }
    expect(Number.isFinite(arrived.x) && Number.isFinite(arrived.y)).toBe(true)
    expect(Math.hypot(arrived.x - initialX, arrived.y - initialY)).toBeGreaterThan(.25)
    const walkBounds = mainlineScenes['commercial-street'].walkBounds
    expect(arrived.x).toBeGreaterThanOrEqual(walkBounds.x)
    expect(arrived.x).toBeLessThanOrEqual(walkBounds.x + walkBounds.width)

    const layerTransform = await page.locator('.scene-mainline-world').evaluate((element) => getComputedStyle(element).transform)
    expect(layerTransform).toContain('matrix(')
    expect(layerTransform).toBeTruthy()
    if ([
      '1280x720',
      '390x844',
      '834x1194',
    ].includes(`${viewport.width}x${viewport.height}`)) {
      await page.screenshot({ path: testInfo.outputPath(`unified-viewport-${viewport.width}x${viewport.height}.png`), fullPage: true })
    }
  }
})

test('resizing keeps the world and dialogue layer on one shared transform', async ({ page }) => {
  await page.goto('/?scene=zhongshuyuan-office&debugRuntimeEvidence=1')
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => Number(await page.locator('.mainline-scene-stage').getAttribute('data-camera-scale'))).toBeCloseTo(
      createMainlineViewportProjection(viewport).scale,
      4,
    )
    const transforms = await page.evaluate(() => ['.scene-mainline-world', '.scene-mainline-reading-layer']
      .map(selector => getComputedStyle(document.querySelector(selector)!).transform))
    expect(transforms[0]).toBe(transforms[1])
    expect(transforms[0]).toContain('matrix(')
  }
})


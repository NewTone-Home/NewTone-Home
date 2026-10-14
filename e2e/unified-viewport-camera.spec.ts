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

test('C and D URL candidates use the measured stage and preserve the shared logical world', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['C', 'D'] as const) {
    await page.goto(`/?scene=jijia-ancestral-interior&debugRuntimeEvidence=1&viewportScale=${mode}`)
    const stage = page.locator('.mainline-scene-stage')
    await expect(stage).toHaveAttribute('data-camera-scale-mode', mode)
    const measured = await stage.evaluate((element) => {
      const node = element as HTMLElement
      return { width: node.clientWidth, height: node.clientHeight, scale: Number(node.dataset.cameraScale) }
    })
    const projection = createMainlineViewportProjection(measured, mode)
    expect(measured.scale).toBeCloseTo(projection.scale, 5)
    expect(projection.worldSize).toEqual({ width: 1280, height: 720 })
    const transform = await page.locator('.scene-mainline-world').evaluate((element) => getComputedStyle(element).transform)
    const scale = await page.evaluate((value) => {
      const matrix = new DOMMatrixReadOnly(value)
      return { x: matrix.a, y: matrix.d }
    }, transform)
    expect(scale.x).toBeCloseTo(projection.scale, 5)
    expect(scale.y).toBeCloseTo(projection.scale, 5)
  }
})

test.describe('portrait touch camera follow', () => {
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test('player and camera keep moving after the old tree interaction', async ({ page }) => {
  await page.goto('/?scene=jijia-ancestral-home&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  const state = async () => stage.evaluate(el => ({
    offsetX: Number((el as HTMLElement).dataset.cameraOffsetX),
    actorX: Number(document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')!.dataset.runtimeX),
  }))
  const initial = await state()
  await page.touchscreen.tap(380, 420)
  await expect(actor).toHaveClass(/is-moving/)
  await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15000 })
  const afterApproach = await state()
  expect(afterApproach.actorX).toBeGreaterThan(initial.actorX + 5)
  expect(Math.abs(afterApproach.offsetX - initial.offsetX)).toBeGreaterThan(5)
  const tree = page.locator('[data-object-id="jijia-old-tree"]')
  const treeBox = await tree.boundingBox()
  expect(treeBox).not.toBeNull()
  await page.touchscreen.tap(treeBox!.x + treeBox!.width / 2, treeBox!.y + treeBox!.height / 2)
  const echo = page.locator('[data-scene-echo="jijia-old-tree"]')
  await expect(echo).toBeVisible()
  const count = Number(await echo.getAttribute('data-scene-segment-count'))
  for (let i = 0; i < count; i++) {
    await expect(echo).toHaveAttribute('data-scene-segment-index', String(i))
    const shield = page.locator('[data-scene-dialogue-shield="true"]')
    if (await echo.getAttribute('data-scene-observation-typing') === 'true') {
      await shield.click()
      await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false')
    }
    if (i < count - 1) {
      await shield.click()
      await expect(echo).toHaveAttribute('data-scene-segment-index', String(i + 1))
    }
  }
  await expect(echo).toHaveAttribute('data-scene-segment-advance', 'complete')
  await page.locator('[data-scene-dialogue-shield="true"]').click()
  await expect(echo).toHaveCount(0)
  const before = await state()
  await page.touchscreen.tap(10, 420)
  await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15000 })
  const after = await state()
  expect(Math.abs(after.actorX - before.actorX)).toBeGreaterThan(1)
  expect(Math.abs(after.offsetX - before.offsetX)).toBeGreaterThan(1)
})
})


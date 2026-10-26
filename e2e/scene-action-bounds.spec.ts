import { expect, test } from '@playwright/test'

const viewports = [{ width: 1280, height: 800 }, { width: 411, height: 914 }, { width: 360, height: 550 }]
const edges = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const

async function expectActionAtSavedCameraAnchor(page: import('@playwright/test').Page, viewport: { width: number; height: number }, requireViewportFit = true) {
  const action = page.locator('[data-scene-action="fixture-two-long-options"]')
  const projection = await action.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const root = document.querySelector('.mainline-scene--map-only')!
    const world = document.querySelector('.scene-mainline-world')!
    const rootData = root as HTMLElement
    const worldData = world as HTMLElement
    const left = Number(element.getAttribute('data-scene-action-rendered-x'))
    const top = Number(element.getAttribute('data-scene-action-rendered-y'))
    const scale = Number(worldData.dataset.worldProjectionScale)
    const savedX = Number(rootData.dataset.fixtureSavedCameraX)
    const savedY = Number(rootData.dataset.fixtureSavedCameraY)
    const currentX = Number(rootData.dataset.fixtureRenderCameraX)
    const currentY = Number(rootData.dataset.fixtureRenderCameraY)
    const designWidth = Number(rootData.dataset.fixtureDesignWidth)
    const designHeight = Number(rootData.dataset.fixtureDesignHeight)
    return {
      rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2, width: rect.width, height: rect.height },
      renderedPosition: { x: left, y: top },
      expectedCenterX: innerWidth / 2 + (left + savedX - 50) / 100 * designWidth * scale,
      expectedCenterY: innerHeight / 2 + (top + savedY - 50) / 100 * designHeight * scale,
      scale,
      offsetDelta: { x: savedX - currentX, y: savedY - currentY },
    }
  })
  expect(Math.abs(projection.rect.centerX - projection.expectedCenterX)).toBeLessThanOrEqual(1)
  expect(Math.abs(projection.rect.centerY - projection.expectedCenterY)).toBeLessThanOrEqual(1)
  if (requireViewportFit) {
    expect(projection.rect.x).toBeGreaterThanOrEqual(-1)
    expect(projection.rect.y).toBeGreaterThanOrEqual(-1)
    expect(projection.rect.right).toBeLessThanOrEqual(viewport.width + 1)
    expect(projection.rect.bottom).toBeLessThanOrEqual(viewport.height + 1)
  }
  expect(projection.rect.width).toBeGreaterThan(0)
  expect(projection.rect.height).toBeGreaterThan(0)
  return projection
}

for (const viewport of viewports) {
  for (const edge of edges) {
    test(`two long options stay on their saved camera anchor at the ${edge} room edge (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/e2e/fixtures/scene-action-bounds.html')
      await page.locator(`[data-action-edge="${edge}"]`).click()
      await page.locator('[data-action-overflow]').click()
      const action = page.locator('[data-scene-action="fixture-two-long-options"]')
      await expect(action).toBeVisible()
      await expect(action.locator('[data-entry-id^="scene-action:fixture-two-long-options:"]')).toHaveCount(2)
      await expect(action).toHaveAttribute('data-scene-action-overflow-y', /^(true|false)$/)
      const box = await action.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const node = element as HTMLElement
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
          measuredHeight: Number(node.dataset.sceneActionMeasuredHeight), maxHeight: Number(node.dataset.sceneActionMaxHeight),
          renderedY: Number(node.dataset.sceneActionRenderedY), sourceY: Number(node.dataset.sceneActionPositionY),
          overflow: node.dataset.sceneActionOverflowY === 'true', scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }
      })
      await expectActionAtSavedCameraAnchor(page, viewport)
      expect(box.renderedY).not.toBe(box.sourceY)
      expect(box.measuredHeight).toBeGreaterThan(0)
      if (box.overflow) expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
    })
  }
}

test('camera changes during reading-exit handoff do not move the saved option group', async ({ page }) => {
  const viewport = { width: 411, height: 914 }
  await page.setViewportSize(viewport)
  await page.goto('/e2e/fixtures/scene-action-bounds.html')
  await page.locator('[data-action-overflow]').click()
  const initial = await expectActionAtSavedCameraAnchor(page, viewport)
  const action = page.locator('[data-scene-action="fixture-two-long-options"]')
  const initialRect = await action.boundingBox()
  await page.locator('[data-camera-handoff-mid]').click()
  const middle = await expectActionAtSavedCameraAnchor(page, viewport)
  await page.locator('[data-camera-handoff]').click()
  const final = await expectActionAtSavedCameraAnchor(page, viewport)
  const finalRect = await action.boundingBox()
  expect(middle.offsetDelta).not.toEqual({ x: 0, y: 0 })
  expect(final.offsetDelta).not.toEqual({ x: 0, y: 0 })
  expect(Math.abs((initialRect!.x + initialRect!.width / 2) - (finalRect!.x + finalRect!.width / 2))).toBeLessThanOrEqual(1)
  expect(Math.abs((initialRect!.y + initialRect!.height / 2) - (finalRect!.y + finalRect!.height / 2))).toBeLessThanOrEqual(1)
  expect(initial.scale).toBeGreaterThan(0)
})

test('resizing from design-sized desktop to phone repositions options inside the live viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/e2e/fixtures/scene-action-bounds.html')
  await page.locator('[data-action-edge="top-left"]').click()
  await page.locator('[data-action-overflow]').click()
  const desktop = await expectActionAtSavedCameraAnchor(page, { width: 1280, height: 800 })

  for (const viewport of [{ width: 411, height: 914 }, { width: 360, height: 550 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => {
      const box = await page.locator('[data-scene-action="fixture-two-long-options"]').boundingBox()
      return Boolean(box && box.x >= -1 && box.x + box.width <= viewport.width + 1)
    }).toBe(true)
    const projection = await expectActionAtSavedCameraAnchor(page, viewport)
    expect(projection.renderedPosition).not.toEqual(desktop.renderedPosition)
    expect(projection.offsetDelta).toEqual({ x: 0, y: 0 })
  }
})

test('zero saved and current camera offsets do not add a second translation', async ({ page }) => {
  const viewport = { width: 411, height: 914 }
  await page.setViewportSize(viewport)
  await page.goto('/e2e/fixtures/scene-action-bounds.html')
  await page.locator('[data-camera-zero]').click()
  const projection = await expectActionAtSavedCameraAnchor(page, viewport, false)
  expect(projection.offsetDelta).toEqual({ x: 0, y: 0 })
})

test('a touch release on the option panel does not walk the scene; overflow scroll reaches and activates the last option', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 550 })
  await page.goto('/e2e/fixtures/scene-action-bounds.html')
  await page.locator('[data-action-scroll-overflow]').click()
  const action = page.locator('[data-scene-action="fixture-two-long-options"]')
  await expect(action).toBeVisible()
  await expect(action).toHaveAttribute('data-scene-action-overflow-y', 'true')
  const measured = await action.evaluate(element => {
    const node = element as HTMLElement
    return { height: Number(node.dataset.sceneActionMeasuredHeight), maxHeight: Number(node.dataset.sceneActionMaxHeight) }
  })
  expect(measured.height).toBeGreaterThan(measured.maxHeight)
  await expect.poll(() => action.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await expect(action.locator('[data-entry-id^="scene-action:fixture-two-long-options:"]')).toHaveCount(10)

  const root = page.locator('.mainline-scene--map-only').first()
  await action.evaluate(element => element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true })))
  await expect(root).toHaveAttribute('data-fixture-walk-count', '0')

  const beforeScroll = await action.evaluate(element => element.scrollTop)
  const bodyScrollBefore = await page.evaluate(() => document.documentElement.scrollTop)
  const bounds = await action.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  await page.mouse.wheel(0, Math.max(200, bounds!.height))
  await expect.poll(() => action.evaluate(element => element.scrollTop)).toBeGreaterThan(beforeScroll)
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(bodyScrollBefore)

  await action.evaluate(element => { element.scrollTop = element.scrollHeight })
  const lastOption = action.locator('[data-scene-action-option-index="9"]')
  await lastOption.scrollIntoViewIfNeeded()
  await expect(lastOption).toBeInViewport()
  await lastOption.click()
  await expect(root).toHaveAttribute('data-fixture-choice-index', '9', { timeout: 3000 })
  await expect(root).toHaveAttribute('data-fixture-walk-count', '0')
  await expect(action).toHaveAttribute('data-scene-action-phase', 'exiting')
  await expect(action.locator('.scene-mainline-action-exit-frame .shared-entry-frame')).toBeVisible()
  await expect(action.locator('.scene-mainline-action-exit-frame .shared-entry-frame')).toHaveCSS('animation-name', 'scene-action-frame-retract')
  await expect(action).toHaveCount(1)
  await expect(action).toHaveCount(0, { timeout: 1500 })
  await expect(root).toHaveAttribute('data-fixture-choice-index', '9')
})

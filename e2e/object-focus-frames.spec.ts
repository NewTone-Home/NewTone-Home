import { expect, test, type Page, type TestInfo } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

async function expectObjectFocusLifecycle(page: Page, sceneId: string, entityId: string, screenshotName: string, testInfo: TestInfo) {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto(`/?scene=${sceneId}`)
  const object = page.locator(`[data-object-id="${entityId}"]`)
  const frame = object.locator('.scene-focus-frame')
  await expect(object).toBeVisible()
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('data-focus-frame-group', `interactive:${entityId}`)
  await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
  const frameBox = await frame.boundingBox()
  expect(frameBox?.width).toBeGreaterThan(8)
  expect(frameBox?.height).toBeGreaterThan(8)
  expect(await frame.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(240, 204, 123)')
  await page.screenshot({ path: testInfo.outputPath(screenshotName) })

  await object.click()
  const echo = page.locator(`[data-scene-echo="${entityId}"]`)
  await expect(echo).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1_000)
  // Reading owns world input until its current observation is complete. This
  // test intentionally completes that reading rather than trying to replace it
  // with a second object click, which is no longer a valid product flow.
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(echo).toHaveClass(/is-leaving/)
  await expect(frame).toHaveAttribute('data-focus-frame-phase', /retracting|collapsed/)
  await expect(echo).toHaveCount(0)
  await expect(frame).toHaveAttribute('data-focus-frame-phase', /appearing|visible/)
  expect(consoleErrors).toEqual([])
}

test('the approved object frames use the shared draw, retract, and resume lifecycle', async ({ page }, testInfo) => {
  await expectObjectFocusLifecycle(page, 'jijia-ancestral-home', 'jijia-old-tree', 'object-focus-tree.png', testInfo)
  await expectObjectFocusLifecycle(page, 'jijia-ancestral-interior', 'jijia-incense-burner', 'object-focus-incense.png', testInfo)
  await expectObjectFocusLifecycle(page, 'zhongshuyuan-office', 'zhongshuyuan-office-plant', 'object-focus-plant.png', testInfo)
})

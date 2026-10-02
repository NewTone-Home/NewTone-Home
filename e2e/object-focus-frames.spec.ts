import { expect, test, type Page, type TestInfo } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

async function expectObjectFocusLifecycle(page: Page, sceneId: string, entityId: string, sourceSelector: string, screenshotName: string, testInfo: TestInfo) {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto(`/?scene=${sceneId}`)
  const object = page.locator(sourceSelector).first()
  const frame = page.locator(`[data-focus-frame-group="interactive:${entityId}"]`)
  await expect(object).toBeVisible()
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('data-focus-frame-group', `interactive:${entityId}`)
  await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
  const frameBox = await frame.boundingBox()
  expect(frameBox?.width).toBeGreaterThan(8)
  expect(frameBox?.height).toBeGreaterThan(8)
  expect(await object.locator('.scene-focus-frame').count()).toBeLessThanOrEqual(1)
  expect(await frame.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(240, 204, 123)')
  await page.screenshot({ path: testInfo.outputPath(screenshotName) })

  await object.click()
  const echo = page.locator(`[data-scene-echo="${entityId}"]`)
  await expect(echo).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1_000)
  // Frame emphasis is visual-only: Reading no longer retracts or redraws the
  // source frame, and the independent host cannot enlarge the object button.
  await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
  await expect(frame).not.toHaveClass(/is-requested-retraction/)
  // The source content may become active, but the structural Frame itself
  // stays neutral and is darkened only by the world-level Reading dimmer.
  expect(await frame.evaluate((element) => getComputedStyle(element).opacity)).toBe('0.62')
  await expect(page.locator('.scene-dialogue-dimmer--observation')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath(`${screenshotName.replace('.png', '')}-reading.png`) })
  expect(consoleErrors).toEqual([])
}

test('the approved object frames stay visual-only throughout Reading', async ({ page }, testInfo) => {
  await expectObjectFocusLifecycle(page, 'jijia-ancestral-home', 'jijia-old-tree', '[data-object-id="jijia-old-tree"]', 'object-focus-tree.png', testInfo)
  await expectObjectFocusLifecycle(page, 'jijia-ancestral-interior', 'jijia-incense-burner', '[data-object-id="jijia-incense-burner"]', 'object-focus-incense.png', testInfo)
  await expectObjectFocusLifecycle(page, 'zhongshuyuan-office', 'zhongshuyuan-office-plant', '[data-object-id="zhongshuyuan-office-plant"]', 'object-focus-plant.png', testInfo)
  await expectObjectFocusLifecycle(page, 'jijia-ancestral-interior', 'jijia-portrait-top-1', '[data-focus-target-group="interactive:jijia-portrait-top-1"]', 'object-focus-portrait.png', testInfo)
})

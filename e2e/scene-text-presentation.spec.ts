import { expect, test, type Locator, type Page } from '@playwright/test'
import { mainlineScenes, type MainlineSceneId } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

async function expectFixedObservation(page: Page, sceneId: MainlineSceneId, target: Locator, screenshotName: string, testInfo: import('@playwright/test').TestInfo) {
  await page.goto(`/?scene=${sceneId}`)
  await expect(page.locator('.scene-feedback')).toHaveCount(0)
  await target.click()
  const text = page.locator('[data-scene-echo]')
  await expect(text).toBeVisible({ timeout: 15_000 })
  // The old tree keeps its established observation pool. Wait for the
  // typewriter to complete a meaningful line rather than pinning one pool item.
  await page.waitForTimeout(1_000)
  expect((await text.innerText()).length).toBeGreaterThan(8)
  await expect(text.locator('[data-scene-text-mode="observation"]')).toBeVisible()
  expect(await text.locator('.scene-focus-frame').count()).toBe(0)

  const policy = mainlineScenes[sceneId].presentation
  if (policy.mode !== 'fixed') throw new Error(`${sceneId} must use a fixed text policy`)
  // The existing scene camera may translate the whole world. The authored
  // anchor itself remains the stable contract, so inspect its world values.
  expect(await text.evaluate((element) => element.style.left)).toBe(`${policy.anchor.x}%`)
  expect(await text.evaluate((element) => element.style.top)).toBe(`${policy.anchor.y}%`)
  await page.screenshot({ path: testInfo.outputPath(screenshotName) })
}

test('fixed scenes use one authored no-frame observation area and no default map description', async ({ page }, testInfo) => {
  await expectFixedObservation(page, 'jijia-ancestral-home', page.locator('[data-object-id="jijia-old-tree"]'), 'text-fixed-yard.png', testInfo)
  await expectFixedObservation(page, 'jijia-ancestral-interior', page.locator('[data-object-id="jijia-offering-table-north"]'), 'text-fixed-interior.png', testInfo)
  await expectFixedObservation(page, 'zhongshuyuan-office', page.locator('[data-object-id="zhongshuyuan-office-desk"]'), 'text-fixed-office.png', testInfo)
})

test('Commercial Street observation uses the road-center reading rail without a frame', async ({ page }, testInfo) => {
  await page.goto('/?scene=commercial-street')
  await page.getByRole('button', { name: '花店', exact: true }).click()
  const text = page.locator('[data-scene-echo="commercial-north-slot-3"]')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  await expect(text).toBeVisible({ timeout: 15_000 })
  await expect(text.locator('[data-scene-text-mode="observation"]')).toBeVisible()
  await expect(text.locator('[data-scene-text-mode="observation"]')).toHaveText(/.{11,}/)
  expect(await text.locator('.scene-focus-frame').count()).toBe(0)
  const [stage, textBox, protagonistBox] = await Promise.all([
    page.locator('.mainline-scene-stage').boundingBox(),
    text.boundingBox(),
    protagonist.boundingBox(),
  ])
  expect(stage).not.toBeNull()
  expect(textBox).not.toBeNull()
  expect(protagonistBox).not.toBeNull()
  const policy = mainlineScenes['commercial-street'].presentation
  if (policy.mode !== 'actor-relative' || !policy.readingRail) throw new Error('Commercial Street must use a reading rail.')
  const textCenterY = (textBox!.y + textBox!.height / 2 - stage!.y) / stage!.height * 100
  expect(textCenterY).toBeGreaterThan(policy.readingRail.centerY - 3)
  expect(textCenterY).toBeLessThan(policy.readingRail.centerY + 3)
  expect(textBox!.x + textBox!.width / 2).toBeGreaterThan(protagonistBox!.x + protagonistBox!.width / 2)
  await page.screenshot({ path: testInfo.outputPath('text-relative-commercial-street.png') })
})

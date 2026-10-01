import { expect, test, type Locator, type Page } from '@playwright/test'
import { mainlineScenes, type MainlineSceneId } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

async function expectFixedObservation(page: Page, sceneId: MainlineSceneId, target: Locator, screenshotName: string, testInfo: import('@playwright/test').TestInfo) {
  await page.goto(`/?scene=${sceneId}`)
  await target.click()
  const text = page.locator('[data-scene-echo]')
  await expect(text).toBeVisible({ timeout: 15_000 })
  // The old tree keeps its established observation pool. Wait for the
  // typewriter to complete a meaningful line rather than pinning one pool item.
  await page.waitForTimeout(1_000)
  expect((await text.innerText()).length).toBeGreaterThan(0)
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

async function expectCommercialStreetAnchorSide(page: Page, label: string, entityId: string, expectedSide: 'left' | 'right') {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await page.getByRole('button', { name: label, exact: true }).click()
  const text = page.locator(`[data-scene-echo="${entityId}"]`)
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  // The eastern storefront deliberately exercises the full normal route from
  // the default street entry, which can exceed the short local-contact window.
  await expect(text).toBeVisible({ timeout: 30_000 })
  const [anchor, protagonistX] = await Promise.all([
    text.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left)),
    protagonist.getAttribute('data-runtime-x'),
  ])
  const policy = mainlineScenes['commercial-street'].presentation
  if (policy.mode !== 'actor-relative' || !policy.readingRail) throw new Error('Commercial Street must use a reading rail.')
  expect(await text.evaluate((element) => (element as HTMLElement).style.top)).toBe(`${policy.readingRail.centerY}%`)
  expect(Number.isFinite(anchor)).toBe(true)
  if (expectedSide === 'right') expect(anchor).toBeGreaterThan(Number(protagonistX))
  else expect(anchor).toBeLessThan(Number(protagonistX))
}

test('Commercial Street locks each Observation to the right rail until the east end needs a left fallback', async ({ page }) => {
  await expectCommercialStreetAnchorSide(page, '鞋店', 'commercial-south-slot-1', 'right')
  await expectCommercialStreetAnchorSide(page, '花店', 'commercial-north-slot-3', 'right')
  await expectCommercialStreetAnchorSide(page, '甜品店', 'commercial-north-slot-8', 'left')
})

test('scene text typography matches the layout contract at desktop, landscape, and compact portrait widths', async ({ page }) => {
  const cases = [
    { viewport: { width: 1280, height: 720 }, expectedPx: 17.28 },
    { viewport: { width: 720, height: 480 }, expectedPx: 16 },
    { viewport: { width: 600, height: 900 }, expectedPx: 12 },
    { viewport: { width: 390, height: 844 }, expectedPx: 12 },
  ] as const
  for (const { viewport, expectedPx } of cases) {
    await page.setViewportSize(viewport)
    await page.goto('/?scene=zhongshuyuan-office')
    await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
    const text = page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')
    await expect(text).toBeVisible({ timeout: 15_000 })
    const fontSize = await text.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(fontSize).toBeCloseTo(expectedPx, 1)
  }
})

test('an Observation completes into an unlocked Action that can be abandoned by a new world interaction', async ({ page }) => {
  await page.goto('/?scene=zhongshuyuan-office')
  const plant = page.locator('[data-object-id="zhongshuyuan-office-plant"]')
  const desk = page.locator('[data-object-id="zhongshuyuan-office-desk"]')
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  await plant.click()
  const plantEcho = page.locator('[data-scene-echo="zhongshuyuan-office-plant"]')
  await expect(plantEcho).toContainText('有段时间没浇水了', { timeout: 15_000 })
  await expect(shield).toBeVisible()

  // Reading owns the next world click: an underlying desk click cannot start
  // another interaction; because the sentence has finished typing, it instead
  // advances the current Observation into its Action.
  const deskBox = await desk.boundingBox()
  expect(deskBox).not.toBeNull()
  await page.mouse.click(deskBox!.x + deskBox!.width / 2, deskBox!.y + deskBox!.height / 2)
  const waterAction = page.getByRole('button', { name: '浇水', exact: true })
  for (let attempt = 0; attempt < 4 && await waterAction.count() === 0; attempt += 1) {
    await shield.click({ force: true })
    await page.waitForTimeout(180)
  }
  await expect(plantEcho).toHaveCount(0)
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toHaveCount(0)
  await expect(page.locator('[data-scene-action="zhongshuyuan-office-plant"]')).toBeVisible()
  await expect(waterAction).toBeEnabled({ timeout: 5_000 })

  // Actions are not Reading: the same desk click dismisses the unused action
  // and starts the new contact-and-observation flow.
  await page.mouse.click(deskBox!.x + deskBox!.width / 2, deskBox!.y + deskBox!.height / 2)
  await expect(page.locator('[data-scene-action="zhongshuyuan-office-plant"]')).toHaveCount(0)
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toBeVisible({ timeout: 15_000 })
})

async function completeObservationIntoAction(page: Page, target: Locator, entityId: string, option: string) {
  await target.click()
  const echo = page.locator(`[data-scene-echo="${entityId}"]`)
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(echo).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1_000)
  const action = page.getByRole('button', { name: option, exact: true })
  for (let attempt = 0; attempt < 5 && await action.count() === 0; attempt += 1) {
    await shield.click({ force: true })
    await page.waitForTimeout(180)
  }
  await expect(action).toBeEnabled({ timeout: 5_000 })
  return action
}

test('office actions persist real world state and never leave an empty Reading presentation', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=zhongshuyuan-office')
  const water = await completeObservationIntoAction(page, page.locator('[data-object-id="zhongshuyuan-office-plant"]'), 'zhongshuyuan-office-plant', '浇水')
  await water.click()
  await expect(page.locator('[data-scene-action="zhongshuyuan-office-plant"]')).toHaveCount(0)

  await page.locator('[data-object-id="zhongshuyuan-office-plant"]').click()
  const wetPlantEcho = page.locator('[data-scene-echo="zhongshuyuan-office-plant"]')
  await expect(wetPlantEcho).toContainText('花盆里的土还带着一点湿润的颜色', { timeout: 15_000 })
  // A natural punctuation split can yield more than one Observation segment.
  // Complete all of them through the full-scene Reading shield.
  for (let attempt = 0; attempt < 4 && await wetPlantEcho.count() > 0; attempt += 1) {
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await page.waitForTimeout(180)
  }
  await expect(wetPlantEcho).toHaveCount(0)

  const window = page.getByRole('button', { name: '窗户，点击让主角前往互动', exact: true })
  const toggle = await completeObservationIntoAction(page, window, 'zhongshuyuan-office-window', '拉上百叶窗')
  await toggle.click()
  await expect(page.locator('[data-scene-action="zhongshuyuan-office-window"]')).toHaveCount(0)
  await expect(page.locator('[data-scene-echo]')).toHaveCount(0)

  await window.click()
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-window"]')).toContainText('百叶窗已经拉上', { timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})

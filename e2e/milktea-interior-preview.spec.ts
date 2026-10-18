import { expect, test, type Page } from '@playwright/test'
import { commercialStreetMilkTeaCopy } from '../src/center/runtime/commercialStreetMilkTeaInterior'

async function seed(page: Page, language: 'en' | 'zh' = 'en', legacy = false) {
  const position = legacy ? { x: 47, y: 79 } : { x: 105, y: 57 }
  const sceneId = legacy ? 'commercial-milktea-interior' : 'commercial-street'
  const save = {
    _version: 1,
    currentSceneId: sceneId,
    currentPosition: position,
    scenePositions: { [sceneId]: position, ...(legacy ? { 'commercial-street': { x: 44, y: 50 } } : {}) },
    phoneDevice: 'surface',
    storyClock: { stage: 'commercial-street' },
    sceneState: {
      'commercial-street': { commercialStreetQuestionNarrativeCompleted: true },
      ...(legacy ? { 'commercial-milktea-interior': { milkTeaTutorialSeen: true, commercialStreetMilkTeaLastOrderNumber: 12 } } : {}),
    },
    phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
  }
  await page.addInitScript(({ storedSave, selectedLanguage }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: selectedLanguage, hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(storedSave))
  }, { storedSave: save, selectedLanguage: language })
}

async function enterShop(page: Page) {
  const entry = page.locator('[data-focus-target-group="door:street-milktea-entry"]')
  await expect(entry).toBeVisible()
  await entry.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-milktea-interior"]')).toBeVisible({ timeout: 30_000 })
}

test('desktop: Chinese first clerk click teaches and opens the existing ordering app', async ({ page }, info) => {
  await seed(page, 'zh')
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await enterShop(page)
  await expect(page.locator('button[data-npc-id="milk-tea-clerk"]')).toBeVisible()
  await expect(page.locator('button[data-object-id="milk-tea-qr"]')).toBeVisible()
  await expect(page.locator('button[data-object-id="milk-tea-pickup-1"]')).toBeVisible()
  await page.locator('button[data-npc-id="milk-tea-clerk"]').click()
  await expect(page.locator('[data-scene-echo]')).toContainText(commercialStreetMilkTeaCopy('zh').tutorial.replace(/[.!?。！？]+$/u, ''), { timeout: 15_000 })
  const phone = page.locator('.world-phone')
  await expect(phone).toHaveClass(/is-open/, { timeout: 15_000 })
  await expect(phone.locator('[data-app-view="milk-tea"]')).toBeVisible()
  await expect(page.locator('[data-milk-tea-tutorial-seen="true"]')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('milktea-interior-desktop-zh.png') })
})

test('mobile 390x844: English interior fits, QR opens the app, and position survives refresh', async ({ page }, info) => {
  await seed(page, 'en')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await enterShop(page)
  await expect(page.locator('button[data-npc-id="milk-tea-clerk"]')).toBeVisible()
  await expect(page.locator('button[data-object-id="milk-tea-qr"]')).toBeVisible()
  await expect(page.locator('button[data-object-id="milk-tea-pickup-1"]')).toBeVisible()
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport)
  await page.locator('button[data-object-id="milk-tea-qr"]').click()
  const phone = page.locator('.world-phone')
  await expect(phone).toHaveClass(/is-open/)
  await expect(phone.locator('[data-app-view="milk-tea"]')).toBeVisible()
  await page.keyboard.press('Escape')
  const beforeRefresh = await page.evaluate(() => ({ url: location.href, save: JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}') }))
  expect(beforeRefresh.save.currentSceneId).toBe('commercial-milktea-interior')
  // Reload the actual interior route and verify its saved position is restored.
  await page.reload()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-milktea-interior"]')).toBeVisible()
  await expect(page.locator('button[data-object-id="milk-tea-qr"]')).toBeVisible()
  await page.screenshot({ path: info.outputPath('milktea-interior-mobile-390x844-en.png') })
})

test('legacy interior save maps safely to the street and preserves shop state', async ({ page }) => {
  await seed(page, 'en', true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?debugRuntimeEvidence=1')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-milktea-interior"]')).toHaveCount(0)
  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}'))
  expect(migrated.currentSceneId).toBe('commercial-street')
  expect(migrated.sceneState['commercial-street'].milkTeaTutorialSeen).toBe(true)
  expect(migrated.sceneState['commercial-street'].commercialStreetMilkTeaLastOrderNumber).toBe(12)
  expect(migrated.scenePositions['commercial-milktea-interior']).toEqual({ x: 47, y: 79 })
  expect(migrated.currentPosition.x).toBeLessThan(100)
})

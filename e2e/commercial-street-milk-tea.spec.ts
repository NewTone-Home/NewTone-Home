import { expect, test } from '@playwright/test'
import { commercialStreetMilkTeaReadyAtKey } from '../src/center/runtime/commercialStreetMilkTea'

test.use({ viewport: { width: 1280, height: 720 } })

test('a first physical visit unlocks the Phone app, while ordering stays remote and pickup stays physical', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const store = page.getByRole('button', { name: '奶茶店', exact: true })
  await store.click()
  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible({ timeout: 30_000 })
  await expect(phone.getByText('远程点单', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-milk-tea-order-phase]')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-unlocked.png') })

  await phone.getByRole('button', { name: '黑糖珍珠奶茶', exact: true }).click()
  await phone.getByRole('button', { name: '正常', exact: true }).click()
  await phone.getByRole('button', { name: '少冰', exact: true }).click()
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(phone.getByText('取餐号 001', { exact: true })).toBeVisible()
  await expect(phone.getByText(/前方还有/)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('milk-tea-phone-pending.png') })

  await page.evaluate((readyAtKey) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected a persisted milk-tea order')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'][readyAtKey] = Date.now() - 1
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, commercialStreetMilkTeaReadyAtKey)
  await page.reload()

  await page.getByLabel('打开手机').click()
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.getByText('已完成', { exact: true })).toBeVisible()
  await expect(phone.getByText('请到商业街奶茶店取餐。', { exact: true })).toBeVisible()
  await expect(phone.getByRole('button', { name: /取餐|领取/ })).toHaveCount(0)
  await page.getByLabel('收起手机').click()

  await page.getByRole('button', { name: '奶茶店', exact: true }).click()
  await expect(page.locator('[data-scene-echo="commercial-south-slot-5"]')).toContainText('取到奶茶', { timeout: 15_000 })
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('milk-tea-picked-up.png') })
  await page.reload()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('the unlocked app remains usable for remote status checks in Café without creating a physical pickup', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe')
  await page.evaluate(() => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected a player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'] = {
      commercialStreetMilkTeaAppUnlocked: true,
      commercialStreetMilkTeaOrderNumber: 37,
      commercialStreetMilkTeaLastOrderNumber: 37,
      commercialStreetMilkTeaDrink: '原味奶茶',
      commercialStreetMilkTeaSugar: '少糖',
      commercialStreetMilkTeaIce: '去冰',
      commercialStreetMilkTeaCreatedAt: Date.now() - 5_000,
      commercialStreetMilkTeaReadyAt: Date.now() + 15_000,
      commercialStreetMilkTeaQueueAhead: 2,
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  })
  await page.reload()
  await page.getByLabel('打开手机').click()
  await page.locator('.world-phone [data-app="milk-tea"]').click()
  await expect(page.getByText('取餐号 037', { exact: true })).toBeVisible()
  await expect(page.getByText('制作中', { exact: true })).toBeVisible()
  await expect(page.getByText(/前方还有/)).toBeVisible()
  await expect(page.getByRole('button', { name: /取餐|领取/ })).toHaveCount(0)
})

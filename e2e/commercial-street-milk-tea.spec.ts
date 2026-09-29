import { expect, test } from '@playwright/test'
import { commercialStreetMilkTeaReadyAtKey } from '../src/center/runtime/commercialStreetMilkTea'

test.use({ viewport: { width: 1280, height: 720 } })

test('milk tea ordering persists preparation, then permits a direct pickup with a carried line icon', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const store = page.getByRole('button', { name: '奶茶店', exact: true })
  const order = page.locator('[data-milk-tea-order-phase]')
  await store.click()
  await expect(order).toHaveAttribute('data-milk-tea-order-phase', 'drink', { timeout: 15_000 })
  await expect(order).toContainText('选择一杯奶茶。')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-drink-selection.png') })

  await order.getByRole('button', { name: '黑糖珍珠奶茶', exact: true }).click()
  await expect(order).toHaveAttribute('data-milk-tea-order-phase', 'preferences')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-preferences.png') })
  await order.getByRole('button', { name: '正常', exact: true }).click()
  await order.getByRole('button', { name: '少冰', exact: true }).click()
  await order.getByRole('button', { name: '确认下单', exact: true }).click()
  await expect(order).toHaveAttribute('data-milk-tea-order-phase', 'receipt')
  await expect(order).toContainText('取餐号 001')
  await page.screenshot({ path: testInfo.outputPath('milk-tea-receipt.png') })
  await order.getByRole('button', { name: '知道了', exact: true }).click()
  await expect(order).toBeHidden()

  await store.click()
  const preparingEcho = page.locator('[data-scene-echo="commercial-south-slot-5"]')
  await expect(preparingEcho).toContainText('还在制作')
  await preparingEcho.click()
  await expect(preparingEcho).toContainText('取餐号 001')

  await page.evaluate((readyAtKey) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected a persisted milk-tea order')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'][readyAtKey] = Date.now() - 1
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, commercialStreetMilkTeaReadyAtKey)
  await page.reload()

  await page.getByRole('button', { name: '奶茶店', exact: true }).click()
  await expect(page.locator('[data-scene-echo="commercial-south-slot-5"]')).toContainText('取到奶茶', { timeout: 15_000 })
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('milk-tea-picked-up.png') })
  await page.waitForTimeout(320)
  await page.getByRole('button', { name: '奶茶店', exact: true }).click()
  await expect(page.locator('[data-scene-echo="commercial-south-slot-5"]')).toContainText('手里已经有一杯饮料')
  await expect(order).toBeHidden()
  await page.reload()
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible()
  expect(consoleErrors).toEqual([])
})

import { expect, test, type Page } from '@playwright/test'
import { mainlineSceneRoomAtPosition } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

async function startYongheSyntheticScene(page: Page) {
  const scene = mainlineScenes['yonghe-eatery']
  const room = scene.rooms.find(candidate => candidate.id === 'mining-shop-2-interior')
  const startPosition = scene.objects.find(object => object.id === 'yonghe-upper-left-group-table')?.approach
  if (!room || !startPosition || mainlineSceneRoomAtPosition(scene, startPosition)?.id !== room.id) {
    throw new Error('Synthetic Yonghe start must be inside the existing shop interior room.')
  }
  await page.addInitScript(({ startPosition }) => {
    sessionStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    sessionStorage.setItem('newtone-e2e-shop-orders-synthetic-save-v1', '1')
    sessionStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2,
      currentSceneId: 'yonghe-eatery',
      currentPosition: startPosition,
      scenePositions: { 'yonghe-eatery': startPosition },
      phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
      gameTimeMs: 36_000_000,
      shopOrders: {},
      heldConsumable: null,
      sceneState: {},
      phoneNotifications: [],
      phoneNotes: [],
      phoneContactNotes: {},
      phoneCallHistory: [],
      updatedAt: 0,
    }))
  }, { startPosition })
  await page.goto('/?scene=yonghe-eatery&e2eShopOrders=1&debugRuntimeEvidence=1')
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('.mainline-scene[data-mainline-scene="yonghe-eatery"]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.currentSceneId
  })).toBe('yonghe-eatery')
}

async function finishEchoAndShowChoices(page: Page) {
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  const echo = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  const options = page.locator('[data-scene-action-option-index]')
  if (!(await options.first().isVisible().catch(() => false))) {
    await expect(shield).toBeVisible()
    await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15_000 })
    for (let attempt = 0; attempt < 4 && !(await options.first().isVisible().catch(() => false)); attempt += 1) {
      if (await shield.isVisible().catch(() => false)) await shield.click({ force: true })
      await page.waitForTimeout(700)
    }
  }
  await expect(options.first()).toBeVisible({ timeout: 15_000 })
  await expect(options.first()).toBeEnabled()
}

async function chooseAction(page: Page, label: string) {
  const option = page.getByRole('button', { name: label, exact: true })
  await expect(option).toBeVisible()
  await expect(option).toBeEnabled()
  await option.click()
}
test('Yonghe worker opens authored scene choices and the business conversation', async ({ page }) => {
  test.setTimeout(90_000)
  await startYongheSyntheticScene(page)
  const worker = page.locator('[data-npc-id="yonghe-trial-worker"]')
  await expect(worker).toContainText('店员')
  await worker.click()
  const opening = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(opening).toContainText('吃点什么', { timeout: 20_000 })
  await finishEchoAndShowChoices(page)
  await expect(page.getByRole('button', { name: '点餐', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '有什么推荐吗', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '聊聊', exact: true })).toBeVisible()
  await chooseAction(page, '聊聊')
  await expect(page.getByRole('button', { name: '你们平常都这么忙吗？', exact: true })).toBeVisible()
  await chooseAction(page, '你们平常都这么忙吗？')
  const dialogue = page.locator('[data-scene-dialogue="yonghe-trial-worker"]')
  await expect(dialogue).toContainText('你们平常都这么忙吗')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toContainText('对啊，平常都这么忙')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toHaveCount(0, { timeout: 10_000 })
  await expect(opening).toHaveCount(0)
  await worker.click()
  await expect(opening).toContainText('\u5403\u70b9\u4ec0\u4e48', { timeout: 20_000 })
  await finishEchoAndShowChoices(page)
  await chooseAction(page, '\u804a\u804a')
  await chooseAction(page, '\u540e\u9762\u90a3\u4e2a\u95e8\u662f\u901a\u5411\u54ea\u513f\uff1f')
  await expect(dialogue).toContainText('\u540e\u9762\u90a3\u4e2a\u95e8\u662f\u901a\u5411\u54ea\u513f')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toContainText('\u540e\u9762\u662f\u540e\u5df7')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toContainText('\u987a\u7740\u8d70\u4e5f\u80fd\u51fa\u53bb')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders)).toEqual({})
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})

test('Yonghe menu, shared order, one-time readiness, pickup, and eating use existing state', async ({ page }) => {
  test.setTimeout(90_000)
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()) })
  await startYongheSyntheticScene(page)
  const menu = page.getByRole('button', { name: /菜单/ }).first()
  await expect(menu).toBeVisible()
  await menu.click()
  const menuEcho = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(menuEcho).toContainText('鲜肉馄饨 12元', { timeout: 20_000 })
  await expect(menuEcho).toContainText('肉末拌面 11元')
  await expect(menuEcho).toContainText('蛋炒饭 10元')
  await expect(menuEcho).toContainText('青菜肉片盖饭 14元')
  await finishEchoAndShowChoices(page)
  await chooseAction(page, '肉末拌面 11元')
  const orderPage = page.locator('.shop-order-app[data-shop-id="yonghe-eatery"]')
  await expect(orderPage).toBeVisible({ timeout: 15_000 })
  await expect(orderPage.locator('[data-shop-product-id="yonghe-minced-pork-noodles"]')).toHaveAttribute('aria-pressed', 'true')
  await orderPage.getByRole('button', { name: '确认下单' }).click()
  const successCue = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(successCue).toContainText('行，你找个地方坐会儿吧', { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders?.['yonghe-eatery']?.productId)).toBe('yonghe-minced-pork-noodles')
  await expect(successCue).toHaveAttribute('data-scene-observation-typing', 'false')
  const successText = '行，你找个地方坐会儿吧'
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let attempt = 0; attempt < 4 && (await successCue.count()) > 0 && (await successCue.innerText()).includes(successText); attempt += 1) {
    if (await shield.isVisible().catch(() => false)) await shield.click({ force: true })
    await page.waitForTimeout(700)
  }
  await expect(successCue).not.toContainText(successText, { timeout: 5_000 })
  const readyCue = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(readyCue).toContainText('肉末拌面好了', { timeout: 10_000 })
  await page.waitForTimeout(750)
  await expect(readyCue).toHaveCount(1)
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toHaveCount(0, { timeout: 10_000 })
  await expect(page.locator('[data-object-id="yonghe-counter"]')).toBeVisible()
  await page.locator('[data-object-id="yonghe-counter"]').click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable?.productId)).toBe('yonghe-minced-pork-noodles')
  await expect(page.locator('[data-held-consumable-kind="meal"]')).toBeVisible()
  await expect(page.locator('[data-held-consumable-kind="meal"]')).not.toContainText('拿好')
  await page.locator('[data-held-consumable-kind="meal"]').click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
  expect(runtimeErrors).toEqual([])
  await page.screenshot({ path: 'test-results/yonghe-interaction-scene.png', fullPage: true })
})
test('Yonghe worker opens the authored backdoor conversation', async ({ page }) => {
  await startYongheSyntheticScene(page)
  await page.locator('[data-npc-id="yonghe-trial-worker"]').click()
  const opening = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(opening).toContainText('\u5403\u70b9\u4ec0\u4e48', { timeout: 20_000 })
  await finishEchoAndShowChoices(page)
  await chooseAction(page, '\u804a\u804a')
  await chooseAction(page, '\u540e\u9762\u90a3\u4e2a\u95e8\u662f\u901a\u5411\u54ea\u513f\uff1f')
  const dialogue = page.locator('[data-scene-dialogue="yonghe-trial-worker"]')
  await expect(dialogue).toContainText('\u540e\u9762\u90a3\u4e2a\u95e8\u662f\u901a\u5411\u54ea\u513f')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toContainText('\u540e\u9762\u662f\u540e\u5df7')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(dialogue).toContainText('\u987a\u7740\u8d70\u4e5f\u80fd\u51fa\u53bb')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders)).toEqual({})
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})

test('Walking away from Yonghe worker choices does not create an order', async ({ page }) => {
  await startYongheSyntheticScene(page)
  await page.locator('[data-npc-id="yonghe-trial-worker"]').click()
  await expect(page.locator('[data-scene-echo="yonghe-trial-worker"]')).toContainText('\u5403\u70b9\u4ec0\u4e48', { timeout: 20_000 })
  await finishEchoAndShowChoices(page)
  await page.locator('.mainline-scene').click({ position: { x: 900, y: 500 } })
  await expect(page.locator('[data-scene-action-option-index]')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders)).toEqual({})
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})
test('Recommendation asks meal type then shows filtered menu with full-menu return', async ({ page }) => {
  await startYongheSyntheticScene(page)
  await page.locator('[data-npc-id="yonghe-trial-worker"]').click()
  const prompt = page.locator('[data-scene-echo="yonghe-trial-worker"]')
  await expect(prompt).toContainText('\u5403\u70b9\u4ec0\u4e48', { timeout: 20_000 })
  await finishEchoAndShowChoices(page)
  await chooseAction(page, '\u6709\u4ec0\u4e48\u63a8\u8350\u5417')
  await expect(prompt).toContainText('\u4f60\u60f3\u5403\u9762\u8fd8\u662f\u5403\u996d')
  await finishEchoAndShowChoices(page)
  await chooseAction(page, '\u9762')
  await expect(prompt).toContainText('\u8089\u672b\u62cc\u9762 11\u5143')
  await finishEchoAndShowChoices(page)
  await expect(page.getByRole('button', { name: '\u5168\u90e8\u83dc\u54c1', exact: true })).toBeVisible()
  await chooseAction(page, '\u5168\u90e8\u83dc\u54c1')
  await expect(prompt).toContainText('\u9c9c\u8089\u9984\u9968 12\u5143')
  await expect(prompt).toContainText('\u9752\u83dc\u8089\u7247\u76d6\u996d 14\u5143')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders)).toEqual({})
})

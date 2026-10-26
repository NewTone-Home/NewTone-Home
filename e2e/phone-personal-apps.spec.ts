import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test } from '@playwright/test'

test('Notes persist and the contact flow supports details, location cards, and a manually ended call', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('newtone-public-release-cutover-v1')) localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    if (!localStorage.getItem('newtone-player-save-v1')) localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-cafe',
      currentPosition: null,
      scenePositions: {},
      phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'cafe' },
      sceneState: { 'commercial-cafe': { commercialCafeStoryStatus: 'complete' } },
      phoneNotifications: [],
      updatedAt: 100,
    }))
  })
  await page.goto('/?scene=commercial-cafe')
  const phone = page.locator('.world-phone')
  await page.getByRole('button', { name: '打开手机' }).click()

  await phone.locator('.world-phone__pin-candidates button').click()
  await expect(phone.locator('.world-phone__pin-candidates button')).toHaveAttribute('aria-pressed', 'true')
  await phone.locator('.world-phone__memo-open').click()
  const lead = phone.locator('.world-phone__note[data-note-kind="story"]').filter({ hasText: '永和线索' })
  await expect(lead).toBeVisible()
  await page.screenshot({ path: 'test-results/phone-notes-list.png' })
  await phone.getByRole('button', { name: '新增备忘' }).click()
  await page.screenshot({ path: 'test-results/phone-notes-compose.png' })
  await phone.getByLabel('新备忘标题').fill('问老周')
  await phone.getByLabel('新备忘内容').fill('确认下一步去哪里。')
  await phone.getByRole('button', { name: '保存备忘' }).click()
  const createdNote = phone.locator('.world-phone__note[data-note-kind="player"]')
  await expect(createdNote).toBeVisible()
  await createdNote.getByRole('button').click()
  await phone.getByLabel('新备忘内容').fill('编辑后仍然持久化。')
  await phone.getByRole('button', { name: '保存备忘' }).click()
  await expect(createdNote).toContainText('编辑后仍然持久化。')
  await phone.locator('.world-phone__home-indicator').click()
  await expect(phone.getByLabel('备忘录')).toContainText('问老周')
  await expect(phone.getByLabel('备忘录')).toContainText('永和线索')

  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toBeVisible()
  await phone.getByLabel('联系人备注').fill('咖啡馆认识的联系人')
  await phone.getByLabel('联系人备注').blur()
  await phone.getByRole('button', { name: '信息' }).click()
  const thread = phone.getByRole('region', { name: '与老周的短信' })
  await expect(thread.locator('.world-phone__message-bubble').first()).toHaveText('陈副部长失踪了。')
  const location = thread.locator('.world-phone__message-place')
  await expect(location).toBeVisible()
  const messageBubble = location.locator('.world-phone__message-bubble--place')
  await expect(messageBubble).toHaveText('\u6c38\u548c\u5c0f\u9986')
  await messageBubble.hover()
  const placeCard = location.locator('.world-phone__place-card')
  await expect(placeCard).toBeVisible()
  const miniMap = placeCard.locator('[data-yonghe-map-preview]')
  await expect(miniMap.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  const desktopAlignment = await messageBubble.evaluate((bubble) => {
    const bubbleRect = bubble.getBoundingClientRect()
    const cardRect = bubble.parentElement!.querySelector('.world-phone__place-card')!.getBoundingClientRect()
    return { right: cardRect.left >= bubbleRect.right - 1, aligned: Math.abs((cardRect.top + cardRect.height / 2) - (bubbleRect.top + bubbleRect.height / 2)) < 12 }
  })
  expect(desktopAlignment).toEqual({ right: true, aligned: true })
  await expect(location.locator('[data-yonghe-card-preview]')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await expect(placeCard).toBeHidden()

  await page.setViewportSize({ width: 1280, height: 900 })
  await messageBubble.hover()
  await expect(placeCard).toBeVisible()
  const cardBeforeHover = await placeCard.boundingBox()
  await placeCard.hover()
  await expect.poll(async () => (await placeCard.boundingBox())!.width).toBeGreaterThan(cardBeforeHover!.width)
  const sourceRect = await placeCard.boundingBox()
  await placeCard.click()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
  const handoffMap = phone.locator('[data-yonghe-handoff-map]')
  await expect(handoffMap).toBeVisible()
  const sourceStart = await handoffMap.boundingBox()
  expect(Math.abs(sourceStart!.x - sourceRect!.x)).toBeLessThan(20)
  expect(Math.abs(sourceStart!.y - sourceRect!.y)).toBeLessThan(20)
  await expect(phone.locator('.world-phone__app-view[data-app-view="map"]')).toHaveCSS('opacity', '0')
  await page.waitForTimeout(120)
  const sourceMid = await handoffMap.boundingBox()
  expect(sourceMid!.width).toBeGreaterThan(sourceStart!.width)
  expect(sourceMid!.height).toBeGreaterThan(sourceStart!.height)
  const transitionTarget = await phone.locator('.world-phone__app-view[data-app-view="map"] .world-phone__map-viewport').boundingBox()
  await page.mouse.click(transitionTarget!.x + transitionTarget!.width / 2, transitionTarget!.y + transitionTarget!.height / 2)
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
  await expect(handoffMap).toHaveCount(0)
  const map = phone.locator('[data-map-world="inner"]')
  await expect(map).toBeVisible()
  await expect(map).toHaveAttribute('data-map-zoom', '1.650')
  await expect(phone.locator('[data-map-region="mine"]')).toHaveCount(0)
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toHaveAttribute('data-map-poi-region', 'mine')
  await expect(phone.locator('.world-phone__detail-heading strong')).toBeVisible()

  await phone.getByRole('button', { name: '缩小地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.320')
  await phone.getByRole('button', { name: '缩小地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.056')
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toHaveCount(0)
  await phone.getByRole('button', { name: '放大地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.320')
  await phone.locator('.world-phone__map-viewport').hover()
  await page.mouse.wheel(0, -100)
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(1.6)
  await page.mouse.wheel(0, 100)
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeCloseTo(1.32, 2)

  const viewport = phone.locator('.world-phone__map-viewport')
  const viewportBox = await viewport.boundingBox()
  expect(viewportBox).not.toBeNull()
  const startTransform = await map.getAttribute('style')
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 4)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2 + 45, viewportBox!.y + viewportBox!.height / 4 + 30)
  await page.mouse.up()
  await expect.poll(() => map.getAttribute('style')).not.toBe(startTransform)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const centerX = viewportBox!.x + viewportBox!.width / 2
  const centerY = viewportBox!.y + viewportBox!.height / 4
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: centerX - 24, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: centerX - 24, y: centerY }, { id: 2, x: centerX + 24, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: centerX - 42, y: centerY }, { id: 2, x: centerX + 42, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(2)
  await cdp.detach()

  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByLabel('联系人备注')).toHaveValue('咖啡馆认识的联系人')
  await phone.getByRole('button', { name: '电话' }).click()
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await page.waitForTimeout(3500)
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await expect(phone.getByText(/响铃中/)).toBeVisible()
  await phone.getByRole('button', { name: '挂断' }).click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toContainText('已挂断')

  await page.reload()
  await page.getByRole('button', { name: '打开手机' }).click()
  await expect(phone.locator('.world-phone__pin-candidates button')).toHaveAttribute('aria-pressed','true')
  await phone.locator('.world-phone__memo-open').click()
  await expect(phone.locator('.world-phone__note[data-note-kind="player"]')).toContainText('编辑后仍然持久化。')
  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByLabel('联系人备注')).toHaveValue('咖啡馆认识的联系人')
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toContainText('已挂断')
})

for (const width of [411, 360]) {
  test(`Yonghe location card supports touch tap and restores the message on close at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 914 }, hasTouch: true, isMobile: true })
    await context.route('**/phone-v1-validation.invalid/**', route => route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: route.request().method() === 'GET' ? '[]' : '',
    }))
    const page = await context.newPage()
    await page.addInitScript(() => {
      localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
      localStorage.setItem('newtone-player-save-v1', JSON.stringify({
        _version: 1,
        currentSceneId: 'commercial-cafe',
        currentPosition: null,
        scenePositions: {},
        phoneDevice: 'inner',
        storyClock: { dayId: 'story-day-001', stage: 'cafe' },
        sceneState: { 'commercial-cafe': { commercialCafeStoryStatus: 'complete' } },
        phoneNotifications: [],
        updatedAt: 100,
      }))
    })
    await page.goto('/?scene=commercial-cafe')
    const phone = page.locator('.world-phone')
    await phone.locator('.world-phone__handle').tap()
    await phone.locator('[data-app="contacts"]').tap()
    await phone.locator('.world-phone__contact-row').tap()
    await phone.getByRole('button', { name: '\u4fe1\u606f' }).tap()
    const bubble = phone.locator('.world-phone__message-bubble--place')
    const card = phone.locator('.world-phone__place-card')
    await expect(bubble).toBeVisible()
    const bubbleBefore = await bubble.boundingBox()

    await bubble.tap()
    await expect(card).toBeVisible()
    await expect(card.locator('.world-phone__place-card-map-link')).toHaveCount(0)
    await expect(card.locator('[data-yonghe-map-preview]')).toBeVisible()
    const bubbleAfter = await bubble.boundingBox()
    expect(bubbleAfter).toEqual(bubbleBefore)
    const fitsPhone = await card.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const content = element.closest('.world-phone__app-content')!.getBoundingClientRect()
      return rect.left >= content.left && rect.right <= content.right && rect.top >= content.top && rect.bottom <= content.bottom
    })
    expect(fitsPhone).toBe(true)
    await card.locator('.world-phone__place-card-close').tap()
    await expect(card).toBeHidden()
    await expect(bubble).toHaveAttribute('aria-expanded', 'false')
    await expect(phone.locator('.world-phone__app-view[data-app-view="map"]')).toHaveCount(0)

    await bubble.tap()
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('aria-hidden', 'false')
    await card.tap()
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
    await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
    await context.close()
  })
}

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

  await phone.locator('.world-phone__apps [data-app="notes"]').click()
  const lead = phone.locator('.world-phone__note[data-note-kind="story"]').filter({ hasText: '永和线索' })
  await expect(lead).toBeVisible()
  await lead.getByRole('button', { name: '置顶' }).click()
  await expect(lead.getByRole('button', { name: '已置顶' })).toHaveAttribute('aria-pressed', 'true')
  await phone.getByLabel('新备忘标题').fill('问老周')
  await phone.getByLabel('新备忘内容').fill('确认下一步去哪里。')
  await phone.getByRole('button', { name: '保存备忘' }).click()
  const createdNote = phone.locator('.world-phone__note[data-note-kind="player"]')
  await expect(createdNote).toBeVisible()
  await phone.locator('.world-phone__home-indicator').click()
  await expect(phone.getByLabel('备忘录')).toContainText('问老周')
  await expect(phone.getByLabel('备忘录')).toContainText('永和线索')

  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toBeVisible()
  await phone.getByLabel('我的联系人备注').fill('咖啡馆认识的联系人')
  await phone.getByLabel('我的联系人备注').blur()
  await phone.getByRole('button', { name: '信息' }).click()
  const thread = phone.getByRole('region', { name: '与老周的短信' })
  await expect(thread.locator('.world-phone__message-bubble').first()).toHaveText('陈副部长失踪了。')
  const location = thread.locator('.world-phone__message-place')
  await expect(location).toBeVisible()
  await location.locator('.world-phone__place-reveal').click()
  const placeCard = location.getByRole('button', { name: /永和小馆/ })
  await expect(placeCard).toBeVisible()
  await placeCard.click()
  await expect(phone.locator('[data-map-world="inner"]')).toBeVisible()
  await expect(phone.getByText('永和小馆', { exact: true })).toBeVisible()

  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByLabel('我的联系人备注')).toHaveValue('咖啡馆认识的联系人')
  await phone.getByRole('button', { name: '电话' }).click()
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await page.waitForTimeout(3500)
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await expect(phone.getByText(/响铃中/)).toBeVisible()
  await phone.getByRole('button', { name: '挂断' }).click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toContainText('已挂断')

  await page.reload()
  await page.getByRole('button', { name: '打开手机' }).click()
  await page.locator('.world-phone__apps [data-app="notes"]').click()
  await expect(phone.locator('.world-phone__note[data-note-kind="player"]')).toBeVisible()
})

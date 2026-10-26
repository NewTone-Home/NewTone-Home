import { registerPhoneTestNetwork } from './phoneTestNetwork'
import { expect, test } from '@playwright/test'

registerPhoneTestNetwork()

test('Yonghe mini map expands continuously into the selected map at desktop and phone widths', async ({ page }) => {
  test.setTimeout(90_000)
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
  await page.getByRole('button', { name: '打开手机' }).click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await phone.getByRole('button', { name: '信息' }).click()
  const messageBubble = phone.locator('.world-phone__message-bubble--place')

  for (const width of [1280, 411, 360]) {
    await page.setViewportSize({ width, height: 914 })
    await messageBubble.click()
    const card = phone.locator('.world-phone__place-card')
    const miniMap = card.locator('[data-yonghe-map-preview]')
    await expect(miniMap.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
    await expect.poll(async () => (await miniMap.boundingBox()) !== null).toBe(true)
    const source = await miniMap.boundingBox()
    expect(source).not.toBeNull()

    await card.getByRole('button', { name: '在地图中查看永和小馆' }).click()
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
    await expect(phone.locator('.world-phone__body')).toHaveAttribute('inert', '')
    const overlay = phone.locator('[data-yonghe-handoff-map]')
    await expect(overlay).toBeVisible()
    const start = await overlay.boundingBox()
    expect(Math.abs(start!.x - source!.x)).toBeLessThan(20)
    expect(Math.abs(start!.y - source!.y)).toBeLessThan(20)

    const mapView = phone.locator('.world-phone__app-view[data-app-view="map"]')
    await expect(mapView).toHaveCSS('opacity', '0')
    await page.waitForTimeout(110)
    const middle = await overlay.boundingBox()
    expect(middle!.width).toBeGreaterThan(start!.width)
    expect(middle!.height).toBeGreaterThan(start!.height)
    const target = await mapView.locator('.world-phone__map-viewport').boundingBox()
    const targetDistanceAtStart = Math.abs(start!.x - target!.x) + Math.abs(start!.y - target!.y)
    const targetDistanceAtMiddle = Math.abs(middle!.x - target!.x) + Math.abs(middle!.y - target!.y)
    expect(targetDistanceAtMiddle).toBeLessThan(targetDistanceAtStart)
    const zoomBeforeBackgroundClick = await mapView.locator('.world-phone__map').getAttribute('data-map-zoom')
    await page.mouse.click(target!.x + target!.width / 2, target!.y + target!.height / 2)
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
    await expect(mapView.locator('.world-phone__map')).toHaveAttribute('data-map-zoom', zoomBeforeBackgroundClick!)

    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
    await expect(phone.locator('.world-phone__body')).not.toHaveAttribute('inert', '')
    await expect(overlay).toHaveCount(0)
    const map = phone.locator('[data-map-world="inner"]')
    await expect(map).toBeVisible()
    await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()

    if (width !== 360) {
      await phone.locator('.world-phone__home-indicator').click()
      await expect(phone.locator('.world-phone__home-screen')).toBeVisible()
      await phone.locator('[data-app="contacts"]').click()
      await phone.locator('.world-phone__contact-row').click()
      await phone.getByRole('button', { name: '信息' }).click()
    }
  }
})

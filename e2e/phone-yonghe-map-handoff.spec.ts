import { registerPhoneTestNetwork } from './phoneTestNetwork'
import { expect, test } from '@playwright/test'

test.use({ reducedMotion: 'no-preference' })

async function openYongheCard(page: import('@playwright/test').Page) {
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
  await phone.locator('.world-phone__handle').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await phone.getByRole('button', { name: '\u4fe1\u606f' }).click()
  await phone.locator('.world-phone__message-bubble--place').click()
  return phone
}

registerPhoneTestNetwork()

test('Yonghe mini map expands continuously into the selected map after desktop hover', async ({ page }) => {
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

  await page.setViewportSize({ width: 1280, height: 900 })
  await messageBubble.hover()
  const card = phone.locator('.world-phone__place-card')
  await expect(card).toBeVisible()
    const miniMap = card.locator('[data-yonghe-map-preview]')
    await expect(miniMap.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
    await expect.poll(async () => (await miniMap.boundingBox()) !== null).toBe(true)
    const cardBeforeHover = await card.boundingBox()
    await card.hover()
    await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(cardBeforeHover!.width)
    await card.evaluate(async element => {
      const animations: Animation[] = []
      let current: Element | null = element
      while (current) { animations.push(...current.getAnimations()); current = current.parentElement }
      await Promise.all(animations.filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)))
    })
    const source = await card.boundingBox()
    expect(source).not.toBeNull()

    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('[data-yonghe-map-card]')
      if (!card) throw new Error('Expected visible Yonghe card before handoff')
      card.addEventListener('click', () => {
        const rect = card.getBoundingClientRect()
        ;(window as any).__yongheHandoffFrames = []
        ;(window as any).__yongheCardRectAtClick = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        let frameCount = 0
        const sample = () => {
          const clone = document.querySelector<HTMLElement>('[data-yonghe-handoff-map]')
          if (clone) {
            const box = clone.getBoundingClientRect()
            ;(window as any).__yongheHandoffFrames.push({ time: performance.now(), x: box.x, y: box.y, width: box.width, height: box.height })
          }
          frameCount += 1
          if (frameCount < 80) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      }, { capture: true, once: true })
    })

    await card.click()
    await expect.poll(async () => await phone.getAttribute('data-yonghe-map-handoff') !== 'idle').toBe(true)
    const overlay = phone.locator('[data-yonghe-handoff-map]')
    const mapView = phone.locator('.world-phone__app-view[data-app-view="map"]')
    if (await phone.getAttribute('data-yonghe-map-handoff') === 'opening') {
      await expect(overlay).toBeVisible()
    }
    const zoomBeforeBackgroundClick = await mapView.locator('.world-phone__map').getAttribute('data-map-zoom')
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
    const frames = await page.evaluate(() => (window as any).__yongheHandoffFrames as Array<{x:number;y:number;width:number;height:number}>)
    const sourceAtClick = await page.evaluate(() => (window as any).__yongheCardRectAtClick as {x:number;y:number;width:number;height:number})
    expect(frames.length).toBeGreaterThan(2)
    expect(Math.abs(frames[0]!.x - sourceAtClick.x)).toBeLessThan(1)
    expect(Math.abs(frames[0]!.y - sourceAtClick.y)).toBeLessThan(1)
    expect(Math.abs(frames[0]!.width - sourceAtClick.width)).toBeLessThan(1)
    expect(Math.abs(frames[0]!.height - sourceAtClick.height)).toBeLessThan(1)
    const middle = frames[Math.floor(frames.length / 2)]!
    expect(middle.width).toBeGreaterThan(frames[0]!.width)
    expect(middle.height).toBeGreaterThan(frames[0]!.height)
    expect(await mapView.locator('.world-phone__map').getAttribute('data-map-zoom')).toBe(zoomBeforeBackgroundClick)
    const target = await mapView.locator('.world-phone__map-viewport').boundingBox()
    const firstDistance = Math.abs(frames[0]!.x - target!.x) + Math.abs(frames[0]!.y - target!.y)
    const midDistance = Math.abs(middle.x - target!.x) + Math.abs(middle.y - target!.y)
    expect(midDistance).toBeLessThan(firstDistance)
    await expect(phone.locator('.world-phone__body')).not.toHaveAttribute('inert', '')
    await expect(overlay).toHaveCount(0)
    const map = phone.locator('[data-map-world="inner"]')
    await expect(map).toBeVisible()
    await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()

    {
      await phone.locator('.world-phone__home-indicator').click()
      await expect(phone.locator('.world-phone__home-screen')).toBeVisible()
      await phone.locator('[data-app="contacts"]').click()
      await phone.locator('.world-phone__contact-row').click()
      await phone.getByRole('button', { name: '信息' }).click()
    }
})

test('Escape during Yonghe handoff closes cleanly and reopening retains an interactive map', async ({ page }) => {
  const phone = await openYongheCard(page)
  await phone.locator('.world-phone__place-card').click()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
  await page.keyboard.press('Escape')
  await expect(phone).toHaveAttribute('data-phone-open', 'false')
  await expect(phone.locator('[data-yonghe-handoff-map]')).toHaveCount(0)
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'idle')
  await phone.locator('[data-app="map"]').click()
  await expect(phone.locator('[data-map-world="inner"]')).toBeVisible()
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await expect(phone.locator('.world-phone__body')).not.toHaveAttribute('inert', '')
})

test('resizing during Yonghe handoff clears the overlay and leaves the resized map usable', async ({ page }) => {
  const phone = await openYongheCard(page)
  await phone.locator('.world-phone__place-card').click()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
  await expect(phone.locator('[data-yonghe-handoff-map]')).toHaveCount(1)
  await page.setViewportSize({ width: 360, height: 914 })
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled')
  await expect(phone.locator('[data-yonghe-handoff-map]')).toHaveCount(0)
  await expect(phone.locator('.world-phone__body')).not.toHaveAttribute('inert', '')
  await expect(phone.locator('[data-map-world="inner"]')).toBeVisible()
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await phone.locator('.world-phone__home-indicator').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await phone.getByRole('button', { name: '\u4fe1\u606f' }).click()
  await expect(phone.locator('.world-phone__message-bubble--place')).toBeVisible()
})

test('touch tilt is opt-in when the browser requires permission and the card remains tappable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 411, height: 914 }, hasTouch: true, isMobile: true })
  await context.addInitScript(() => {
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
    Object.defineProperty(window, '__orientationPermissionRequests', { value: 0, writable: true })
    Object.defineProperty(window.DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: async () => { (window as any).__orientationPermissionRequests += 1; return 'granted' },
    })
  })
  const page = await context.newPage()
  await page.goto('/?scene=commercial-cafe')
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').tap()
  await phone.locator('[data-app="contacts"]').tap()
  await phone.locator('.world-phone__contact-row').tap()
  await phone.getByRole('button', { name: '信息' }).tap()
  const bubble = phone.locator('.world-phone__message-bubble--place')
  const card = phone.locator('.world-phone__place-card')
  await bubble.tap()
  await expect(card).toBeVisible()
  const permissionButton = card.getByRole('button', { name: '启用倾斜效果' })
  await expect(permissionButton).toBeVisible()
  expect(await page.evaluate(() => (window as any).__orientationPermissionRequests)).toBe(0)
  await permissionButton.tap()
  await expect.poll(() => page.evaluate(() => (window as any).__orientationPermissionRequests)).toBe(1)
  await page.evaluate(() => {
    const first = new Event('deviceorientation')
    Object.defineProperties(first, { beta: { value: 0 }, gamma: { value: 0 } })
    window.dispatchEvent(first)
    const second = new Event('deviceorientation')
    Object.defineProperties(second, { beta: { value: 10 }, gamma: { value: 8 } })
    window.dispatchEvent(second)
  })
  await expect.poll(() => card.evaluate(element => element.style.getPropertyValue('--place-tilt-y'))).not.toBe('')
  await card.locator('.world-phone__place-card-close').tap()
  await expect(card).toBeHidden()
  expect(await card.evaluate(element => element.style.getPropertyValue('--place-tilt-y'))).toBe('')
  await bubble.tap()
  await expect(card).toBeVisible()
  await card.tap()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await context.close()
})

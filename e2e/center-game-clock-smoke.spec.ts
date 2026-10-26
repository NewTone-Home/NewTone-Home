import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

async function startIsolatedWorld(page: import('@playwright/test').Page, url = '/?scene=jijia-ancestral-home') {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    return route.abort()
  })
  await page.goto(url)
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
}

async function phoneMinutes(page: import('@playwright/test').Page) {
  const text = await page.locator('.world-phone__world-status').textContent()
  const match = text?.match(/(\d{2}):(\d{2})/)
  expect(match).not.toBeNull()
  return Number(match![1]) * 60 + Number(match![2])
}

function minuteDelta(before: number, after: number) {
  return (after - before + 24 * 60) % (24 * 60)
}

test('mounts the real CenterExperience entry without runtime reference errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  // Playwright supplies a fresh browser context: this does not use a user's browser save.
  await startIsolatedWorld(page)
  expect(runtimeErrors).toEqual([])
})
test('a real phone click restores 15x from idle, while a synthetic event does not', async ({ page }) => {
  await page.clock.install()
  await startIsolatedWorld(page)
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-open', 'true')
  await expect(phone.locator('.world-phone__home-screen')).toBeVisible()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await phone.locator('.world-phone__contact-actions button').first().click()
  await expect(phone.locator('.world-phone__message-thread')).toBeVisible()
  const start = await phoneMinutes(page)

  await page.clock.runFor(80_000)
  const idle = await phoneMinutes(page)
  expect(minuteDelta(start, idle)).toBeGreaterThanOrEqual(16)
  expect(minuteDelta(start, idle)).toBeLessThanOrEqual(17) // 60s at 15x, then 20s at idle 5x; floor display may straddle a minute.

  await phone.evaluate(element => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await page.clock.runFor(12_000)
  const afterSyntheticInput = await phoneMinutes(page)
  expect(minuteDelta(idle, afterSyntheticInput)).toBe(1) // Synthetic isTrusted=false; idle remains 5x.

  await phone.locator('.world-phone__message-bubble').first().click()
  const beforeClickInterval = await phoneMinutes(page)
  await page.clock.runFor(12_000)
  const afterClickInterval = await phoneMinutes(page)
  expect(minuteDelta(beforeClickInterval, afterClickInterval)).toBe(3) // Trusted click restores ordinary-reading 15x.
})

test('a trusted touch on the phone is observed before its local propagation handlers', async ({ page }) => {
  await page.clock.install()
  await startIsolatedWorld(page)
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-open', 'true')
  const start = await phoneMinutes(page)

  await page.clock.runFor(72_000)
  const idle = await phoneMinutes(page)
  expect(minuteDelta(start, idle)).toBeGreaterThanOrEqual(16)
  expect(minuteDelta(start, idle)).toBeLessThanOrEqual(17) // Reading until 60s, idle 5x for the remaining 12s.

  await page.context().newCDPSession(page).then(async cdp => {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    const box = await phone.locator('[data-app="contacts"]').boundingBox()
    expect(box).not.toBeNull()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  })
  await expect(phone.locator('[data-app-view="contacts"]')).toBeVisible()
  const beforeTouchInterval = await phoneMinutes(page)
  await page.clock.runFor(12_000)
  const afterTouchInterval = await phoneMinutes(page)
  expect(minuteDelta(beforeTouchInterval, afterTouchInterval)).toBe(3) // Trusted touch restores 15x.

  await page.clock.runFor(72_000)
  const beforeKeyboard = await phoneMinutes(page)
  await page.keyboard.press('Tab')
  await page.clock.runFor(12_000)
  const afterKeyboard = await phoneMinutes(page)
  expect(minuteDelta(beforeKeyboard, afterKeyboard)).toBe(3) // Trusted keydown restores 15x.
})


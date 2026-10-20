import { expect, test } from '@playwright/test'

async function expectFullyDrawn(frame: import('@playwright/test').Locator) {
  await expect.poll(() => frame.evaluate(element => {
    const path = element.querySelector('path')
    if (!path) return null
    return {
      phase: element.dataset.focusFramePhase,
      visibility: getComputedStyle(element).visibility,
      dashOffset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      closedPath: path.getAttribute('d')?.trim().endsWith('Z') ?? false,
    }
  }), { timeout: 5000 }).toEqual({ phase: 'visible', visibility: 'visible', dashOffset: 0, closedPath: true })
}

test('mainline commercial-street sign and entrance frames finish their closed stroke', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/e2e/fixtures/center-presentation.html')
  const host = page.locator('.scene-portal-characters[data-storefront-id="commercial-cafe-slot"]')
  const sign = host.locator('[data-focus-frame-group="storefront:commercial-cafe-slot:baseline"]')
  const door = host.locator('[data-focus-frame-group="door:street-cafe-entry"]')

  await expect(sign).toHaveAttribute('data-focus-frame-phase', 'visible')
  await expectFullyDrawn(sign)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-sign-closed.png') })

  const doorAppearance = page.waitForFunction(group => {
    const frame = [...document.querySelectorAll<HTMLElement>('.scene-focus-frame')]
      .find(element => element.dataset.focusFrameGroup === group)
    return frame?.dataset.focusFramePhase === 'appearing' ? performance.now() : false
  }, 'door:street-cafe-entry')
  const approachAt = await page.evaluate(() => performance.now())
  await page.locator('[data-fixture-approach]').click()
  const appearanceAt = await (await doorAppearance).jsonValue() as number
  await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealed', { timeout: 5000 })
  await expect(door).toHaveAttribute('data-focus-frame-phase', 'visible')
  await expectFullyDrawn(door)
  const completedAt = await page.evaluate(() => performance.now())
  const doorElapsedMs = completedAt - approachAt
  const doorStrokeMs = completedAt - appearanceAt
  expect(doorStrokeMs, 'the door outline must settle shortly after its draw phase begins').toBeLessThan(2000)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-door-closed.png') })

  const result = await page.evaluate(() => ['storefront:commercial-cafe-slot:baseline', 'door:street-cafe-entry'].map(group => {
    const frame = [...document.querySelectorAll<HTMLElement>('.scene-focus-frame')]
      .find(element => element.dataset.focusFrameGroup === group)!
    const path = frame.querySelector('path')!
    return {
      group,
      phase: frame.dataset.focusFramePhase,
      duration: getComputedStyle(path).transitionDuration,
      dashOffset: getComputedStyle(path).strokeDashoffset,
      closedPath: path.getAttribute('d')?.trim().endsWith('Z'),
      bounds: (() => { const rect = frame.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })(),
    }
  }))
  console.log('[commercial-street-frame-closure]', JSON.stringify({ doorElapsedMs, doorStrokeMs, result }))
  await testInfo.attach('commercial-street-frame-closure', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
})

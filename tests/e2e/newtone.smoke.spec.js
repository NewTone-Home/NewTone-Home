import { test, expect } from '@playwright/test'

const APP_URL = 'http://127.0.0.1:5173'

function captureConsoleErrors(page) {
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

test('desktop landing supports core interactions without runtime errors', async ({ page }) => {
  const errors = captureConsoleErrors(page)

  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await expect(page.locator('.landing-title-text')).toHaveText('NewTone')
  await expect(page.locator('.landing-lang-toggle')).toBeVisible()
  await expect(page.locator('.landing-reset')).toBeVisible()

  await page.locator('.landing-title').click()
  await expect(page.locator('.down-entry-group')).toBeVisible()
  await page.screenshot({
    path: 'test-results/screenshots/desktop-landing-awake.png',
    fullPage: true,
  })

  const languageBefore = await page.locator('.landing-lang-toggle').textContent()
  await page.locator('.landing-lang-toggle').click()
  await expect(page.locator('.landing-lang-toggle')).not.toHaveText(languageBefore || '')

  await page.mouse.wheel(0, 900)
  await page.waitForTimeout(1800)
  await page.screenshot({
    path: 'test-results/screenshots/desktop-after-entry-gesture.png',
    fullPage: true,
  })

  expect(errors, errors.join('\n')).toEqual([])
})

test('mobile touch viewport renders and responds to first interaction', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const errors = captureConsoleErrors(page)

  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await expect(page.locator('.landing-title-text')).toHaveText('NewTone')

  await page.locator('.landing-title').tap()
  await expect(page.locator('.down-entry-group')).toBeVisible()
  await page.screenshot({
    path: 'test-results/screenshots/mobile-landing-awake.png',
    fullPage: true,
  })

  expect(errors, errors.join('\n')).toEqual([])
  await context.close()
})

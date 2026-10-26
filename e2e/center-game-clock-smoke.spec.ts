import { expect, test } from '@playwright/test'

test('mounts the real CenterExperience entry without runtime reference errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    return route.abort()
  })

  // Playwright supplies a fresh browser context: this does not use a user's browser save.
  await page.goto('/?scene=jijia-ancestral-home')
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('.scene-shell[data-mainline-scene="jijia-ancestral-home"]')).toBeVisible()
  expect(runtimeErrors).toEqual([])
})

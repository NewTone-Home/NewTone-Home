import { test } from '@playwright/test'
// Phone acceptance never writes to a project database. The dedicated local
// test server uses this non-routable hostname; individual cases can override
// this route with narrower response assertions or deliberate offline failures.
export function registerPhoneTestNetwork() {
 test.beforeEach(async ({ page }) => {
  await page.route('**/phone-v1-validation.invalid/**', route => route.fulfill({
    status: route.request().method() === 'GET' ? 200 : 201,
    contentType: 'application/json',
    body: route.request().method() === 'GET' ? '[]' : '',
  }))
 })
}

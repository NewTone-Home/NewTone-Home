import { expect, test } from '@playwright/test'

test('Dialogue and Observation preserve internal punctuation and closing quotes in the real renderer', async ({ page }) => {
  await page.goto('/e2e/fixtures/center-presentation.html')
  for (const [source, visible] of [['我跟你说，事情不是这样的。', '我跟你说，事情不是这样的'], ['“他说：‘你来了？’”', '“他说：‘你来了’”'], ['不，不对？！再想想。', '不，不对？！再想想']]) {
    await page.locator('[data-fixture-text]').fill(source)
    for (const mode of ['dialogue', 'observation']) {
      await page.locator(`[data-fixture-${mode}]`).click()
      await expect(page.locator(`[data-scene-text-mode="${mode}"]`)).toHaveText(visible)
    }
  }
})

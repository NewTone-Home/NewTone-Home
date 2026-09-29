import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

test('ambient pedestrians can virtually visit a normal storefront and leave or return through the west boundary', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const pedestrians = page.locator('[data-npc-role="pedestrian"]')
  const storefrontVisitor = page.locator('[data-npc-id="commercial-street-pedestrian-west-north"]')
  const westTraveler = page.locator('[data-npc-id="commercial-street-pedestrian-west-south"]')

  await expect(pedestrians).toHaveCount(6)
  await storefrontVisitor.waitFor({ state: 'hidden', timeout: 15_000 })
  await expect(pedestrians).toHaveCount(5)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-storefront-visit-hidden.png') })
  await storefrontVisitor.waitFor({ state: 'visible', timeout: 20_000 })

  await westTraveler.waitFor({ state: 'hidden', timeout: 15_000 })
  await page.screenshot({ path: testInfo.outputPath('commercial-street-offstreet-hidden.png') })
  await westTraveler.waitFor({ state: 'visible', timeout: 35_000 })
  await expect(westTraveler).toHaveAttribute('data-npc-role', 'pedestrian')
  expect(consoleErrors).toEqual([])
})

import { expect, test, type Page } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetQuestionNarrativeAnchor } from '../src/center/runtime/commercialStreetQuestionNarrative'

test.use({ viewport: { width: 1280, height: 720 } })

async function clickWorldPoint(page: Page, point: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const screenPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return {
      x: ((target.x + cameraX) / 100) * rect.width,
      y: ((target.y + cameraY) / 100) * rect.height,
    }
  }, point)
  await stage.click({ position: screenPoint })
}

test('the Commercial Street question mark locks input, rolls its world-space narration, and persists only at the end', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const anchor = commercialStreetQuestionNarrativeAnchor(mainlineScenes['commercial-street'])
  const shell = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const question = page.locator('[data-commercial-question-mark="true"]')
  await expect(question).toBeVisible()

  // Normal stage input brings the protagonist close enough for the follow-player
  // camera to expose the authored centre anchor; no debug positioning is used.
  const cameraApproach = { x: anchor.x - mainlineScenes['commercial-street'].walkBounds.height * .3, y: anchor.y }
  await clickWorldPoint(page, cameraApproach)
  await expect(protagonist).toHaveAttribute('data-runtime-x', `${cameraApproach.x}`, { timeout: 15_000 })
  await clickWorldPoint(page, anchor)

  const narrative = page.locator('[data-world-narrative="commercial-street-question"]')
  const shield = page.locator('[data-world-narrative-shield="true"]')
  await expect(narrative).toBeVisible({ timeout: 15_000 })
  await expect(narrative).toHaveAttribute('data-world-anchor-x', `${anchor.x}`)
  await expect(narrative).toHaveAttribute('data-world-anchor-y', `${anchor.y}`)
  await expect(question).toBeHidden()
  await expect(shell).toHaveAttribute('data-commercial-question-narrative', 'active')
  expect(await narrative.locator('.scene-focus-frame').count()).toBe(0)
  const stoppedAt = await protagonist.getAttribute('data-runtime-x')
  await page.screenshot({ path: testInfo.outputPath('commercial-street-question-active.png') })

  await shield.click()
  await expect(narrative).toContainText('不，不会认错的。')
  await shield.click()
  await expect(narrative).toContainText('那张脸修杰太过于熟悉。')
  await shield.click()
  await expect(shell).toHaveAttribute('data-commercial-question-narrative', 'leaving')
  await expect(narrative).toBeHidden({ timeout: 5_000 })
  await expect(protagonist).toHaveAttribute('data-runtime-x', stoppedAt!)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-question-complete.png') })

  await page.reload()
  await expect(page.locator('[data-commercial-question-mark="true"]')).toBeHidden()
  expect(consoleErrors).toEqual([])
})

test('an interrupted question-mark narration does not persist partial progress', async ({ page }) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const anchor = commercialStreetQuestionNarrativeAnchor(mainlineScenes['commercial-street'])
  const cameraApproach = { x: anchor.x - mainlineScenes['commercial-street'].walkBounds.height * .3, y: anchor.y }
  await clickWorldPoint(page, cameraApproach)
  await expect(page.locator('[data-actor-id="protagonist"]')).toHaveAttribute('data-runtime-x', `${cameraApproach.x}`, { timeout: 15_000 })
  await clickWorldPoint(page, anchor)
  await expect(page.locator('[data-world-narrative="commercial-street-question"]')).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.locator('[data-world-narrative="commercial-street-question"]')).toContainText('难道刚刚是幻觉吗？')
  await expect(page.locator('[data-world-narrative="commercial-street-question"]')).toHaveAttribute('data-world-narrative-segment-index', '0')
})

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

async function advanceDialogueFromScene(page: Page) {
  const dialogue = page.locator('[data-scene-dialogue="commercial-street-question"]')
  await page.waitForTimeout(400)
  await expect(dialogue.locator('[data-scene-text-mode="dialogue"]')).toBeVisible()
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
}

test('the Commercial Street question mark locks input, presents Xiao Jie dialogue, and persists only at the end', async ({ page }, testInfo) => {
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

  const dialogue = page.locator('[data-scene-dialogue="commercial-street-question"]')
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(dialogue).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
  await expect(dialogue).toHaveAttribute('data-dialogue-speaker', '修杰')
  await expect(question).toBeHidden()
  await expect(shell).toHaveAttribute('data-commercial-question-narrative', 'active')
  expect(await dialogue.locator('.scene-focus-frame').count()).toBe(0)
  const stoppedAt = await protagonist.getAttribute('data-runtime-x')
  await page.screenshot({ path: testInfo.outputPath('commercial-street-question-active.png') })

  await expect(dialogue).toContainText('难道刚刚是幻觉吗？')
  const dialogueAnchor = await dialogue.evaluate((element) => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }))
  // Reading owns the whole scene: the shield advances only after the roll is ready.
  await advanceDialogueFromScene(page)
  await expect(dialogue).toContainText('不，不会认错的。')
  expect(await dialogue.evaluate((element) => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }))).toEqual(dialogueAnchor)
  await advanceDialogueFromScene(page)
  await expect(dialogue).toContainText('那张脸修杰太过于熟悉。')
  expect(await dialogue.evaluate((element) => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }))).toEqual(dialogueAnchor)
  await advanceDialogueFromScene(page)
  await expect(shell).toHaveAttribute('data-commercial-question-narrative', 'leaving')
  await expect(dialogue).toBeHidden({ timeout: 5_000 })
  expect(consoleErrors).toEqual([])
  await expect(protagonist).toHaveAttribute('data-runtime-x', stoppedAt!)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-question-complete.png') })

  await page.reload()
  await expect(page.locator('[data-commercial-question-mark="true"]')).toBeHidden()
  expect(consoleErrors).toEqual([])
})

test('an interrupted question-mark dialogue does not persist partial progress', async ({ page }) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const anchor = commercialStreetQuestionNarrativeAnchor(mainlineScenes['commercial-street'])
  const cameraApproach = { x: anchor.x - mainlineScenes['commercial-street'].walkBounds.height * .3, y: anchor.y }
  await clickWorldPoint(page, cameraApproach)
  await expect(page.locator('[data-actor-id="protagonist"]')).toHaveAttribute('data-runtime-x', `${cameraApproach.x}`, { timeout: 15_000 })
  await clickWorldPoint(page, anchor)
  await expect(page.locator('[data-scene-dialogue="commercial-street-question"]')).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await expect(page.locator('[data-scene-dialogue="commercial-street-question"]')).toContainText('难道刚刚是幻觉吗？')
  await expect(page.locator('[data-scene-dialogue="commercial-street-question"]')).toHaveAttribute('data-scene-segment-index', '0')
})

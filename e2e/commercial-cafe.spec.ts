import { expect, test, type Page } from '@playwright/test'
import {
  commercialCafeCompletedAtKey,
  commercialCafeCoffeeDeliveredKey,
  commercialCafeCoffeeOrderedKey,
  commercialCafeNarrativeCursorKey,
  commercialCafeStoryStatusKey,
} from '../src/center/runtime/commercialCafeStory'

test.use({ viewport: { width: 1280, height: 720 } })

async function café(page: Page, search = '') {
  await page.goto(`/?scene=commercial-cafe&debugCafeFixture=1${search ? `&${search}` : ''}`)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible()
}

async function startNarrative(page: Page) {
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  const dialogue = page.locator('[data-scene-dialogue="lao-zhou"]')
  await expect(dialogue).toBeVisible({ timeout: 15_000 })
  await expect(dialogue).toHaveCSS('opacity', '1')
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
}

async function advanceNarrative(page: Page, maximum = 80) {
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let index = 0; index < maximum; index += 1) {
    const interaction = await page.evaluate(() => {
      const dialogueElement = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      const textElement = document.querySelector<HTMLElement>('[data-scene-text-mode="dialogue"]')
      if (!dialogueElement || !textElement) return null
      const rect = textElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return {
        bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        previous: `${dialogueElement.dataset.dialogueLineId}:${dialogueElement.dataset.sceneSegmentIndex}:${dialogueElement.textContent}`,
      }
    })
    if (!interaction) return
    await page.waitForTimeout(400)
    await page.mouse.click(
      interaction.bounds.x + interaction.bounds.width / 2,
      interaction.bounds.y + interaction.bounds.height / 2,
    )
    await page.waitForFunction((previous) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return !current || `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== previous || current.classList.contains('is-leaving')
    }, interaction.previous)
  }
  await expect(shield).toHaveCount(0)
}

async function advanceNarrativeToLine(page: Page, lineId: string, maximum = 40) {
  for (let index = 0; index < maximum; index += 1) {
    if (await page.locator(`[data-dialogue-line-id="${lineId}"]`).count() > 0) return
    await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
    const previous = await page.locator('[data-scene-dialogue]').evaluate((element) => `${(element as HTMLElement).dataset.dialogueLineId}:${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    await page.waitForTimeout(400)
    await page.locator('[data-scene-text-mode="dialogue"]').click()
    await page.waitForFunction((token) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return current && `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== token
    }, previous)
  }
  await expect(page.locator(`[data-dialogue-line-id="${lineId}"]`)).toBeVisible()
}

async function advanceVisibleDialogue(page: Page, maximum = 20) {
  for (let index = 0; index < maximum; index += 1) {
    const interaction = await page.evaluate(() => {
      const dialogue = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      if (!dialogue) return null
      return `${dialogue.dataset.dialogueLineId}:${dialogue.dataset.sceneSegmentIndex}:${dialogue.textContent}`
    })
    if (!interaction) return
    await page.waitForTimeout(400)
    await page.locator('[data-scene-text-mode="dialogue"]').click()
    await page.waitForFunction((previous) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return !current || `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== previous
    }, interaction)
  }
  await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
}

test('new Café narrative starts seated without coffee, locks scene input, and finishes ready-to-leave', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await café(page)
  await startNarrative(page)
  await expect(page.locator('[data-dialogue-speaker="修杰"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-narrative-xiujie.png') })
  // The shield owns arbitrary world clicks while narration is active.
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
  await advanceNarrative(page)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-status', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-ready-banknote.png') })
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeStoryStatusKey)).toBe('complete')
  expect(consoleErrors).toEqual([])
})

test('normal Café route seats beside Lao Zhou and starts the unlocked narrative without coffee', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.goto('/?scene=commercial-cafe')
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-seat-guide"]')).toBeVisible({ timeout: 30_000 })
  await advanceVisibleDialogue(page)
  await page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-bottom"]').click()
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-scene-dialogue="lao-zhou"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-dialogue-speaker="修杰"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-normal-route-narrative.png') })
  expect(consoleErrors).toEqual([])
})

test('Café long dialogue remains readable at the fixed world anchor without a card', async ({ page }, testInfo) => {
  await café(page)
  await startNarrative(page)
  await advanceNarrativeToLine(page, 'commercial-cafe-coffee-lao-zhou')
  const dialogue = page.locator('[data-dialogue-line-id="commercial-cafe-coffee-lao-zhou"]')
  await page.waitForTimeout(400)
  await page.locator('[data-scene-text-mode="dialogue"]').click()
  await expect(dialogue).toHaveAttribute('data-scene-segment-index', '1')
  await expect(dialogue).toContainText('我真喝不惯那玩意儿')
  const [stageBox, dialogueBox] = await Promise.all([
    page.locator('.mainline-scene-stage').boundingBox(),
    dialogue.boundingBox(),
  ])
  expect(stageBox).not.toBeNull()
  expect(dialogueBox).not.toBeNull()
  expect(dialogueBox!.x).toBeGreaterThan(stageBox!.x)
  expect(dialogueBox!.y).toBeGreaterThan(stageBox!.y)
  expect(dialogueBox!.x + dialogueBox!.width).toBeLessThan(stageBox!.x + stageBox!.width)
  expect(dialogueBox!.y + dialogueBox!.height).toBeLessThan(stageBox!.y + stageBox!.height)
  await page.screenshot({ path: testInfo.outputPath('cafe-long-dialogue.png') })
})

test('Café narrative shield consumes object, door, and open-floor clicks without moving the seated protagonist', async ({ page }) => {
  await café(page)
  await startNarrative(page)
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const seatedPosition = await protagonist.boundingBox()
  expect(seatedPosition).not.toBeNull()
  for (const selector of ['[data-object-id="commercial-cafe-counter"]', '[data-focus-target-group="door:street-cafe-entry"]', '.mainline-scene-stage']) {
    const target = page.locator(selector).first()
    const box = await target.boundingBox()
    expect(box).not.toBeNull()
    const previous = await page.locator('[data-scene-dialogue]').evaluate((element) => `${(element as HTMLElement).dataset.dialogueLineId}:${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(250)
    const afterText = await page.locator('[data-scene-dialogue]').evaluate((element) => `${(element as HTMLElement).dataset.dialogueLineId}:${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    expect(afterText).toBe(previous)
    await page.waitForFunction((token) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return current && `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` === token
    }, previous)
    const after = await protagonist.boundingBox()
    expect(after).not.toBeNull()
    expect(after!.x).toBeCloseTo(seatedPosition!.x, 3)
    expect(after!.y).toBeCloseTo(seatedPosition!.y, 3)
    await expect(protagonist).toHaveAttribute('data-seat-entity-id', 'commercial-cafe-right-window-upper-group-chair-bottom')
  }
})

test('coffee is optional and a carried milk tea asks before coffee order', async ({ page }, testInfo) => {
  await café(page)
  await page.evaluate(() => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected isolated player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'] = { commercialStreetMilkTeaHeldDrink: 'milk-tea' }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  })
  await page.reload()
  await page.getByRole('button', { name: '柜台' }).first().click()
  await expect(page.getByText('已经有奶茶了，还要买咖啡吗？')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '否', exact: true }).click()
  await expect(page.getByText('修杰没有点咖啡。')).toBeVisible()
  await startNarrative(page)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-milk-tea"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-milk-tea-table.png') })
})

test('optional coffee delivery keeps a carried milk tea and adds the two small coffee table icons without gating dialogue', async ({ page }, testInfo) => {
  await café(page)
  await page.evaluate(() => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected isolated player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'] = { commercialStreetMilkTeaHeldDrink: 'milk-tea' }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  })
  await page.reload()
  await page.getByRole('button', { name: '柜台' }).first().click()
  await expect(page.getByText('已经有奶茶了，还要买咖啡吗？')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '是', exact: true }).click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-status', 'available')
  await startNarrative(page)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-lao-zhou-coffee"]')).toBeVisible()
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-milk-tea"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-three-table-icons.png') })
})

test('narrative reload resumes at its persisted stable line and never requires coffee delivery', async ({ page }) => {
  await café(page)
  await startNarrative(page)
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-scene-segment-index', '1')
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-cursor', '1')
  await page.reload()
  await startNarrative(page)
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-first-lao-zhou"]')).toBeVisible()
})

test('post-story re-entry clears story props, retains Lao Zhou for five minutes, and expires by timestamp', async ({ page }) => {
  await café(page)
  await page.evaluate((keys) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected isolated player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-cafe'] = {
      [keys.status]: 'complete', [keys.cursor]: 14, [keys.ordered]: true, [keys.delivered]: true, [keys.completedAt]: Date.now(),
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, { status: commercialCafeStoryStatusKey, cursor: commercialCafeNarrativeCursorKey, ordered: commercialCafeCoffeeOrderedKey, delivered: commercialCafeCoffeeDeliveredKey, completedAt: commercialCafeCompletedAtKey })
  await page.reload()
  await expect(page.getByRole('button', { name: '老周，点击让主角前往互动' })).toBeVisible()
  await expect(page.locator('[data-attached-prop-id]')).toHaveCount(0)
  await page.evaluate((key) => {
    const raw = localStorage.getItem('newtone-player-save-v1')!
    const save = JSON.parse(raw)
    save.sceneState['commercial-cafe'][key] = Date.now() - 5 * 60 * 1000
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, commercialCafeCompletedAtKey)
  await page.reload()
  await expect(page.getByRole('button', { name: '老周，点击让主角前往互动' })).toHaveCount(0)
})

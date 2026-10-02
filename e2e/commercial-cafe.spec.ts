import { expect, test, type Page } from '@playwright/test'
import {
  commercialCafeCompletedAtKey,
  commercialCafeCompletionPresenceMs,
  commercialCafeCoffeePreparationDurationMs,
  commercialCafeCoffeePreparationStartedAtKey,
  commercialCafeCoffeeStatusKey,
  commercialCafeLaoZhouDepartureKey,
  commercialCafeLaoZhouConversationSeatId,
  commercialCafeNarrativeCursorKey,
  commercialCafeNarrativePhaseKey,
  commercialCafeStoryStatusKey,
} from '../src/center/runtime/commercialCafeStory'
import { commercialStreetMilkTeaHeldDrinkKey } from '../src/center/runtime/commercialStreetMilkTea'
import { splitMainlineInteractionText } from '../src/center/runtime/mainlineTextSegments'

test.use({ viewport: { width: 1280, height: 720 } })

const consoleErrorsByPage = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrorsByPage.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
})
test.afterEach(async ({ page }) => {
  expect(consoleErrorsByPage.get(page) ?? []).toEqual([])
})

async function café(page: Page, search = '') {
  await page.goto(`/?scene=commercial-cafe&debugCafeFixture=1${search ? `&${search}` : ''}`)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible()
}

async function enterCafeFromStreet(page: Page, search = '') {
  await page.goto(`/?scene=commercial-cafe${search ? `&${search}` : ''}`)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible()
}

async function startNarrative(page: Page) {
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  const dialogue = page.locator('[data-scene-dialogue="lao-zhou"]')
  await expect(dialogue).toBeVisible({ timeout: 15_000 })
  await expect(dialogue).toHaveCSS('opacity', '1')
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
}

async function meetLaoZhouAndStartNarrativeFromSeat(page: Page) {
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-seat-guide"]')).toBeVisible({ timeout: 15_000 })
  await advanceVisibleDialogue(page)
  await page.locator(`[data-object-id="${commercialCafeLaoZhouConversationSeatId}"]`).click()
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-first-xiujie"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
}

async function advanceNarrative(page: Page, maximum = 80) {
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  const visitedLineIds: string[] = []
  for (let index = 0; index < maximum; index += 1) {
    const interaction = await page.evaluate(() => {
      const dialogueElement = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      const textElement = document.querySelector<HTMLElement>('[data-scene-text-mode="dialogue"]')
      if (!dialogueElement || !textElement || dialogueElement.classList.contains('is-leaving')) return null
      const rect = textElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return {
        previous: `${dialogueElement.dataset.dialogueLineId}:${dialogueElement.dataset.sceneSegmentIndex}:${dialogueElement.textContent}`,
        lineId: dialogueElement.dataset.dialogueLineId,
      }
    })
    if (!interaction) return visitedLineIds
    if (interaction.lineId && visitedLineIds.at(-1) !== interaction.lineId) visitedLineIds.push(interaction.lineId)
    await page.waitForTimeout(400)
    await shield.click({ force: true })
    await page.waitForFunction((previous) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return !current || `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== previous || current.classList.contains('is-leaving')
    }, interaction.previous)
  }
  await expect(shield).toHaveCount(0)
  return visitedLineIds
}

async function advanceNarrativeToLine(page: Page, lineId: string, maximum = 40) {
  for (let index = 0; index < maximum; index += 1) {
    if (await page.locator(`[data-dialogue-line-id="${lineId}"]`).count() > 0) return
    const shield = page.locator('[data-scene-dialogue-shield="true"]')
    try {
      await expect(shield).toBeVisible()
    } catch (error) {
      const state = await page.evaluate(({ cursorKey, phaseKey }) => {
        const shell = document.querySelector<HTMLElement>('.scene-shell[data-mainline-scene="commercial-cafe"]')
        const dialogue = document.querySelector<HTMLElement>('[data-scene-dialogue]')
        const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
        return {
          cursor: shell?.dataset.commercialCafeCursor,
          narrativePhase: shell?.dataset.commercialCafeNarrativePhase,
          coffeeStatus: shell?.dataset.commercialCafeCoffeeStatus,
          dialogue: dialogue ? {
            lineId: dialogue.dataset.dialogueLineId,
            segment: dialogue.dataset.sceneSegmentIndex,
            leaving: dialogue.classList.contains('is-leaving'),
            text: dialogue.textContent,
          } : null,
          savedCursor: save.sceneState?.['commercial-cafe']?.[cursorKey],
          savedPhase: save.sceneState?.['commercial-cafe']?.[phaseKey],
        }
      }, { cursorKey: commercialCafeNarrativeCursorKey, phaseKey: commercialCafeNarrativePhaseKey })
      throw new Error(`Narrative shield did not return before ${lineId}: ${JSON.stringify(state)}; ${String(error)}`)
    }
    const previous = await page.locator('[data-scene-dialogue]').evaluate((element) => `${(element as HTMLElement).dataset.dialogueLineId}:${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    await page.waitForTimeout(400)
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await page.waitForFunction((token) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return !current || `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== token || current.classList.contains('is-leaving')
    }, previous)
  }
  await expect(page.locator(`[data-dialogue-line-id="${lineId}"]`)).toBeVisible()
}

async function advanceNarrativeToText(page: Page, lineId: string, text: string, maximum = 20) {
  const dialogue = page.locator(`[data-dialogue-line-id="${lineId}"]`)
  for (let index = 0; index < maximum; index += 1) {
    await expect(dialogue).toBeVisible()
    if ((await dialogue.textContent())?.includes(text)) return
    const previous = await dialogue.evaluate((element) => `${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    await page.waitForTimeout(400)
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await page.waitForFunction((token) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return current && `${current.dataset.sceneSegmentIndex}:${current.textContent}` !== token
    }, previous)
  }
  await expect(dialogue).toContainText(text)
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
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await page.waitForFunction((previous) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return !current || `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== previous
    }, interaction)
  }
  await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
}

async function advanceObservationToAction(page: Page, observation: string, option: string) {
  const segments = splitMainlineInteractionText(observation)
  for (let index = 0; index < segments.length; index += 1) {
    await expect(page.getByText(segments[index]!, { exact: true })).toBeVisible({ timeout: 15_000 })
    const echo = page.locator('[data-scene-echo]')
    if (await echo.getAttribute('data-scene-observation-typing') === 'true') {
      await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
      await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false')
    }
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  }
  const action = page.getByRole('button', { name: option, exact: true })
  await expect(action).toBeEnabled({ timeout: 5_000 })
  return action
}

async function startTableVisualTrace(page: Page) {
  await page.evaluate(() => {
    const target = window as Window & { __cafeTableVisualTrace?: Array<{ props: string[]; overlapAreas: number[]; tableText: string }> }
    target.__cafeTableVisualTrace = []
    const sample = () => {
      const elements = [...document.querySelectorAll<HTMLElement>('[data-attached-prop-id]')]
      const props = elements.map((element) => element.dataset.attachedPropId ?? '')
      const overlapAreas: number[] = []
      for (let first = 0; first < elements.length; first += 1) {
        for (let second = first + 1; second < elements.length; second += 1) {
          const a = elements[first]!.getBoundingClientRect()
          const b = elements[second]!.getBoundingClientRect()
          overlapAreas.push(Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)))
        }
      }
      const table = document.querySelector<HTMLElement>('[data-object-id="commercial-cafe-right-window-upper-group-table"]')
      target.__cafeTableVisualTrace!.push({ props, overlapAreas, tableText: table?.textContent ?? '' })
      if (target.__cafeTableVisualTrace!.length < 6000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

test('no-coffee narrative advances through story and reaches ready-to-leave without delivery or banknote', async ({ page }, testInfo) => {
  await café(page, 'debugRuntimeEvidence=1')
  const coffeeOwner = page.locator('[data-actor-id="cafe-coffee-owner"]')
  const floorServer = page.locator('[data-actor-id="cafe-floor-server"]')
  await expect(coffeeOwner).toHaveText('店员')
  await expect(floorServer).toHaveText('店员')
  await expect(floorServer).toHaveAttribute('data-npc-duty-id', 'cafe-floor-server.table-service')
  const staffBounds = await Promise.all([coffeeOwner.boundingBox(), floorServer.boundingBox()])
  expect(staffBounds.every(Boolean)).toBe(true)
  expect(Math.max(0, Math.min(staffBounds[0]!.x + staffBounds[0]!.width, staffBounds[1]!.x + staffBounds[1]!.width) - Math.max(staffBounds[0]!.x, staffBounds[1]!.x))
    * Math.max(0, Math.min(staffBounds[0]!.y + staffBounds[0]!.height, staffBounds[1]!.y + staffBounds[1]!.height) - Math.max(staffBounds[0]!.y, staffBounds[1]!.y))).toBe(0)
  await startNarrative(page)
  await expect(page.locator('[data-dialogue-speaker="修杰"]')).toBeVisible()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-e2e-world-speed', '0.45')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-e2e-floor-server-speed', '0.45')
  await page.screenshot({ path: testInfo.outputPath('cafe-narrative-xiujie.png') })
  const firstVisibleLineId = await page.locator('[data-scene-dialogue]').getAttribute('data-dialogue-line-id')
  // The shield owns arbitrary world clicks while narration is active.
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
  expect([firstVisibleLineId, ...await advanceNarrative(page)]).toEqual([
    'commercial-cafe-lao-zhou-first-xiujie',
    'commercial-cafe-lao-zhou-first-lao-zhou',
    'commercial-cafe-coffee-xiujie',
    'commercial-cafe-coffee-lao-zhou',
    'commercial-cafe-intel-lao-zhou-document',
    'commercial-cafe-intel-lao-zhou-camera',
    'commercial-cafe-intel-xiujie-mine',
    'commercial-cafe-intel-lao-zhou-mine',
    'commercial-cafe-intel-xiujie-destination',
    'commercial-cafe-intel-lao-zhou-eatery',
    'commercial-cafe-intel-xiujie-eatery',
    'commercial-cafe-intel-lao-zhou-eatery-detail',
    'commercial-cafe-resolution-xiujie',
    'commercial-cafe-resolution-lao-zhou',
  ])
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-status', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-coffee-status', 'none')
  await expect(page.locator('[data-actor-id="cafe-coffee-owner"]')).toHaveText('店员')
  await expect(page.locator('[data-actor-id="cafe-floor-server"]')).toHaveText('店员')
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('none')
  await page.screenshot({ path: testInfo.outputPath('cafe-ready-no-coffee.png') })
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 30_000 })
  expect(await page.evaluate((keys) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    const state = save.sceneState?.['commercial-cafe'] ?? {}
    return { status: state[keys.status], completedAt: state[keys.completedAt] }
  }, { status: commercialCafeStoryStatusKey, completedAt: commercialCafeCompletedAtKey })).toMatchObject({ status: 'complete' })
})

test('normal Café route seats beside Lao Zhou and starts the unlocked narrative without coffee', async ({ page }, testInfo) => {
  await page.goto('/?scene=commercial-cafe')
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-seat-guide"]')).toBeVisible({ timeout: 30_000 })
  await advanceVisibleDialogue(page)
  await page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-bottom"]').click()
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-scene-dialogue="lao-zhou"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-dialogue-speaker="修杰"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-normal-route-narrative.png') })
})

test('Café long dialogue remains readable at the fixed world anchor without a card', async ({ page }, testInfo) => {
  await café(page)
  await startNarrative(page)
  await advanceNarrativeToLine(page, 'commercial-cafe-coffee-lao-zhou')
  const dialogue = page.locator('[data-dialogue-line-id="commercial-cafe-coffee-lao-zhou"]')
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
    // The shield owns arbitrary scene clicks after the roll settles: the
    // click advances the current line but never invokes the object, door, or
    // stage beneath it.
    await page.waitForTimeout(400)
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(250)
    const afterText = await page.locator('[data-scene-dialogue]').evaluate((element) => `${(element as HTMLElement).dataset.dialogueLineId}:${(element as HTMLElement).dataset.sceneSegmentIndex}:${element.textContent}`)
    expect(afterText).not.toBe(previous)
    await page.waitForFunction((token) => {
      const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
      return current && `${current.dataset.dialogueLineId}:${current.dataset.sceneSegmentIndex}:${current.textContent}` !== token
    }, previous)
    const after = await protagonist.boundingBox()
    expect(after).not.toBeNull()
    expect(after!.x).toBeCloseTo(seatedPosition!.x, 3)
    expect(after!.y).toBeCloseTo(seatedPosition!.y, 3)
    await expect(protagonist).toHaveAttribute('data-seat-entity-id', 'commercial-cafe-right-window-upper-group-chair-bottom')
  }
})

test('coffee is optional and a carried milk tea asks before coffee order', async ({ page }, testInfo) => {
  await enterCafeFromStreet(page)
  await page.evaluate(() => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected isolated player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'] = { commercialStreetMilkTeaHeldDrink: 'milk-tea' }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  })
  await page.reload()
  await page.getByRole('button', { name: '柜台' }).first().click()
  await (await advanceObservationToAction(page, '已经有奶茶了，还要买咖啡吗？', '否')).click()
  await expect(page.locator('[data-scene-action]')).toHaveCount(0)
  await meetLaoZhouAndStartNarrativeFromSeat(page)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-milk-tea"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-milk-tea-table.png') })
})

test('coffee prepares after prep arrival, waits ready at the counter, and delivers only between cursor 1 and cursor 2', async ({ page }, testInfo) => {
  await enterCafeFromStreet(page, 'debugRuntimeEvidence=1')
  await startTableVisualTrace(page)
  const coffeeQuestion = '\u8981\u70b9\u4e00\u676f\u5496\u5561\u5417\uff1f'
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await (await advanceObservationToAction(page, coffeeQuestion, '\u70b9\u4e00\u676f\u5496\u5561')).click()
  await expect(page.locator('[data-scene-action]')).toHaveCount(0)
  const shell = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-status', 'ordered')
  await expect(shell).toHaveAttribute('data-e2e-world-speed', '1')
  console.log('CAFE_FLOW_CHECKPOINT', 'order-selected')
  await expect.poll(async () => page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey), { timeout: 15_000 }).toBe('preparing')
  console.log('CAFE_FLOW_CHECKPOINT', 'prep-arrived')
  const preparationStartedAt = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeePreparationStartedAtKey)
  expect(typeof preparationStartedAt).toBe('number')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect.poll(async () => page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey), { timeout: 20_000 }).toBe('ready')
  console.log('CAFE_FLOW_CHECKPOINT', 'preparation-ready')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await meetLaoZhouAndStartNarrativeFromSeat(page)
  console.log('CAFE_FLOW_CHECKPOINT', 'narrative-started')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-lao-zhou-coffee"]')).toBeVisible()
  const laoZhouLineId = 'commercial-cafe-lao-zhou-first-lao-zhou'
  const cursorOneText = '\u5b8c\u5168\u6ca1\u6709\u3002'
  await advanceNarrativeToLine(page, laoZhouLineId)
  await advanceNarrativeToText(page, laoZhouLineId, cursorOneText)
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await shell.getAttribute('data-commercial-cafe-narrative-phase') === 'coffee-delivery') break
    await page.waitForTimeout(400)
    await shield.click({ force: true })
  }
  await expect(shell).toHaveAttribute('data-commercial-cafe-narrative-phase', 'coffee-delivery')
  await expect(shell).toHaveAttribute('data-e2e-world-speed', '0.45')
  await expect(shell).toHaveAttribute('data-e2e-floor-server-speed', '0.45')
  await expect(shell).toHaveAttribute('data-e2e-coffee-owner-speed', '1')
  console.log('CAFE_FLOW_CHECKPOINT', 'delivery-gate-open')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-status', 'ready')
  await expect(page.locator('[data-scene-dialogue]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-actor-id="cafe-coffee-owner"]')).toHaveAttribute('data-npc-duty-id', 'cafe-coffee-owner.deliver-coffee', { timeout: 15_000 })
  await expect.poll(async () => page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey), { timeout: 30_000 }).toBe('delivered')
  console.log('CAFE_FLOW_CHECKPOINT', 'delivery-arrived')
  await expect(shell).toHaveAttribute('data-commercial-cafe-cursor', '2')
  await expect(shell).toHaveAttribute('data-commercial-cafe-narrative-phase', 'active')
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-coffee-xiujie"]')).toBeVisible()
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-cursor-2-delivered-plus-milk-tea.png') })
  await expect(page.locator('[data-actor-id="cafe-coffee-owner"]')).toHaveAttribute('data-npc-duty-id', 'cafe-coffee-owner.return-to-counter')
  await expect(shell).toHaveAttribute('data-e2e-coffee-owner-speed', '1')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-owner-phase', 'counter', { timeout: 20_000 })
  await expect(shell).toHaveAttribute('data-e2e-coffee-owner-speed', '0.45')
  const visualTrace = await page.evaluate(() => {
    const target = window as Window & { __cafeTableVisualTrace?: Array<{ props: string[]; overlapAreas: number[]; tableText: string }> }
    return target.__cafeTableVisualTrace ?? []
  })
  expect(visualTrace.length).toBeGreaterThan(20)
  expect(visualTrace.every((sample) => sample.overlapAreas.every((area) => area === 0) && !sample.tableText.includes('桌子'))).toBe(true)
  expect(visualTrace.some((sample) => sample.props.includes('commercial-cafe-lao-zhou-coffee') && sample.props.length === 1)).toBe(true)
  expect(visualTrace.some((sample) => sample.props.includes('commercial-cafe-xiujie-coffee'))).toBe(true)
  await testInfo.attach('cafe-coffee-dynamic-prop-layout.json', { body: JSON.stringify(visualTrace, null, 2), contentType: 'application/json' })
})

test('cursor 1 fast-forwards the durable preparing state only after coffee owner reached prep', async ({ page }, testInfo) => {
  await enterCafeFromStreet(page)
  await page.clock.setFixedTime(new Date())
  const coffeeQuestion = '\u8981\u70b9\u4e00\u676f\u5496\u5561\u5417\uff1f'
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await (await advanceObservationToAction(page, coffeeQuestion, '\u70b9\u4e00\u676f\u5496\u5561')).click()
  await expect(page.locator('[data-scene-action]')).toHaveCount(0)
  const shell = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  await expect.poll(async () => page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey), { timeout: 15_000 }).toBe('preparing')
  const preparationStartedAt = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeePreparationStartedAtKey)
  expect(typeof preparationStartedAt).toBe('number')
  const preparationRemainingMs = await page.evaluate(({ statusKey, startedAtKey, durationMs }) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    const state = save.sceneState?.['commercial-cafe'] ?? {}
    return state[statusKey] === 'preparing' && typeof state[startedAtKey] === 'number'
      ? durationMs - (Date.now() - state[startedAtKey])
      : null
  }, {
    statusKey: commercialCafeCoffeeStatusKey,
    startedAtKey: commercialCafeCoffeePreparationStartedAtKey,
    durationMs: commercialCafeCoffeePreparationDurationMs,
  })
  expect(preparationRemainingMs).not.toBeNull()
  expect(preparationRemainingMs).toBeGreaterThan(0)
  await meetLaoZhouAndStartNarrativeFromSeat(page)
  const cursorOneLineId = 'commercial-cafe-lao-zhou-first-lao-zhou'
  await advanceNarrativeToLine(page, cursorOneLineId)
  await advanceNarrativeToText(page, cursorOneLineId, '\u5b8c\u5168\u6ca1\u6709\u3002')
  const preGateStatus = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)
  expect(preGateStatus).toBe('preparing')
  const remainingBeforeCursorOneEnds = await page.evaluate(({ startedAtKey, durationMs }) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    const startedAt = save.sceneState?.['commercial-cafe']?.[startedAtKey]
    return typeof startedAt === 'number' ? durationMs - (Date.now() - startedAt) : null
  }, { startedAtKey: commercialCafeCoffeePreparationStartedAtKey, durationMs: commercialCafeCoffeePreparationDurationMs })
  expect(remainingBeforeCursorOneEnds).not.toBeNull()
  expect(remainingBeforeCursorOneEnds).toBeGreaterThan(0)
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await shell.getAttribute('data-commercial-cafe-narrative-phase') === 'coffee-delivery') break
    await page.waitForTimeout(350)
    await shield.click({ force: true })
  }
  await expect(shell).toHaveAttribute('data-commercial-cafe-narrative-phase', 'coffee-delivery')
  const now = await page.evaluate(() => Date.now())
  expect(now - preparationStartedAt).toBeLessThan(6000)
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('ready')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-actor-id="cafe-coffee-owner"]')).toHaveAttribute('data-npc-duty-id', 'cafe-coffee-owner.deliver-coffee', { timeout: 15_000 })
  await expect.poll(async () => page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey), { timeout: 30_000 }).toBe('delivered')
  await expect(shell).toHaveAttribute('data-commercial-cafe-cursor', '2')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('cafe-fast-forward-ready-arrival-delivered.png') })
})

test('a blocked coffee-owner delivery stays ready and recovers through the shared route after the obstruction leaves', async ({ page }) => {
  await enterCafeFromStreet(page, 'debugCafeServerBlocker=1&debugRuntimeEvidence=1')
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await (await advanceObservationToAction(page, '要点一杯咖啡吗？', '点一杯咖啡')).click()
  const shell = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-owner-phase', 'preparing', { timeout: 15_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('preparing')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-status', 'ready', { timeout: 20_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('ready')
  await meetLaoZhouAndStartNarrativeFromSeat(page)
  await advanceNarrativeToLine(page, 'commercial-cafe-lao-zhou-first-lao-zhou')
  await advanceNarrativeToText(page, 'commercial-cafe-lao-zhou-first-lao-zhou', '完全没有。')
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await shell.getAttribute('data-commercial-cafe-narrative-phase') === 'coffee-delivery') break
    await page.waitForTimeout(400)
    await shield.click({ force: true })
  }
  await expect(shell).toHaveAttribute('data-commercial-cafe-narrative-phase', 'coffee-delivery')
  await expect(shell).toHaveAttribute('data-commercial-cafe-coffee-status', 'ready')
  await expect(shell).toHaveAttribute('data-e2e-coffee-owner-blocker', '1')
  await page.waitForTimeout(1_000)
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('ready')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toHaveCount(0)
  await expect(shell).toHaveAttribute('data-commercial-cafe-cursor', '1')

  await page.goto('/?scene=commercial-cafe&debugRuntimeEvidence=1')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-coffee-status', 'ready')
  await page.waitForFunction((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key] === 'delivered'
  }, commercialCafeCoffeeStatusKey, { timeout: 30_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCoffeeStatusKey)).toBe('delivered')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-cursor', '2')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-xiujie-coffee"]')).toBeVisible()
})

test('narrative reload resumes at its persisted stable line and never requires coffee delivery', async ({ page }) => {
  await café(page)
  await startNarrative(page)
  await page.waitForTimeout(400)
  await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
  // The seat guide is now one readable segment, so advancing it moves to the
  // first Lao Zhou line and persists cursor 1 immediately.
  await expect(page.locator('[data-dialogue-line-id="commercial-cafe-lao-zhou-first-lao-zhou"]')).toBeVisible()
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
      [keys.status]: 'complete', [keys.cursor]: 14, [keys.coffeeStatus]: 'none', [keys.phase]: 'complete', [keys.completedAt]: Date.now(),
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, { status: commercialCafeStoryStatusKey, cursor: commercialCafeNarrativeCursorKey, coffeeStatus: commercialCafeCoffeeStatusKey, phase: commercialCafeNarrativePhaseKey, completedAt: commercialCafeCompletedAtKey })
  await page.reload()
  await expect(page.getByRole('button', { name: '老周，点击让主角前往互动' })).toBeVisible()
  await expect(page.locator('[data-attached-prop-id]')).toHaveCount(0)
  await page.evaluate(({ key, presenceMs }) => {
    const raw = localStorage.getItem('newtone-player-save-v1')!
    const save = JSON.parse(raw)
    save.sceneState['commercial-cafe'][key] = Date.now() - presenceMs
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, { key: commercialCafeCompletedAtKey, presenceMs: commercialCafeCompletionPresenceMs })
  await page.reload()
  await expect(page.getByRole('button', { name: '老周，点击让主角前往互动' })).toHaveCount(0)
  await page.waitForFunction((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeLaoZhouDepartureKey, { timeout: 5_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeLaoZhouDepartureKey)).toBe('departed')
})

test('Lao Zhou completes a real in-Café walkout only after passage crossing closes', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-01T12:00:00.000Z') })
  await enterCafeFromStreet(page, 'debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const stageBounds = await stage.boundingBox()
  expect(stageBounds).not.toBeNull()
  // Keep the protagonist inside the Café but clear the doorway using ordinary
  // movement, so Lao Zhou's route is tested against real actor occupancy.
  await page.mouse.click(stageBounds!.x + stageBounds!.width * .75, stageBounds!.y + stageBounds!.height * .45)
  await page.waitForFunction(() => {
    const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return actor && Number(actor.dataset.runtimeX) > 65
  }, undefined, { timeout: 20_000 })
  await page.addInitScript((keys) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected isolated player save')
    const save = JSON.parse(raw)
    const completedAt = Date.now() - keys.presenceMs + 1_500
    save.sceneState['commercial-cafe'] = {
      [keys.status]: 'complete',
      [keys.cursor]: 14,
      [keys.coffeeStatus]: 'none',
      [keys.phase]: 'complete',
      [keys.departure]: 'seated',
      [keys.completedAt]: completedAt,
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, {
    status: commercialCafeStoryStatusKey,
    cursor: commercialCafeNarrativeCursorKey,
    coffeeStatus: commercialCafeCoffeeStatusKey,
    phase: commercialCafeNarrativePhaseKey,
    departure: commercialCafeLaoZhouDepartureKey,
    completedAt: commercialCafeCompletedAtKey,
    presenceMs: commercialCafeCompletionPresenceMs,
  })
  await page.reload()
  const laoZhou = page.locator('[data-actor-id="lao-zhou"]')
  await expect(laoZhou).toBeVisible()
  const completedAt = await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeCompletedAtKey)
  expect(completedAt).toBeLessThan(Date.now() - commercialCafeCompletionPresenceMs + 2_000)

  await page.clock.runFor(1_600)
  await page.waitForFunction((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key] === 'walking-out'
  }, commercialCafeLaoZhouDepartureKey)
  const shell = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await shell.getAttribute('data-e2e-lao-zhou-exit-attempt') === 'approach-moving') break
    await page.clock.runFor(500)
  }
  const exitAttempt = await shell.getAttribute('data-e2e-lao-zhou-exit-attempt')
  const actorPositions = await page.locator('[data-actor-id]').evaluateAll((actors) => actors.map((actor) => {
    const element = actor as HTMLElement
    return { id: element.dataset.actorId, x: element.dataset.runtimeX, y: element.dataset.runtimeY, phase: element.dataset.npcPhase }
  }))
  expect(exitAttempt, JSON.stringify(actorPositions)).toBe('approach-moving')
  await expect(laoZhou).toHaveAttribute('data-npc-duty-id', 'lao-zhou.exit-cafe', { timeout: 10_000 })
  await page.clock.resume()
  await page.evaluate(() => {
    const target = window as Window & { __cafeWalkoutSamples?: Array<Record<string, unknown>>; __cafeWalkoutRaf?: number }
    target.__cafeWalkoutSamples = []
    const sample = () => {
      const actor = document.querySelector<HTMLElement>('[data-actor-id="lao-zhou"]')
      const door = document.querySelector<HTMLElement>('[data-focus-target-group="door:street-cafe-entry"]')
      target.__cafeWalkoutSamples!.push({
        time: performance.now(),
        exists: Boolean(actor),
        duty: actor?.dataset.npcDutyId ?? null,
        x: actor?.dataset.runtimeX ? Number(actor.dataset.runtimeX) : null,
        y: actor?.dataset.runtimeY ? Number(actor.dataset.runtimeY) : null,
        doorPhase: door?.dataset.focusPassagePhase ?? null,
      })
      if (target.__cafeWalkoutSamples!.length < 2400) target.__cafeWalkoutRaf = requestAnimationFrame(sample)
    }
    target.__cafeWalkoutRaf = requestAnimationFrame(sample)
  })
  await page.screenshot({ path: testInfo.outputPath('cafe-lao-zhou-walkout-start.png') })
  await page.waitForFunction(() => {
    const target = window as Window & { __cafeWalkoutSamples?: unknown[] }
    return (target.__cafeWalkoutSamples?.length ?? 0) >= 180
  }, undefined, { timeout: 8_000 })
  await testInfo.attach('lao-zhou-walkout-early-runtime-samples.json', {
    body: JSON.stringify(await page.evaluate(() => {
      const target = window as Window & { __cafeWalkoutSamples?: Array<Record<string, unknown>> }
      const samples = target.__cafeWalkoutSamples ?? []
      return { first: samples.slice(0, 5), latest: samples.slice(-10) }
    }), null, 2),
    contentType: 'application/json',
  })
  await expect(laoZhou).toHaveCount(0, { timeout: 20_000 })
  await page.waitForFunction((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeLaoZhouDepartureKey, { timeout: 5_000 })
  expect(await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.[key]
  }, commercialCafeLaoZhouDepartureKey)).toBe('departed')
  const samples = await page.evaluate(() => {
    const target = window as Window & { __cafeWalkoutSamples?: Array<{ time: number; exists: boolean; duty: string | null; x: number | null; y: number | null; doorPhase: string | null }> }
    return target.__cafeWalkoutSamples ?? []
  })
  expect(samples.some((sample) => sample.duty === 'lao-zhou.exit-cafe')).toBe(true)
  expect(new Set(samples.flatMap((sample) => sample.x === null ? [] : [sample.x])).size).toBeGreaterThan(1)
  const crossingIndex = samples.findIndex((sample) => sample.doorPhase === 'crossing')
  const removedIndex = samples.findIndex((sample) => !sample.exists)
  expect(crossingIndex).toBeGreaterThanOrEqual(0)
  expect(removedIndex).toBeGreaterThan(crossingIndex)
  expect(samples.slice(removedIndex).some((sample) => sample.doorPhase === 'closed')).toBe(true)
  await testInfo.attach('lao-zhou-walkout-runtime-samples.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' })
})

test('Café table prop compositions have real non-overlapping screenshots at four viewports', async ({ page }, testInfo) => {
  const scenarios = [
    { id: 'lao-zhou-coffee', coffee: false, tea: false, banknote: false, expected: ['commercial-cafe-lao-zhou-coffee'] },
    { id: 'coffee-and-milk-tea', coffee: false, tea: true, banknote: false, expected: ['commercial-cafe-lao-zhou-coffee', 'commercial-cafe-xiujie-milk-tea'] },
    { id: 'two-coffees', coffee: true, tea: false, banknote: false, expected: ['commercial-cafe-lao-zhou-coffee', 'commercial-cafe-xiujie-coffee'] },
    { id: 'two-coffees-and-milk-tea', coffee: true, tea: true, banknote: false, expected: ['commercial-cafe-lao-zhou-coffee', 'commercial-cafe-xiujie-coffee', 'commercial-cafe-xiujie-milk-tea'] },
    { id: 'two-coffees-and-banknote', coffee: true, tea: false, banknote: true, expected: ['commercial-cafe-lao-zhou-coffee', 'commercial-cafe-xiujie-coffee', 'commercial-cafe-banknote'] },
    { id: 'all-four-props', coffee: true, tea: true, banknote: true, expected: ['commercial-cafe-lao-zhou-coffee', 'commercial-cafe-xiujie-coffee', 'commercial-cafe-xiujie-milk-tea', 'commercial-cafe-banknote'] },
  ]
  const viewports = [
    { width: 1280, height: 720 },
    { width: 412, height: 915 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]
  await café(page, 'debugRuntimeEvidence=1')
  const boundsReport: Array<Record<string, unknown>> = []
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const scenario of scenarios) {
      await page.evaluate(({ scenarioState, teaKey }) => {
        const raw = localStorage.getItem('newtone-player-save-v1')
        if (!raw) throw new Error('Expected isolated player save')
        const save = JSON.parse(raw)
        const cafe = save.sceneState['commercial-cafe'] ?? {}
        Object.assign(cafe, {
          [scenarioState.statusKey]: scenarioState.banknote ? 'ready-to-leave' : 'available',
          [scenarioState.cursorKey]: scenarioState.banknote ? 14 : 0,
          [scenarioState.coffeeStatusKey]: scenarioState.coffee ? 'delivered' : 'none',
          [scenarioState.preparationStartedAtKey]: null,
          [scenarioState.phaseKey]: scenarioState.banknote ? 'complete' : 'not-started',
          [scenarioState.departureKey]: 'seated',
          [scenarioState.completedAtKey]: null,
        })
        save.sceneState['commercial-cafe'] = cafe
        const street = save.sceneState['commercial-street'] ?? {}
        if (scenarioState.tea) street[teaKey] = 'milk-tea'
        else delete street[teaKey]
        save.sceneState['commercial-street'] = street
        localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
      }, {
        scenarioState: {
          statusKey: commercialCafeStoryStatusKey,
          cursorKey: commercialCafeNarrativeCursorKey,
          coffeeStatusKey: commercialCafeCoffeeStatusKey,
          preparationStartedAtKey: commercialCafeCoffeePreparationStartedAtKey,
          phaseKey: commercialCafeNarrativePhaseKey,
          departureKey: commercialCafeLaoZhouDepartureKey,
          completedAtKey: commercialCafeCompletedAtKey,
          coffee: scenario.coffee,
          tea: scenario.tea,
          banknote: scenario.banknote,
        },
        teaKey: commercialStreetMilkTeaHeldDrinkKey,
      })
      await page.reload()
      const propLocator = page.locator('[data-attached-prop-id]')
      await expect(propLocator).toHaveCount(scenario.expected.length)
      await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-debug-runtime-evidence', 'true')
      const measured = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')
        const table = document.querySelector<HTMLElement>('[data-object-id="commercial-cafe-right-window-upper-group-table"]')
        const protagonist = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
        const laoZhou = document.querySelector<HTMLElement>('[data-actor-id="lao-zhou"]')
        const props = [...document.querySelectorAll<HTMLElement>('[data-attached-prop-id]')].map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            id: element.dataset.attachedPropId,
            kind: element.dataset.attachedPropKind,
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            ariaLabel: element.getAttribute('aria-label'),
            text: element.innerText,
            hasSvg: Boolean(element.querySelector('svg')),
          }
        })
        const rectanglesOverlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
        const overlaps = props.flatMap((first, index) => props.slice(index + 1).map((second) => ({ first: first.id, second: second.id, area: rectanglesOverlap(first, second) })))
        const stageRect = stage?.getBoundingClientRect()
        const tableText = table?.textContent ?? ''
        const protagonistRect = protagonist?.getBoundingClientRect()
        const laoZhouRect = laoZhou?.getBoundingClientRect()
        const protagonistOverlaps = protagonistRect ? props.map((prop) => ({ id: prop.id, area: rectanglesOverlap(prop, protagonistRect) })) : []
        const laoZhouOverlaps = laoZhouRect ? props.map((prop) => ({ id: prop.id, area: rectanglesOverlap(prop, laoZhouRect) })) : []
        const actorBounds = [protagonist, laoZhou].map((actor) => {
          const rect = actor?.getBoundingClientRect()
          return actor && rect ? { id: actor.dataset.actorId, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
        })
        return { props, overlaps, protagonistOverlaps, laoZhouOverlaps, actorBounds, tableText, stage: stageRect ? { x: stageRect.x, y: stageRect.y, width: stageRect.width, height: stageRect.height } : null }
      })
      expect(measured.props.map((prop) => prop.id).sort()).toEqual([...scenario.expected].sort())
      expect(measured.props.every((prop) => prop.hasSvg && !prop.text?.trim() && prop.width >= 20 && prop.height >= 20)).toBe(true)
      expect(measured.tableText).not.toContain('桌子')
      expect(measured.overlaps.every((pair) => pair.area === 0)).toBe(true)
      expect(measured.protagonistOverlaps.every((pair) => pair.area === 0), JSON.stringify({ viewport, scenario: scenario.id, measured })).toBe(true)
      expect(measured.laoZhouOverlaps.every((pair) => pair.area === 0), JSON.stringify({ viewport, scenario: scenario.id, measured })).toBe(true)
      expect(measured.stage).not.toBeNull()
      for (const prop of measured.props) {
        expect(prop.x).toBeGreaterThanOrEqual(measured.stage!.x)
        expect(prop.y).toBeGreaterThanOrEqual(measured.stage!.y)
        expect(prop.x + prop.width).toBeLessThanOrEqual(measured.stage!.x + measured.stage!.width)
        expect(prop.y + prop.height).toBeLessThanOrEqual(measured.stage!.y + measured.stage!.height)
      }
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await page.screenshot({ path: testInfo.outputPath(`table-${scenario.id}-${viewport.width}x${viewport.height}.png`) })
      boundsReport.push({ viewport, scenario: scenario.id, ...measured })
    }
  }
  await testInfo.attach('cafe-table-prop-bounds.json', { body: JSON.stringify(boundsReport, null, 2), contentType: 'application/json' })
})

import { expect, test, type Page } from '@playwright/test'
import { commercialStreetQuestionNarrativeAnchor } from '../src/center/runtime/commercialStreetQuestionNarrative'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { commercialStreetMilkTeaReadyAtKey } from '../src/center/runtime/commercialStreetMilkTea'
import { commercialCafeCoffeeDeliveredKey, commercialCafeCoffeeOrderedKey, commercialCafeNarrativeCursorKey, commercialCafeStoryStatusKey } from '../src/center/runtime/commercialCafeStory'

const analyticsBaseUrl = process.env.CHAPTER_TWO_ANALYTICS_BASE_URL
test.skip(!analyticsBaseUrl, 'requires the isolated fake analytics endpoint server')
test.use({ viewport: { width: 1280, height: 720 } })

async function clickWorldPoint(page: Page, point: { x: number; y: number }) {
  const stage = page.locator('.mainline-scene-stage')
  const screenPoint = await stage.evaluate((element, target) => {
    const rect = element.getBoundingClientRect()
    const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
    const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
    return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
  }, point)
  await stage.click({ position: screenPoint })
}

function eventNames(events: readonly { event_name: string }[]) {
  return events.map((event) => event.event_name)
}

function requestHasEvent(request: { url(): string; postData(): string | null }, eventName: string) {
  if (!request.url().startsWith('https://analytics.test/rest/v1/analytics_events')) return false
  try {
    const body = JSON.parse(request.postData() ?? '[]')
    return (Array.isArray(body) ? body : [body]).some((event) => event?.event_name === eventName)
  }
  catch {
    return false
  }
}

function waitForAnalyticsEvent(page: Page, eventName: string) {
  return page.waitForRequest((request) => requestHasEvent(request, eventName))
}

async function triggerStorefrontInteraction(page: Page, label: string) {
  // This analytics contract needs to cover the storefront's ordinary React
  // handler after the question has panned the camera elsewhere. Existing
  // storefront E2E owns the physical, visible-sign route; invoking the same
  // button handler here keeps this suite about request/payload ownership.
  await page.getByRole('button', { name: label, exact: true }).evaluate((element: HTMLButtonElement) => element.click())
}

test('Chapter Two emits constrained browser analytics without requiring a real database', async ({ page }) => {
  const events: Array<Record<string, unknown>> = []
  await page.route('https://analytics.test/rest/v1/analytics_events**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '[]')
    events.push(...(Array.isArray(body) ? body : [body]))
    await route.fulfill({ status: 201, body: '' })
  })

  const streetEntered = waitForAnalyticsEvent(page, 'commercial_street_entered')
  await page.goto(`${analyticsBaseUrl}/?scene=commercial-street&debugRuntimeEvidence=1`)
  await streetEntered

  const anchor = commercialStreetQuestionNarrativeAnchor(mainlineScenes['commercial-street'])
  const approach = { x: anchor.x - mainlineScenes['commercial-street'].walkBounds.height * .3, y: anchor.y }
  await clickWorldPoint(page, approach)
  await expect(page.locator('[data-actor-id="protagonist"]')).toHaveAttribute('data-runtime-x', `${approach.x}`, { timeout: 15_000 })
  await clickWorldPoint(page, anchor)
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  const questionDialogue = page.locator('[data-scene-dialogue="commercial-street-question"]')
  await expect(shield).toBeVisible({ timeout: 15_000 })
  await shield.click()
  await expect(questionDialogue).toContainText('不，不会认错的。')
  await shield.click()
  await expect(questionDialogue).toContainText('那张脸修杰太过于熟悉。')
  const questionCompleted = waitForAnalyticsEvent(page, 'commercial_question_completed')
  await shield.click()
  await expect(questionDialogue).toBeHidden({ timeout: 5_000 })
  await expect(shield).toHaveCount(0)
  await questionCompleted

  const fruitObserved = waitForAnalyticsEvent(page, 'commercial_storefront_interacted')
  await triggerStorefrontInteraction(page, '果茶店')
  await expect(page.locator('[data-scene-echo="commercial-north-slot-1"]')).toBeVisible({ timeout: 30_000 })
  await fruitObserved

  const teaUnlocked = waitForAnalyticsEvent(page, 'milk_tea_app_unlocked')
  await triggerStorefrontInteraction(page, '奶茶店')
  await teaUnlocked
  const phone = page.locator('.world-phone')
  await expect(phone.getByText('远程点单', { exact: true })).toBeVisible({ timeout: 30_000 })
  const teaStarted = waitForAnalyticsEvent(page, 'milk_tea_order_started')
  await phone.getByRole('button', { name: '原味奶茶', exact: true }).click()
  await teaStarted
  await phone.getByRole('button', { name: '少糖', exact: true }).click()
  await phone.getByRole('button', { name: '去冰', exact: true }).click()
  const teaConfirmed = waitForAnalyticsEvent(page, 'milk_tea_order_confirmed')
  await phone.getByRole('button', { name: '确认下单', exact: true }).click()
  await teaConfirmed

  await page.evaluate((readyAtKey) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected local player save')
    const save = JSON.parse(raw)
    save.sceneState['commercial-street'][readyAtKey] = Date.now() - 1
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, commercialStreetMilkTeaReadyAtKey)
  await page.reload()
  await page.getByLabel('打开手机').click()
  const teaReady = waitForAnalyticsEvent(page, 'milk_tea_order_ready')
  await phone.locator('[data-app="milk-tea"]').click()
  await expect(phone.getByText('已完成', { exact: true })).toBeVisible()
  await teaReady
  await page.getByLabel('收起手机').click()
  const teaPickedUp = waitForAnalyticsEvent(page, 'milk_tea_order_picked_up')
  await triggerStorefrontInteraction(page, '奶茶店')
  await expect(page.locator('.scene-protagonist__drink-icon--milk-tea')).toBeVisible({ timeout: 15_000 })
  await teaPickedUp

  expect(eventNames(events as Array<{ event_name: string }>)).toEqual(expect.arrayContaining([
    'commercial_question_triggered', 'commercial_question_completed', 'commercial_storefront_interacted',
    'milk_tea_app_unlocked', 'milk_tea_order_started', 'milk_tea_order_confirmed',
    'milk_tea_order_ready', 'milk_tea_order_picked_up',
  ]))
  const order = events.find((event) => event.event_name === 'milk_tea_order_confirmed')
  expect(order?.event_data).toMatchObject({ drink: '原味奶茶', sugar: '少糖', ice: '去冰', orderNumber: 1 })
  expect(events.every((event) => typeof event.event_data === 'object')).toBe(true)
})

test('Café records only durable story milestones and completion transitions', async ({ page }) => {
  const events: Array<Record<string, unknown>> = []
  await page.route('https://analytics.test/rest/v1/analytics_events**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '[]')
    events.push(...(Array.isArray(body) ? body : [body]))
    await route.fulfill({ status: 201, body: '' })
  })
  await page.goto(`${analyticsBaseUrl}/?scene=commercial-cafe&debugCafeFixture=1`)
  const coffeeOrdered = waitForAnalyticsEvent(page, 'cafe_coffee_ordered')
  await page.getByRole('button', { name: '柜台' }).first().click()
  await page.getByRole('button', { name: '点一杯咖啡', exact: true }).click()
  await coffeeOrdered

  await page.evaluate((keys) => {
    const raw = localStorage.getItem('newtone-player-save-v1')
    if (!raw) throw new Error('Expected local player save')
    const save = JSON.parse(raw)
    const sceneState = save.sceneState['commercial-cafe'] ?? {}
    save.sceneState['commercial-cafe'] = {
      ...sceneState,
      [keys.status]: 'available',
      [keys.cursor]: 13,
      [keys.coffeeOrdered]: true,
      [keys.coffeeDelivered]: false,
    }
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
  }, { status: commercialCafeStoryStatusKey, cursor: commercialCafeNarrativeCursorKey, coffeeOrdered: commercialCafeCoffeeOrderedKey, coffeeDelivered: commercialCafeCoffeeDeliveredKey })
  await page.reload()
  const readyToLeave = waitForAnalyticsEvent(page, 'cafe_ready_to_leave')
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(shield).toBeVisible({ timeout: 15_000 })
  await shield.click()
  await expect(shield).toHaveCount(0)
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveAttribute('data-commercial-cafe-status', 'ready-to-leave')
  await readyToLeave
  const completed = waitForAnalyticsEvent(page, 'cafe_completed')
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 30_000 })
  await completed
  expect(eventNames(events as Array<{ event_name: string }>)).toEqual(expect.arrayContaining([
    'cafe_coffee_ordered', 'cafe_story_stage_reached', 'cafe_ready_to_leave', 'cafe_banknote_presented', 'cafe_completed',
  ]))
  const stages = events.filter((event) => event.event_name === 'cafe_story_stage_reached').map((event) => (event.event_data as { stage?: string }).stage)
  expect(stages).toEqual(expect.arrayContaining(['ready-to-leave', 'complete']))
})

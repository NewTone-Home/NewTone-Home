import { expect, test, type Page } from '@playwright/test'

const analyticsBaseUrl = process.env.CHAPTER_TWO_ANALYTICS_BASE_URL
const analyticsApiUrl = process.env.CHAPTER_TWO_ANALYTICS_API_URL
test.skip(!analyticsBaseUrl || !analyticsApiUrl, 'requires the isolated fake analytics endpoint server')
test.use({ viewport: { width: 1280, height: 720 } })

function requestEvents(request: { url(): string; postData(): string | null }) {
  if (!analyticsApiUrl || !request.url().startsWith(`${analyticsApiUrl}/rest/v1/analytics_events`)) return []
  try {
    const body = JSON.parse(request.postData() ?? '[]')
    return Array.isArray(body) ? body : [body]
  } catch {
    return []
  }
}

async function finishObservation(page: Page, selector: string) {
  const echo = page.locator(selector)
  await expect(echo).toBeVisible({ timeout: 15_000 })
  const segmentCount = Number(await echo.getAttribute('data-scene-segment-count'))
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    await expect(echo).toHaveAttribute('data-scene-segment-index', String(segmentIndex))
    if (await echo.getAttribute('data-scene-observation-typing') === 'true') {
      await shield.click()
      await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false')
    }
    if (segmentIndex < segmentCount - 1) {
      await shield.click()
      await expect(echo).toHaveAttribute('data-scene-segment-index', String(segmentIndex + 1))
    }
  }
  await expect(echo).toHaveAttribute('data-scene-segment-advance', 'complete')
  await shield.click()
  await expect(echo).toHaveCount(0)
}

async function finishDialogue(page: Page, selector: string) {
  const dialogue = page.locator(selector)
  await expect(dialogue).toBeVisible({ timeout: 15_000 })
  const segmentCount = Number(await dialogue.getAttribute('data-scene-segment-count'))
  const shield = page.locator('[data-scene-dialogue-shield="true"]')
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    await expect(dialogue).toHaveAttribute('data-scene-segment-index', String(segmentIndex))
    await expect(dialogue).toHaveAttribute('data-scene-dialogue-ready', 'true')
    if (segmentIndex < segmentCount - 1) {
      await shield.click()
      await expect(dialogue).toHaveAttribute('data-scene-segment-index', String(segmentIndex + 1))
    }
  }
  await expect(dialogue).toHaveAttribute('data-scene-segment-advance', 'complete')
  await expect(dialogue).toHaveAttribute('data-scene-dialogue-ready', 'true')
  await shield.click()
  await expect(dialogue).toHaveCount(0)
}

function waitForAnalyticsEvent(page: Page, predicate: (event: Record<string, unknown>) => boolean) {
  return page.waitForRequest((request) => requestEvents(request).some(predicate), { timeout: 15_000 })
    .then(async request => {
      await request.response()
      return request
    })
}

test('session trajectory batches a privacy-safe ordered Center journey and survives reload', async ({ page }) => {
  const events: Array<Record<string, unknown>> = []
  await page.route(`${analyticsApiUrl}/rest/v1/analytics_events**`, async (route) => {
    const received = requestEvents(route.request())
    events.push(...received)
    await route.fulfill({ status: 201, body: '' })
  })

  await page.goto(`${analyticsBaseUrl}/?scene=jijia-ancestral-home&debugRuntimeEvidence=1`)
  await expect(page.locator('.scene-shell[data-mainline-scene="jijia-ancestral-home"]')).toBeVisible()
  const tree = page.locator('[data-object-id="jijia-old-tree"]')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const requested = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_requested' && event.object_id === 'jijia-old-tree')
    const completed = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_completed' && event.object_id === 'jijia-old-tree')
    await tree.click()
    await Promise.all([requested, completed])
    await finishObservation(page, '[data-scene-echo="jijia-old-tree"]')
  }

  const phoneOpened = waitForAnalyticsEvent(page, event => event.event_name === 'center_phone_opened')
  await page.getByLabel('打开手机').click()
  await expect(page.locator('.world-phone')).toBeVisible()
  await phoneOpened
  const phoneClosed = waitForAnalyticsEvent(page, event => event.event_name === 'center_phone_closed')
  await page.getByLabel('收起手机').click()
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-open', 'false')
  await expect(page.locator('.world-phone [role="dialog"]')).toHaveAttribute('aria-hidden', 'true')
  await phoneClosed

  const door = page.locator('[data-focus-target-group="door:jijia-main-door"]').first()
  const sceneExit = waitForAnalyticsEvent(page, event => event.event_name === 'center_scene_exited')
  await door.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="jijia-ancestral-interior"]')).toBeVisible({ timeout: 30_000 })
  await sceneExit

  const checkpoint = waitForAnalyticsEvent(page, event => event.event_name === 'session_checkpoint')
  const beforeReload = [...events]
  const sessionIds = new Set(beforeReload.map((event) => event.session_id))
  expect(sessionIds.size).toBe(1)
  expect(beforeReload.filter((event) => event.event_name === 'center_interaction_requested' && event.object_id === 'jijia-old-tree')).toHaveLength(3)
  expect(beforeReload.filter((event) => event.event_name === 'center_interaction_completed' && event.object_id === 'jijia-old-tree')).toHaveLength(3)
  const previousLastSequence = Math.max(...beforeReload.map((event) => Number(event.sequence)))
  const reloadEntered = page.waitForRequest((request) => requestEvents(request).some((event) => event.event_name === 'center_scene_entered'))
  const checkpointRequest = checkpoint
  await page.reload()
  await Promise.all([reloadEntered, checkpointRequest])

  expect(events.every((event) => event.session_id === [...sessionIds][0])).toBe(true)
  expect(events.some((event) => Number(event.sequence) > previousLastSequence)).toBe(true)
  const ordered = events.map((event) => Number(event.sequence))
  expect(ordered.every((sequence, index) => index === 0 || sequence > ordered[index - 1])).toBe(true)
  expect(events.every((event) => typeof event.occurred_at === 'string' && Number.isFinite(Date.parse(event.occurred_at as string)))).toBe(true)
  expect(events.some((event) => event.event_name === 'center_position_sample'
    && Number.isFinite(Number(event.position_x)) && Number.isFinite(Number(event.position_y)))).toBe(true)
  expect(events.filter((event) => event.event_name !== 'center_position_sample')
    .every((event) => event.position_x === null && event.position_y === null)).toBe(true)
  expect(events.some((event) => event.event_name === 'center_phone_opened')).toBe(true)
  expect(events.some((event) => event.event_name === 'center_phone_closed')).toBe(true)
  expect(events.some((event) => event.event_name === 'center_reading_started')).toBe(true)
  expect(events.some((event) => event.event_name === 'center_reading_ended')).toBe(true)
  expect(events.some((event) => event.event_name === 'center_scene_exited')).toBe(true)
  expect(events.some((event) => event.event_name === 'session_checkpoint')).toBe(true)
  expect(events.every((event) => !('freeText' in (event.event_data as object ?? {}))
    && !('dialogueText' in (event.event_data as object ?? {})))).toBe(true)
})

test('a new page keeps the anonymous visitor but starts a distinct analytics session', async ({ page }) => {
  const routeAnalytics = async (requestPage: Page) => {
    await requestPage.route(`${analyticsApiUrl}/rest/v1/analytics_events**`, async (route) => {
      await route.fulfill({ status: 201, body: '' })
    })
  }

  await routeAnalytics(page)
  const firstEntered = waitForAnalyticsEvent(page, event => event.event_name === 'center_scene_entered')
  await page.goto(`${analyticsBaseUrl}/?scene=jijia-ancestral-home&debugRuntimeEvidence=1`)
  await expect(page.locator('.scene-shell[data-mainline-scene="jijia-ancestral-home"]')).toBeVisible()
  const first = requestEvents(await firstEntered).find(event => event.event_name === 'center_scene_entered')!

  const nextPage = await page.context().newPage()
  await routeAnalytics(nextPage)
  const secondEntered = waitForAnalyticsEvent(nextPage, event => event.event_name === 'center_scene_entered')
  await nextPage.goto(`${analyticsBaseUrl}/?scene=jijia-ancestral-home&debugRuntimeEvidence=1`)
  await expect(nextPage.locator('.scene-shell[data-mainline-scene="jijia-ancestral-home"]')).toBeVisible()
  const second = requestEvents(await secondEntered).find(event => event.event_name === 'center_scene_entered')!

  expect(second.visitor_id).toBe(first.visitor_id)
  expect(second.session_id).not.toBe(first.session_id)
  await nextPage.close()
})

test('seat, NPC, locked door, and storefront each report one requested and their real outcome', async ({ page }) => {
  const events: Array<Record<string, unknown>> = []
  await page.route(`${analyticsApiUrl}/rest/v1/analytics_events**`, async (route) => {
    events.push(...requestEvents(route.request()))
    await route.fulfill({ status: 201, body: '' })
  })
  await page.goto(`${analyticsBaseUrl}/?scene=commercial-cafe&debugRuntimeEvidence=1`)

  const lockedRequest = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_requested' && event.object_id === 'cafe-back-door')
  const lockedBlocked = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_blocked' && event.object_id === 'cafe-back-door')
  await page.locator('[data-focus-target-group="door:cafe-back-door"]').first().click()
  await Promise.all([lockedRequest, lockedBlocked])

  const npcRequested = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_requested' && event.object_id === 'lao-zhou')
  const npcCompleted = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_completed' && event.object_id === 'lao-zhou')
  await page.getByRole('button', { name: '老周，点击让主角前往互动' }).click()
  await Promise.all([npcRequested, npcCompleted])
  await finishDialogue(page, '[data-dialogue-line-id="commercial-cafe-lao-zhou-seat-guide"]')

  const seatId = 'commercial-cafe-right-window-upper-group-chair-bottom'
  const seatRequested = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_requested' && event.object_id === seatId)
  const seatCompleted = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_completed' && event.object_id === seatId)
  await page.locator(`[data-object-id="${seatId}"]`).click()
  await Promise.all([seatRequested, seatCompleted])
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible({ timeout: 30_000 })

  for (const objectId of ['cafe-back-door', 'lao-zhou', seatId]) {
    expect(events.filter(event => event.event_name === 'center_interaction_requested' && event.object_id === objectId)).toHaveLength(1)
  }
  expect(events.filter(event => event.event_name === 'center_interaction_blocked' && event.object_id === 'cafe-back-door')).toHaveLength(1)
  expect(events.filter(event => event.event_name === 'center_interaction_completed' && event.object_id === 'cafe-back-door')).toHaveLength(0)
  expect(events.filter(event => event.event_name === 'center_interaction_completed' && event.object_id === 'lao-zhou')).toHaveLength(1)
  expect(events.filter(event => event.event_name === 'center_interaction_completed' && event.object_id === seatId)).toHaveLength(1)
})

test('storefront request is counted once and completion waits for the actual interaction', async ({ page }) => {
  const events: Array<Record<string, unknown>> = []
  await page.route(`${analyticsApiUrl}/rest/v1/analytics_events**`, async (route) => {
    events.push(...requestEvents(route.request()))
    await route.fulfill({ status: 201, body: '' })
  })
  await page.goto(`${analyticsBaseUrl}/?scene=commercial-street&debugRuntimeEvidence=1`)
  const storefrontId = 'commercial-north-slot-1'
  const requested = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_requested' && event.object_id === storefrontId)
  const completed = waitForAnalyticsEvent(page, event => event.event_name === 'center_interaction_completed' && event.object_id === storefrontId)
  await page.getByRole('button', { name: '果茶店', exact: true }).evaluate((element: HTMLButtonElement) => element.click())
  await Promise.all([requested, completed])

  expect(events.filter(event => event.event_name === 'center_interaction_requested' && event.object_id === storefrontId)).toHaveLength(1)
  expect(events.filter(event => event.event_name === 'center_interaction_completed' && event.object_id === storefrontId)).toHaveLength(1)
  expect(events.filter(event => event.event_name === 'center_interaction_blocked' && event.object_id === storefrontId)).toHaveLength(0)
})

import { expect, test, type Page } from '@playwright/test'

const playerSaveKey = 'newtone-player-save-v1'
const eatery = '.scene-shell[data-mainline-scene="yonghe-eatery"]'

async function openEatery(page: Page, width = 1280, height = 800) {
  await page.setViewportSize({ width, height })
  await page.addInitScript((key) => { localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1'); if (sessionStorage.getItem('yonghe-survey-fixture') !== 'ready') { localStorage.removeItem(key); sessionStorage.setItem('yonghe-survey-fixture', 'ready') } }, playerSaveKey)
  await page.goto('/?scene=yonghe-eatery')
  await expect(page.locator(eatery)).toBeVisible()
}

async function waitForPoint(page: Page, point: string, status: 'in-progress' | 'complete') {
  await expect.poll(() => page.evaluate(({ playerSaveKey, point }) => {
    const save = JSON.parse(localStorage.getItem(playerSaveKey) ?? '{}')
    return save.sceneState?.['yonghe-eatery']?.[point]
  }, { playerSaveKey, point })).toBe(true)
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', status)
}

async function closeObservation(page: Page) {
  const echo = page.locator('[data-scene-echo]')
  const shield = page.locator('[data-scene-dialogue-shield]')
  for (let index = 0; index < 8; index += 1) {
    if (await echo.count() === 0) return
    if (await shield.count() === 0) {
      await expect(echo).toHaveCount(0, { timeout: 5_000 })
      return
    }
    if (await echo.getAttribute('data-scene-observation-typing') === 'true') {
      await shield.click({ force: true })
      await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 10_000 })
    }
    await shield.click({ force: true })
  }
  await expect(echo).toHaveCount(0, { timeout: 5_000 })
}
async function inspect(page: Page, entityId: string, point: string, status: 'in-progress' | 'complete') {
  const observation = entityId === 'yonghe-back-door'
    ? page.locator('[data-focus-target-group="door:yonghe-back-door"]')
    : page.locator('[data-object-id="' + entityId + '"]')
  await observation.click()
  await waitForPoint(page, point, status)
  await closeObservation(page)
}

test('desktop: fresh and legacy saves, early exit, and reentry persistence', async ({ page }, testInfo) => {
  await openEatery(page)
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'not-started')
  await page.screenshot({ path: testInfo.outputPath('yonghe-desktop-start.png') })

  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')
  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-eatery'] ?? {}
    return Object.entries(state).filter(([key, value]) => key.startsWith('yongheSurveyPoint:') && value === true).length
  })).toBe(1)
  await page.reload()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'in-progress')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-eatery']?.['yongheSurveyPoint:tables'])).toBe(true)

  const frontDoor = page.locator('[data-focus-target-group="door:yonghe-street-entry"]')
  await expect(frontDoor).toBeVisible()
  await frontDoor.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]')).toBeVisible({ timeout: 15_000 })

  const streetEntry = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"] [data-storefront-cell-id][data-focus-target-policy="passage"]')
  await expect(streetEntry).toBeVisible()
  await streetEntry.click()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'in-progress', { timeout: 15_000 })

  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    _version: 1,
    currentSceneId: 'yonghe-eatery',
    currentPosition: null,
    scenePositions: {},
    phoneDevice: 'surface',
    sceneState: {
      'yonghe-eatery': {
        'interactionExplored:yonghe-upper-left-group-table': true,
        'interactionExplored:yonghe-counter': true,
        'interactionExplored:yonghe-back-door': true,
      },
    },
    updatedAt: 1,
  })), playerSaveKey)
  await page.goto('/?scene=yonghe-eatery')
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'not-started')
})

test('390x844 mobile: all four observations complete in any order and survive refresh', async ({ page }, testInfo) => {
  await openEatery(page, 390, 844)
  await page.screenshot({ path: testInfo.outputPath('yonghe-mobile-start.png') })
  for (const entityId of [
    'yonghe-counter',
    'yonghe-survey-central-lane',
    'yonghe-back-door',
    'yonghe-upper-left-group-table',
  ]) {
    const point = entityId === 'yonghe-upper-left-group-table' ? 'tables'
      : entityId === 'yonghe-counter' ? 'counter'
        : entityId === 'yonghe-survey-central-lane' ? 'central-lane'
          : 'back-door'
    const seen = await page.evaluate(({ playerSaveKey, point }) =>
      JSON.parse(localStorage.getItem(playerSaveKey) ?? '{}').sceneState?.['yonghe-eatery']?.['yongheSurveyPoint:' + point] === true,
    { playerSaveKey, point })
    const currentStatus = entityId === 'yonghe-upper-left-group-table' ? 'complete' : 'in-progress'
    if (!seen) await inspect(page, entityId, 'yongheSurveyPoint:' + point, currentStatus)
  }

  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'complete')
  await page.screenshot({ path: testInfo.outputPath('yonghe-mobile-complete.png') })
  await page.reload()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'complete')
  await expect(page.locator('[data-object-id="yonghe-survey-central-lane"]')).toBeVisible()
  await expect(page.locator('[data-object-id="yonghe-counter"]')).toBeVisible()
})

test('legal isolated save: perimeter, eatery round trip, ride map, and Café entry', async ({ page }, testInfo) => {
  await page.addInitScript((key) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem(key, JSON.stringify({
      _version: 1,
      currentSceneId: 'yonghe-mining-perimeter',
      currentPosition: { x: 50, y: 56 },
      scenePositions: { 'yonghe-mining-perimeter': { x: 50, y: 56 } },
      phoneDevice: 'inner',
      sceneState: {},
      updatedAt: 1,
    }))
  }, playerSaveKey)
  await page.goto('/')
  const perimeter = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]')
  await expect(perimeter).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-perimeter-start.png') })

  await perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]').click()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'not-started', { timeout: 15_000 })
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-eatery-first-entry.png') })
  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')

  await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
  await expect(perimeter).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(eatery)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-early-exit.png') })
  await perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]').click()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'in-progress', { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-eatery']?.['yongheSurveyPoint:tables'])).toBe(true)

  for (const [entity, point, status] of [
    ['yonghe-back-door', 'back-door', 'in-progress'],
    ['yonghe-counter', 'counter', 'in-progress'],
    ['yonghe-survey-central-lane', 'central-lane', 'complete'],
  ] as const) await inspect(page, entity, 'yongheSurveyPoint:' + point, status)
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'complete')
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-survey-complete.png') })

  await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
  await expect(perimeter).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(eatery)).toHaveCount(0)
  await page.locator('.world-phone__handle').click()
  const phone = page.locator('.world-phone[data-phone-open="true"]')
  await expect(phone).toBeVisible()
  await phone.locator('[data-app="ride"]').click()
  const destination = phone.locator('.world-phone__ride-destination').filter({ hasText: '商业街' })
  await expect(destination).toBeVisible({ timeout: 10_000 })
  await destination.click()
  await phone.locator('.world-phone__vehicles button').first().click()
  await phone.locator('.world-phone__list-action').click()
  await expect(page.locator('.world-phone__ride-order-state')).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.world-phone[data-phone-open="false"]')).toBeVisible({ timeout: 5_000 })
  for (let step = 0; step < 8; step += 1) {
    const currentScene = await page.locator('.scene-shell').getAttribute('data-mainline-scene')
    if (currentScene === 'commercial-street') break
    const stage = page.locator('.scene-stage')
    const box = await stage.boundingBox()
    if (!box) throw new Error('Scene stage unavailable while approaching the ride pickup')
    await stage.click({ position: { x: box.width / 2, y: box.height * 0.96 } })
    await page.waitForTimeout(800)
  }
  await expect.poll(() => page.locator('.scene-shell').getAttribute('data-mainline-scene'), { timeout: 20_000 }).toBe('commercial-street')
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-commercial-street-arrival.png') })

  const cafeDoor = page.locator('.scene-shell[data-mainline-scene="commercial-street"] [data-focus-target-group="door:street-cafe-entry"]')
  await expect(cafeDoor).toBeVisible({ timeout: 15_000 })
  await cafeDoor.click()
  const cafe = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  await expect(cafe).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-eatery"]')).toHaveCount(0)
  await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(0)
  await expect(cafe).toHaveAttribute('data-commercial-cafe-narrative-phase', 'not-started')
  await expect(cafe).toHaveAttribute('data-commercial-cafe-status', 'available')
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-cafe-entry.png') })
})

test('rapid front-door round trips keep one scene active and preserve survey state', async ({ page }, testInfo) => {
  await page.addInitScript((key) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem(key, JSON.stringify({
      _version: 1,
      currentSceneId: 'yonghe-mining-perimeter',
      currentPosition: { x: 42, y: 41 },
      scenePositions: { 'yonghe-mining-perimeter': { x: 42, y: 41 } },
      phoneDevice: 'inner',
      sceneState: { 'yonghe-eatery': { 'yongheSurveyPoint:tables': true, yongheSurveyStatus: 'in-progress' } },
      updatedAt: 1,
    }))
  }, playerSaveKey)
  await page.goto('/')

  const perimeter = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]')
  const inside = page.locator(eatery)
  await expect(perimeter).toBeVisible()

  for (let round = 0; round < 2; round += 1) {
    const entry = perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]')
    await entry.click()
    await expect(inside).toBeVisible({ timeout: 15_000 })
    await expect(perimeter).toHaveCount(0)

    await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
    await expect(perimeter).toBeVisible({ timeout: 15_000 })
    await expect(inside).toHaveCount(0)
    await expect.poll(() => page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key) ?? '{}').sceneState?.['yonghe-eatery']?.['yongheSurveyPoint:tables'], playerSaveKey,
    )).toBe(true)
  }

  await page.screenshot({ path: testInfo.outputPath('yonghe-doorway-round-trip.png') })
})

test('Chinese observation copy is presented as an in-scene observation', async ({ page }) => {
  await openEatery(page)
  await page.locator('[data-object-id="yonghe-survey-central-lane"]').click()
  await expect(page.locator('[data-scene-text-mode="observation"]')).toContainText('通道足够让人走过', { timeout: 15_000 })
})

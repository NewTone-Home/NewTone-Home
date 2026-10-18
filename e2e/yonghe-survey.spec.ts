import { expect, test, type Page } from '@playwright/test'
import { openRideArrivalNotification } from './phoneRideNotification'
import { mainlineRidePickupPositions } from '../src/center/runtime/mainlineRide'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const playerSaveKey = 'newtone-player-save-v1'
const eatery = '.scene-shell[data-mainline-scene="yonghe-eatery"][data-world-scene="yonghe-mining-perimeter"]'

async function openEatery(page: Page, width = 1280, height = 800) {
  await page.setViewportSize({ width, height })
  await page.addInitScript((key) => { localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1'); if (sessionStorage.getItem('yonghe-survey-fixture') !== 'ready') { localStorage.removeItem(key); sessionStorage.setItem('yonghe-survey-fixture', 'ready') } }, playerSaveKey)
  await page.goto('/?scene=yonghe-eatery')
  await expect(page.locator(eatery)).toBeVisible()
}

async function waitForPoint(page: Page, point: string, status: 'in-progress' | 'complete') {
  await expect.poll(() => page.evaluate(({ playerSaveKey, point }) => {
    const save = JSON.parse(localStorage.getItem(playerSaveKey) ?? '{}')
    return save.sceneState?.['yonghe-mining-perimeter']?.[point]
  }, { playerSaveKey, point })).toBe(true)
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', status)
}

async function closeObservation(page: Page) {
  const echo = page.locator('[data-scene-echo]')
  const shield = page.locator('[data-scene-dialogue-shield]')
  for (let index = 0; index < 8; index += 1) {
    if (await echo.count() === 0) return
    if (await shield.count() === 0) {
      await page.waitForTimeout(100)
      continue
    }
    if (await echo.getAttribute('data-scene-observation-typing') === 'true') {
      await shield.click({ force: true, timeout: 1_000 }).catch(() => undefined)
      await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0, { timeout: 10_000 })
    }
    if (await shield.count()) await shield.click({ force: true, timeout: 1_000 }).catch(() => undefined)
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

async function clickWorldPoint(page: Page, target: { x: number; y: number }) {
  const screen = await page.locator('.mainline-scene-stage').evaluate((element, point) => {
    const rect = element.getBoundingClientRect()
    const world = element.querySelector<HTMLElement>('.scene-mainline-world')
    if (!world) throw new Error('Mainline world layer is missing')
    const offset = world.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)
    if (!offset) throw new Error('Mainline camera offset is unavailable')
    return {
      x: rect.x + rect.width * (point.x + Number(offset[1])) / 100,
      y: rect.y + rect.height * (point.y + Number(offset[2])) / 100,
    }
  }, target)
  await page.mouse.click(screen.x, screen.y)
}

async function walkToWorldPoint(page: Page, target: { x: number; y: number }, reachTarget = false) {
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (let step = 0; step < 24; step += 1) {
    const distance = await actor.evaluate((element, point) => Math.hypot(
      Number((element as HTMLElement).dataset.runtimeX) - point.x,
      Number((element as HTMLElement).dataset.runtimeY) - point.y,
    ), target)
    if (distance < 1.25) return
    const stage = page.locator('.mainline-scene-stage')
    const projected = await stage.evaluate((element, point) => {
      const rect = element.getBoundingClientRect()
      const world = element.querySelector<HTMLElement>('.scene-mainline-world')
      if (!world) throw new Error('Mainline world layer is missing')
      const offset = world.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)
      const x = rect.x + rect.width * (point.x + Number(offset?.[1] ?? 0)) / 100
      const y = rect.y + rect.height * (point.y + Number(offset?.[2] ?? 0)) / 100
      return {
        x: Math.max(rect.x + 20, Math.min(rect.right - 20, x)),
        y: Math.max(rect.y + 20, Math.min(rect.bottom - 30, y)),
        targetVisible: x >= rect.x && x <= rect.right && y >= rect.y && y <= rect.bottom,
      }
    }, target)
    if (projected.targetVisible && !reachTarget) return
    const sourceSceneId = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
    await page.mouse.click(projected.x, projected.y)
    await expect.poll(async () => {
      const nextSceneId = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
      const moving = await page.locator('[data-actor-id="protagonist"]').getAttribute('class')
      const travelVisible = await page.locator('.center-long-distance-travel').count() > 0
      const travelPhase = await page.locator('.center-experience').getAttribute('data-long-distance-phase')
      return nextSceneId !== sourceSceneId || /is-moving/.test(moving ?? '') || travelVisible || Boolean(travelPhase)
    }, { timeout: 5_000 }).toBe(true)
    if (await page.locator('.center-long-distance-travel').count() > 0
      || await page.locator('.center-experience').getAttribute('data-long-distance-phase')) return
    if (await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene') !== sourceSceneId) return
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15_000 })
  }
  throw new Error('Walking did not reach the ride pickup exit')
}

async function walkAcrossStreet(page: Page, targetX: number) {
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (let step = 0; step < 30; step += 1) {
    if (!await page.locator('.scene-shell[data-mainline-scene="commercial-street"]').count()) return
    const x = await actor.evaluate(element => parseFloat((element as HTMLElement).style.left))
    if (Math.abs(x - targetX) < 2) return
    await clickWorldPoint(page, { x: x + Math.sign(targetX - x) * Math.min(22, Math.abs(targetX - x)), y: 46 })
    await expect.poll(async () => {
      if (!await page.locator('.scene-shell[data-mainline-scene="commercial-street"]').count()) return 1
      return Math.abs(await actor.evaluate(element => parseFloat((element as HTMLElement).style.left)) - x)
    }, { timeout: 15_000 }).toBeGreaterThan(0.1)
    if (!await page.locator('.scene-shell[data-mainline-scene="commercial-street"]').count()) return
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15_000 })
  }
  throw new Error('Street walking did not reach the Cafe approach')
}

test('desktop: fresh and legacy saves, early exit, and reentry persistence', async ({ page }, testInfo) => {
  await openEatery(page)
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'not-started')
  await page.screenshot({ path: testInfo.outputPath('yonghe-desktop-start.png') })

  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')
  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-mining-perimeter'] ?? {}
    return Object.entries(state).filter(([key, value]) => key.startsWith('yongheSurveyPoint:') && value === true).length
  })).toBe(1)
  await page.reload()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'in-progress')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-mining-perimeter']?.['yongheSurveyPoint:tables'])).toBe(true)

  const frontDoor = page.locator('[data-focus-target-group="door:yonghe-street-entry"]')
  await expect(frontDoor).toBeVisible()
  await frontDoor.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"][data-world-scene="yonghe-mining-perimeter"]')).toBeVisible({ timeout: 15_000 })

  const streetEntry = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"][data-world-scene="yonghe-mining-perimeter"] [data-storefront-cell-id][data-focus-target-policy="passage"]')
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
    'yonghe-lower-right-group-table',
    'yonghe-back-door',
    'yonghe-upper-left-group-table',
  ]) {
    const point = entityId === 'yonghe-upper-left-group-table' ? 'tables'
      : entityId === 'yonghe-counter' ? 'counter'
        : entityId === 'yonghe-lower-right-group-table' ? 'central-lane'
          : 'back-door'
    const seen = await page.evaluate(({ playerSaveKey, point }) =>
      JSON.parse(localStorage.getItem(playerSaveKey) ?? '{}').sceneState?.['yonghe-mining-perimeter']?.['yongheSurveyPoint:' + point] === true,
    { playerSaveKey, point })
    const currentStatus = entityId === 'yonghe-upper-left-group-table' ? 'complete' : 'in-progress'
    if (!seen) await inspect(page, entityId, 'yongheSurveyPoint:' + point, currentStatus)
    if (entityId === 'yonghe-counter') {
      const customerSidePosition = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').currentPosition, playerSaveKey)
      expect(customerSidePosition.x).toBeGreaterThan(25.75)
    }
  }

  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'complete')
  await page.screenshot({ path: testInfo.outputPath('yonghe-mobile-complete.png') })
  await page.reload()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'complete')
  await expect(page.locator('[data-object-id="yonghe-lower-right-group-table"]')).toBeVisible()
  await expect(page.locator('[data-object-id="yonghe-counter"]')).toBeVisible()
})

test('legal isolated save: perimeter, eatery round trip, ride map, and Café entry', async ({ page }, testInfo) => {
  test.setTimeout(150_000)
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
  const perimeter = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"][data-world-scene="yonghe-mining-perimeter"]')
  await expect(perimeter).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-perimeter-start.png') })

  await walkToWorldPoint(page, { x: 42, y: 35 })
  if (!await page.locator(eatery).isVisible()) {
    const entrance = perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]').first()
    await expect(entrance).toBeInViewport()
    await entrance.click()
  }
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'not-started', { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentPosition)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
  await expect.poll(() => page.evaluate(() => {
    const { x, y } = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentPosition
    return x >= 32 && x <= 38 && y >= 30 && y <= 40
  })).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-eatery-first-entry.png') })
  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')

  await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
  await expect(perimeter).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(eatery)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-early-exit.png') })
  await perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]').click()
  await expect(page.locator(eatery)).toHaveAttribute('data-yonghe-survey-status', 'in-progress', { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-mining-perimeter']?.['yongheSurveyPoint:tables'])).toBe(true)

  for (const [entity, point, status] of [
    ['yonghe-back-door', 'back-door', 'in-progress'],
    ['yonghe-counter', 'counter', 'in-progress'],
    ['yonghe-lower-right-group-table', 'central-lane', 'complete'],
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
  const rideOrderState = page.locator('.world-phone__ride-order-state')
  await expect(rideOrderState).toContainText('司机正在路上', { timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase', 'closed')
  await openRideArrivalNotification(page, 45_000)
  const rideArrival = page.locator('[data-notification-app="ride"]')
  await expect(rideArrival).toContainText('请前往上车点')
  await rideArrival.click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase', 'closed')
  await closeObservation(page)

  const pickupSceneId = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
  if (!pickupSceneId || !(pickupSceneId in mainlineScenes)) throw new Error('Ride pickup scene is unavailable')
  const pickupScene = mainlineScenes[pickupSceneId as keyof typeof mainlineScenes]
  const pickupExit = pickupScene.externalExits[0]
  const pickupPosition = mainlineRidePickupPositions(pickupScene.id)[0]
  if (!pickupExit || !pickupPosition) throw new Error('Ride pickup exit is unavailable')
  await walkToWorldPoint(page, { ...pickupPosition, [pickupExit.axis]: pickupPosition[pickupExit.axis] + pickupExit.direction }, true)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.center-long-distance-travel')).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('.center-experience')).not.toHaveAttribute('data-long-distance-phase', /.+/)
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-commercial-street-arrival.png') })

  const cafeDoor = page.locator('.scene-shell[data-mainline-scene="commercial-street"] [data-focus-target-group="door:street-cafe-entry"]')
  await expect(cafeDoor).toBeVisible({ timeout: 15_000 })
  await walkAcrossStreet(page, 185)
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  await cafeDoor.click()
  const cafe = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')
  await expect(cafe).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-eatery"][data-world-scene="yonghe-mining-perimeter"]')).toHaveCount(0)
  await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(0)
  await expect(cafe).toHaveAttribute('data-commercial-cafe-narrative-phase', 'not-started')
  await expect(cafe).toHaveAttribute('data-commercial-cafe-status', 'available')
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-cafe-entry.png') })
})

test('rapid front-door round trips keep one scene active and preserve survey state', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1'))
  await page.goto('/?scene=yonghe-mining-perimeter')

  const perimeter = page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"][data-world-scene="yonghe-mining-perimeter"]')
  const inside = page.locator(eatery)
  const sharedWorldNode = await perimeter.evaluateHandle((element) => element)
  await expect(perimeter).toBeVisible()

  // Walk up the normal mine-side lane with actual stage input. The doorway
  // becomes visible through the existing camera follow as the player advances.
  const stage = perimeter.locator('.mainline-scene-stage')
  for (const yRatio of [0.4, 0.2]) {
    const beforeY = await page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentPosition?.y)
    const box = await stage.boundingBox()
    if (!box) throw new Error('Mining perimeter stage has no layout box')
    await stage.click({ position: { x: box.width * 0.45, y: box.height * yRatio } })
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentPosition?.y)).toBeLessThan(beforeY)
  }

  const entry = perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]')
  await expect(entry).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('yonghe-route-door-in-viewport.png') })
  await entry.click()
  await expect(inside).toHaveAttribute('data-yonghe-survey-status', 'not-started', { timeout: 15_000 })
  await expect(perimeter).toHaveCount(0)
  expect(await sharedWorldNode.evaluate((element) => element === document.querySelector('.scene-shell[data-world-scene="yonghe-mining-perimeter"]'))).toBe(true)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').currentSceneId)).toBe('yonghe-mining-perimeter')

  await inspect(page, 'yonghe-upper-left-group-table', 'yongheSurveyPoint:tables', 'in-progress')
  for (let round = 0; round < 2; round += 1) {
    await page.locator('[data-focus-target-group="door:yonghe-street-entry"]').click()
    await expect(perimeter).toBeVisible({ timeout: 15_000 })
    await expect(inside).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['yonghe-mining-perimeter']?.['yongheSurveyPoint:tables'])).toBe(true)

    const returningEntry = perimeter.locator('[data-storefront-cell-id][data-focus-target-policy="passage"]')
    await expect(returningEntry).toBeInViewport()
    await returningEntry.click()
    await expect(inside).toHaveAttribute('data-yonghe-survey-status', 'in-progress', { timeout: 15_000 })
    await expect(perimeter).toHaveCount(0)
  }

  await page.screenshot({ path: testInfo.outputPath('yonghe-doorway-round-trip.png') })
})
test('Chinese observation copy is presented as an in-scene observation', async ({ page }) => {
  await openEatery(page)
  await page.locator('[data-object-id="yonghe-lower-right-group-table"]').click()
  await expect(page.locator('[data-scene-text-mode="observation"]')).toContainText('通道足够让人走过', { timeout: 15_000 })
})

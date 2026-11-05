import { expect, test, type Page } from '@playwright/test'
import { mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const cafe = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
const restroomSign = scene.storefronts.find(slot => slot.id === 'cafe-restroom-sign')!
const cafeEntry = scene.storefronts.find(slot => slot.id === 'commercial-cafe-slot')!
const local = (x: number, y: number) => ({ x: cafe.bounds.x + x / 1920 * 100, y: cafe.bounds.y + y / 1080 * 100 })

async function openCafe(page: Page, localPosition = { x: 500, y: 120 }) {
  const position = local(localPosition.x, localPosition.y)
  await page.addInitScript(({ position }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2, currentSceneId: 'commercial-street', currentPosition: position,
      scenePositions: { 'commercial-street': position }, phoneDevice: 'inner', sceneState: {},
    }))
  }, { position })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  await expect(page.locator('[data-actor-id="protagonist"]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function clickWorld(page: Page, world: { x: number; y: number }) {
  const point = await page.locator('.scene-mainline-world').evaluate((element, worldPoint) => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + bounds.width * worldPoint.x / 100, y: bounds.top + bounds.height * worldPoint.y / 100 }
  }, world)
  await page.mouse.click(point.x, point.y)
}

async function actorPosition(page: Page) {
  return page.locator('[data-actor-id="protagonist"]').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.runtimeX),
    y: Number((element as HTMLElement).dataset.runtimeY),
  }))
}

test('walking to the restroom-front ground target reevaluates its reveal, while only clicking its door enters', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCafe(page)
  const doorCells = page.locator('button[data-storefront-cell-id*="cafe-restroom"]')
  const restroomHost = page.locator('[data-storefront-id="cafe-restroom-sign"]')
  await expect(restroomHost).toHaveAttribute('data-storefront-label-phase', 'baseline')
  const before = await actorPosition(page)
  await clickWorld(page, local(560, 58)) // public ground in front of the restroom door, not the door itself

  await expect(restroomHost).toHaveAttribute('data-storefront-label-phase', /revealing|revealed/ , { timeout: 8000 })
  await expect.poll(async () => {
    const after = await actorPosition(page)
    return Math.hypot((after.x - before.x) * 19.2, (after.y - before.y) * 10.8)
  }, { timeout: 12000 }).toBeGreaterThan(10)
  await expect(restroomHost).toHaveAttribute('data-storefront-label-phase', 'revealed', { timeout: 8000 })
  const arrived = await actorPosition(page)
  await info.attach('restroom-ground-approach.json', { body: JSON.stringify({ before, arrived, triggerWorldPoint: local(560, 58), phase: await restroomHost.getAttribute('data-storefront-label-phase') }, null, 2), contentType: 'application/json' })

  const explicitDoor = page.locator('button[data-storefront-cell-id*="cafe-restroom"]')
  await expect(explicitDoor).toHaveCount(1)
  await expect(explicitDoor).toBeVisible()
  await explicitDoor.click()
  await expect.poll(async () => (await actorPosition(page)).y, { timeout: 15000 }).toBeLessThan(cafe.bounds.y)
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-mainline-scene', 'commercial-street')
})

test('counter hit area remains interactive without changing its color or brightness on hover, focus, or click', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openCafe(page)
  const part = page.locator('[data-counter-part-id="cafe-trial-counter-front-body"]')
  const svg = page.locator('[data-counter-outline-group="cafe-trial-L-counter"]')
  await expect(part).toBeVisible()
  const sample = async () => svg.evaluate(element => {
    const path = element.querySelector('path[data-counter-outline-path]')!
    const rect = element.querySelector('[data-counter-part-id]')!
    const pathStyle = getComputedStyle(path), svgStyle = getComputedStyle(element), rectStyle = getComputedStyle(rect)
    return { color: pathStyle.color, opacity: svgStyle.opacity, filter: svgStyle.filter, stroke: pathStyle.stroke, outline: rectStyle.outlineStyle, background: rectStyle.backgroundColor }
  })
  const baseline = await sample()
  await part.hover({ position: { x: 5, y: 5 } })
  const hovered = await sample()
  await part.focus()
  const focused = await sample()
  await part.click({ position: { x: 5, y: 5 } })
  const clicked = await sample()
  expect(hovered).toEqual(baseline)
  expect(focused).toEqual(baseline)
  expect(clicked).toEqual(baseline)
  await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 8000 })
  await info.attach('counter-visual-state.json', { body: JSON.stringify({ baseline, hovered, focused, clicked, interactive: await part.getAttribute('role') }, null, 2), contentType: 'application/json' })
})

test('one bounded Cafe entry click records movement and main-thread long tasks', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const approach = mainlineStorefrontApproach(scene, cafeEntry)
  await page.addInitScript(({ position }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({ _version: 2, currentSceneId: 'commercial-street', currentPosition: position, scenePositions: { 'commercial-street': position }, phoneDevice: 'inner', sceneState: {} }))
    ;(window as Window & { __phase2LongTasks?: { startTime: number; duration: number }[] }).__phase2LongTasks = []
    new PerformanceObserver(list => { for (const entry of list.getEntries()) (window as Window & { __phase2LongTasks?: { startTime: number; duration: number }[] }).__phase2LongTasks!.push({ startTime: entry.startTime, duration: entry.duration }) }).observe({ type: 'longtask', buffered: true })
  }, { position: approach })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  await expect(page.locator('[data-actor-id="protagonist"]')).toBeVisible()
  const storefront = page.locator('[data-storefront-id="commercial-cafe-slot"]')
  await expect(storefront).toHaveAttribute('data-storefront-label-phase', 'revealed', { timeout: 8000 })
  const before = await actorPosition(page)
  const startedAt = await page.evaluate(() => performance.now())
  await page.locator('button[data-storefront-cell-id*="commercial-cafe-slot"]').click()
  await expect.poll(async () => {
    const actor = await actorPosition(page)
    return actor.y !== before.y || actor.x !== before.x
  }, { timeout: 8000 }).toBe(true)
  await expect.poll(async () => (await actorPosition(page)).x, { timeout: 15000 }).not.toBe(before.x)
  const report = await page.evaluate(start => {
    const endedAt = performance.now()
    const longTasks = (window as Window & { __phase2LongTasks?: { startTime: number; duration: number }[] }).__phase2LongTasks ?? []
    return { elapsedMs: Math.round(endedAt - start), longTasks: longTasks.filter(task => task.startTime >= start && task.startTime <= endedAt) }
  }, startedAt)
  await info.attach('cafe-entry-bounded-measurement.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
})

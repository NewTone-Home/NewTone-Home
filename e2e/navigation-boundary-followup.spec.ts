import { test, expect, type Page } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isWalkableMainlinePoint, mainlinePassageDoorRegion, mainlinePassageDoorwayForNavigation } from '../src/center/runtime/mainlineNavigation'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

test.describe.configure({ timeout: 90000 })
test.use({ viewport: { width: 1280, height: 720 } })
async function clickWorld(page: Page, point: { x: number; y: number }) {
  const pixel = await page.locator('.mainline-scene-stage').evaluate((element, point) => {
    const e = element as HTMLElement, r = e.getBoundingClientRect()
    const camera = { x: Number(e.dataset.cameraOffsetX ?? 0), y: Number(e.dataset.cameraOffsetY ?? 0) }
    const x = r.x + r.width * (point.x + camera.x) / 100
    const y = r.y + r.height * (point.y + camera.y) / 100
    return { x, y, projected: { x: (Math.floor(x) - r.left) / r.width * 100 - camera.x,
      y: (Math.floor(y) - r.top) / r.height * 100 - camera.y } }
  }, point)
  await page.mouse.click(pixel.x, pixel.y)
  return pixel.projected
}
async function position(page: Page) {
  return page.locator('[data-actor-id="protagonist"]').evaluate(e => ({ x: Number((e as HTMLElement).dataset.runtimeX), y: Number((e as HTMLElement).dataset.runtimeY) }))
}
async function reach(page: Page, target: { x: number; y: number }) {
  const projected = await clickWorld(page, target)
  const actor = page.locator('[data-actor-id="protagonist"]')
  await expect(actor).toHaveAttribute('data-runtime-x', String(projected.x), { timeout: 20000 })
  await expect(actor).toHaveAttribute('data-runtime-y', String(projected.y), { timeout: 20000 })
  await expect(actor).not.toHaveClass(/is-moving/)
}
async function dismiss(page: Page) {
  for (let i = 0; i < 12 && await page.locator('[data-scene-echo]').count(); i++) {
    const echo = page.locator('[data-scene-echo]')
    await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false')
    const index = Number(await echo.getAttribute('data-scene-segment-index'))
    const count = Number(await echo.getAttribute('data-scene-segment-count'))
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    if (index + 1 < count) await expect(echo).toHaveAttribute('data-scene-segment-index', String(index + 1))
    else await expect(echo).toHaveCount(0)
  }
  await expect(page.locator('[data-scene-echo]')).toHaveCount(0)
}

const office = mainlineScenes['zhongshuyuan-office']
const rooms = office.rooms.filter(r => /north-room|south-room/.test(r.id) && !r.id.endsWith('south-room-1'))
for (const room of rooms) test('Office fixed lower-left → ' + room.id + ': correct lock contact, no black screen, restartable', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/?scene=zhongshuyuan-office&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  expect(await position(page)).toEqual(office.initialPlayerPosition)
  const passage = office.passages.find(p => p.toRoomId === room.id || p.fromRoomId === room.id)!
  const target = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
  const source = office.passages.find(p => p.fromRoomId?.endsWith('south-room-1') || p.toRoomId?.endsWith('south-room-1'))!
  // Read-only DOM evidence captures the short opening phase without selector races.
  await page.evaluate(entityId => {
    const samples: { moving: boolean; x: number; y: number }[] = []
    Object.assign(window, { navigationOpeningSamples: samples })
    const observer = new MutationObserver(() => {
      const door = document.querySelector('[data-focus-target-group="door:' + entityId + '"]') as HTMLElement | null
      const actor = document.querySelector('[data-actor-id="protagonist"]') as HTMLElement | null
      if (door?.dataset.focusPassagePhase === 'opening' && actor) samples.push({
        moving: actor.classList.contains('is-moving'), x: Number(actor.dataset.runtimeX), y: Number(actor.dataset.runtimeY),
      })
      if (document.querySelector('[data-scene-echo]')) observer.disconnect()
    })
    observer.observe(document.body, { subtree: true, attributes: true, childList: true })
  }, source.entityId)
  await clickWorld(page, target)
  const echo = page.locator('[data-scene-echo]')
  await expect(echo).toBeVisible({ timeout: 25000 })
  await expect(echo).toHaveAttribute('data-scene-echo', passage.entityId)
  const opening = await page.evaluate(() => (window as unknown as { navigationOpeningSamples: { moving: boolean; x: number; y: number }[] }).navigationOpeningSamples)
  expect(opening.length).toBeGreaterThan(0)
  expect(opening[0]!.moving).toBe(true)
  const p = await position(page)
  const metrics = { width: 1280, height: 720 }
  const doorway = mainlinePassageDoorwayForNavigation(office, passage, { screenMetrics: metrics })
  const dot = mainlineProtagonistDotFootprint(p, metrics)
  const region = mainlinePassageDoorRegion(passage, doorway, doorway, { width: dot.width, height: dot.height })
  expect(p.x).toBeGreaterThanOrEqual(region.detection.x)
  expect(p.x).toBeLessThanOrEqual(region.detection.x + region.detection.width)
  expect(p.y).toBeGreaterThanOrEqual(region.detection.y)
  expect(p.y).toBeLessThanOrEqual(region.detection.y + region.detection.height)
  expect(isWalkableMainlinePoint(p, office, {}, { screenMetrics: metrics })).toBe(true)
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false')
  expect(passage.lockedTextPool ?? [passage.lockedText]).toContain(await echo.innerText())
  await page.screenshot({ path: info.outputPath(room.id + '.png') })
  await dismiss(page)
  await reach(page, { x: 50, y: 50 })
  expect(errors).toEqual([])
})

for (const start of ['lower', 'top']) test('Café continuous staff boundary from ' + start + ', top wall and rapid clicks', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  const cafe = mainlineScenes['commercial-cafe'], staff = cafe.accessRegions[0]!
  await page.goto('/?scene=commercial-cafe&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  const origin = { x: staff.x + staff.width + 7, y: start === 'lower' ? staff.y + staff.height + 5 : staff.y + 1.1 }
  const contacts: number[] = []
  for (const [index, y] of [staff.y + 1, staff.y + staff.height / 2, staff.y + staff.height - 1, staff.y - .2].entries()) {
    await reach(page, origin)
    await clickWorld(page, { x: staff.x + staff.width - 2, y })
    await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('[data-scene-echo]')).toContainText('还是别进去打扰他们工作了')
    await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
    const p = await position(page); contacts.push(p.y)
    const dot = mainlineProtagonistDotFootprint(p, { width: 1280, height: 720 })
    expect(p.x - dot.width / 2).toBeGreaterThan(staff.x + staff.width)
    expect(isWalkableMainlinePoint(p, cafe, {}, { screenMetrics: { width: 1280, height: 720 } })).toBe(true)
    await page.screenshot({ path: info.outputPath('cafe-' + start + '-' + index + '.png') })
    await dismiss(page)
  }
  expect(new Set(contacts.map(y => y.toFixed(2))).size).toBeGreaterThan(2)
  await reach(page, origin)
  for (let i = 0; i < 4; i++) { await clickWorld(page, { x: staff.x + staff.width - 2, y: staff.y + 1 + i }); await clickWorld(page, origin) }
  await reach(page, origin)
  await clickWorld(page, { x: staff.x + staff.width - 2, y: staff.y + staff.height / 2 })
  await expect(page.locator('[data-scene-echo]')).toBeVisible({ timeout: 20000 })
  await dismiss(page)
  await reach(page, origin)
  expect(errors).toEqual([])
})

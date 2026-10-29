import { expect, test, type Page } from '@playwright/test'
import { cafeRestroomFaucetId, cafeRestroomFaucetLabel, cafeRestroomRoomId, cafeRestroomToiletId } from '../src/center/runtime/cafeRestroom'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const cafe = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
const restroom = scene.rooms.find(room => room.id === cafeRestroomRoomId)!
const local = (x: number, y: number) => ({ x: cafe.bounds.x + x / 19.2, y: cafe.bounds.y + y / 10.8 })

async function openRestroom(page: Page) {
  const position = local(608, -70)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.addInitScript(({ position }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2,
      currentSceneId: 'commercial-street',
      currentPosition: position,
      scenePositions: { 'commercial-street': position },
      phoneDevice: 'inner',
      sceneState: { 'commercial-street': { interactionTutorialCompleted: true } },
    }))
  }, { position })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-mainline-scene', 'commercial-street')
  await expect(page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)).toBeVisible()
  await expect(page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)).toBeVisible()
}

async function actorPosition(page: Page) {
  return page.locator('[data-actor-id="protagonist"]').evaluate(element => {
    const style = getComputedStyle(element)
    return { left: style.left, top: style.top }
  })
}

async function clickWorld(page: Page, point: { x: number; y: number }) {
  const position = await page.locator('.scene-mainline-world').evaluate((element, target) => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + bounds.width * target.x / 100, y: bounds.top + bounds.height * target.y / 100 }
  }, point)
  await page.mouse.click(position.x, position.y)
}

async function startUse(page: Page, entityId: string) {
  await page.locator(`[data-object-id="${entityId}"]`).click()
  const action = page.locator(`[data-scene-action="${entityId}"]`)
  await expect(action).toBeVisible()
  await action.getByRole('button').first().click()
}

test('both fixtures start independently on arrival, brighten locally, allow walking, and expire on game time', async ({ page }, info) => {
  await openRestroom(page)
  const stage = page.locator('.mainline-scene-stage')
  const toilet = page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)
  const sink = page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)

  for (const fixture of [toilet, sink]) {
    await expect(fixture).toHaveAttribute('data-restroom-brightness', 'half')
    await expect(fixture).toHaveCSS('opacity', '0.5')
  }
  await expect(sink).toHaveAttribute('aria-label', new RegExp(cafeRestroomFaucetLabel))
  const sinkColor = await sink.locator('.scene-mainline-object__label').evaluate(element => getComputedStyle(element).color)
  await startUse(page, cafeRestroomFaucetId)
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'using', { timeout: 10_000 })
  await expect(sink).toHaveAttribute('data-restroom-brightness', 'normal')
  await expect(sink).toHaveCSS('opacity', '1')
  expect(await sink.locator('.scene-mainline-object__label').evaluate(element => getComputedStyle(element).color)).toBe(sinkColor)
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'half')
  await page.screenshot({ path: info.outputPath('sink-using-brightness.png') })

  const beforeWalk = await actorPosition(page)
  await clickWorld(page, local(620, -35))
  await expect.poll(() => actorPosition(page), { timeout: 3_000 }).not.toEqual(beforeWalk)

  // Starting the toilet is a separate explicit action. If the sink is still
  // active, its phase must remain independent while the toilet approaches.
  await startUse(page, cafeRestroomToiletId)
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'approaching')
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using', { timeout: 10_000 })
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'normal')
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using')
  await page.screenshot({ path: info.outputPath('toilet-using-brightness.png') })

  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'idle', { timeout: 8_000 })
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'half')
  // The sink has a separate deadline; no completion handler may clear it.
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle', { timeout: 8_000 })
  await expect(sink).toHaveAttribute('data-restroom-brightness', 'half')
  await page.screenshot({ path: info.outputPath('fixtures-idle-half-brightness.png') })
})

test('leaving the restroom cancels each active fixture and re-entry starts dim', async ({ page }, info) => {
  await openRestroom(page)
  const stage = page.locator('.mainline-scene-stage')
  const sink = page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)
  await startUse(page, cafeRestroomFaucetId)
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'using', { timeout: 10_000 })
  const beforeExit = await actorPosition(page)
  await clickWorld(page, local(560, 42))
  await expect.poll(() => actorPosition(page), { timeout: 3_000 }).not.toEqual(beforeExit)
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle')
  await expect(sink).toHaveAttribute('data-restroom-brightness', 'half')
  await page.screenshot({ path: info.outputPath('restroom-exit-resets-sink.png') })
  const beforeReturn = await actorPosition(page)
  await clickWorld(page, local(560, -42))
  await expect.poll(() => actorPosition(page), { timeout: 3_000 }).not.toEqual(beforeReturn)
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle')
  await expect(sink).toHaveAttribute('data-restroom-brightness', 'half')
  await page.screenshot({ path: info.outputPath('restroom-reentry-idle.png') })
})

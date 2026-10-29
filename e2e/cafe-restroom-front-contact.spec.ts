import { expect, test, type Page } from '@playwright/test'
import { cafeRestroomFaucetId, cafeRestroomRoomId, cafeRestroomToiletId } from '../src/center/runtime/cafeRestroom'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const cafe = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
const local = (x: number, y: number) => ({ x: cafe.bounds.x + x / 19.2, y: cafe.bounds.y + y / 10.8 })

async function openRestroom(page: Page, position: { x: number; y: number }, visibleFixtures = [cafeRestroomToiletId, cafeRestroomFaucetId]) {
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
  await page.goto('/?scene=commercial-street')
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-mainline-scene', 'commercial-street')
  for (const fixtureId of visibleFixtures) {
    await expect(page.locator(`[data-object-id="${fixtureId}"]`)).toBeVisible()
  }
}

async function useFixture(page: Page, fixtureId: string) {
  await page.locator(`[data-object-id="${fixtureId}"]`).click()
  const action = page.locator(`[data-scene-action="${fixtureId}"]`)
  await expect(action).toBeVisible()
  await action.getByRole('button').first().click()
}

async function assertActorAtFront(page: Page, fixtureId: string, front: 'south' | 'west') {
  const actor = await page.locator('[data-actor-id="protagonist"]').boundingBox()
  const fixture = await page.locator(`[data-object-id="${fixtureId}"]`).boundingBox()
  expect(actor).not.toBeNull()
  expect(fixture).not.toBeNull()
  if (!actor || !fixture) return
  if (front === 'south') {
    expect(actor.y + actor.height / 2).toBeGreaterThan(fixture.y + fixture.height)
  } else {
    expect(actor.x + actor.width / 2).toBeLessThan(fixture.x)
  }
}

const toiletApproaches = [
  { name: 'from north', position: local(532, -126 - 1.8 * 10.8) },
  { name: 'from west', position: local(532 - 1.5 * 19.2, -126) },
  { name: 'from east', position: local(532 + 1.5 * 19.2, -126) },
  { name: 'from south front', position: local(532, -126 + 1.8 * 10.8) },
]

for (const approach of toiletApproaches) {
  test(`toilet click ${approach.name} routes to the door-facing front`, async ({ page }, info) => {
    await openRestroom(page, approach.position)
    const stage = page.locator('.mainline-scene-stage')
    await useFixture(page, cafeRestroomToiletId)
    await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using', { timeout: 15_000 })
    await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle')
    await assertActorAtFront(page, cafeRestroomToiletId, 'south')
    await page.screenshot({ path: info.outputPath(`toilet-front-${approach.name.replaceAll(' ', '-')}.png`) })
  })
}

const sinkApproaches = [
  { name: 'from north', position: local(608, -70 - 3 * 10.8) },
  { name: 'from west front', position: local(608 - 1 * 19.2, -70) },
  { name: 'from south', position: local(608, -70 + 3 * 10.8) },
]

for (const approach of sinkApproaches) {
  test(`sink click ${approach.name} routes to the room-facing front`, async ({ page }, info) => {
    await openRestroom(page, approach.position, approach.name === 'from south' ? [cafeRestroomFaucetId] : undefined)
    const stage = page.locator('.mainline-scene-stage')
    await useFixture(page, cafeRestroomFaucetId)
    await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'using', { timeout: 15_000 })
    await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'idle')
    await assertActorAtFront(page, cafeRestroomFaucetId, 'west')
    await page.screenshot({ path: info.outputPath(`sink-front-${approach.name.replaceAll(' ', '-')}.png`) })
  })
}

test('changing target while approaching cancels the pending use without starting either fixture', async ({ page }) => {
  await openRestroom(page, local(560, -100))
  const stage = page.locator('.mainline-scene-stage')
  const sink = page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)
  await sink.click()
  await page.locator(`[data-scene-action="${cafeRestroomFaucetId}"]`).getByRole('button').first().click()
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'approaching')
  await page.locator(`[data-object-id="${cafeRestroomToiletId}"]`).click()
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle')
  await expect(page.locator(`[data-scene-action="${cafeRestroomToiletId}"]`)).toBeVisible()
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'idle')
  await page.waitForTimeout(2_000)
  await expect(stage).toHaveAttribute('data-cafe-restroom-sink-use-phase', 'idle')
  await expect(sink).toHaveAttribute('data-restroom-brightness', 'half')
})

import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { mainlineRidePickupPositions } from '../src/center/runtime/mainlineRide'
import { mainlineSceneRoomAtPosition } from '../src/center/runtime/mainlineSceneModel'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { openRideArrivalNotification } from './phoneRideNotification'

test.use({ viewport: { width: 1920, height: 1080 }, storageState: '.test-tmp/a-held.storage.json' })

test('resume A held milk tea save and carry it through a taxi trip to the mine region', async ({ page }) => {
  test.setTimeout(180_000)
  const sessionPath = resolve('.test-tmp/a-held.session.json')
  const snapshot = JSON.parse(await readFile(sessionPath, 'utf8')) as Record<string, string>
  const expectedHeld = JSON.parse(snapshot['newtone-player-save-v1'] ?? '{}').heldConsumable
  expect(expectedHeld).toMatchObject({ shopId: 'commercial-south-slot-5', productId: 'original-milk-tea', kind: 'drink' })
  await page.addInitScript(({ snapshot }) => {
    for (const [key, value] of Object.entries(snapshot)) sessionStorage.setItem(key, value as string)
  }, { snapshot })
  await page.goto('/?scene=commercial-street&e2eShopOrders=1&debugRuntimeEvidence=1')
  await expect(page.locator('.center-experience')).toBeVisible()
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  await page.waitForFunction(() => {
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    return Number.isFinite(Number(player?.dataset.runtimeX)) && Number.isFinite(Number(player?.dataset.runtimeY))
  }, undefined, { timeout: 15_000 })
  const position = await actor.evaluate(element => ({ x: Number((element as HTMLElement).dataset.runtimeX), y: Number((element as HTMLElement).dataset.runtimeY) }))
  const room = mainlineSceneRoomAtPosition(mainlineScenes['commercial-street'], position)?.id ?? null
  const phone = page.locator('.world-phone')
  const saveBefore = await page.evaluate(() => {
    const save = JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}')
    const stageNode = document.querySelector<HTMLElement>('.mainline-scene-stage')
    const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
    const phoneNode = document.querySelector<HTMLElement>('.world-phone')
    return { sceneId: stageNode?.dataset.mainlineScene, x: Number(player?.dataset.runtimeX), y: Number(player?.dataset.runtimeY), phoneOpen: phoneNode?.getAttribute('data-phone-open'), phonePhase: phoneNode?.dataset.phonePhase, dialogueShield: Boolean(document.querySelector('[data-scene-dialogue-shield="true"]')), dialogueText: document.querySelector('[data-scene-echo]')?.textContent?.trim() ?? null, held: save.heldConsumable, orders: save.shopOrders }
  })
  expect(saveBefore.held).toEqual(expectedHeld)
  expect(saveBefore.orders).toEqual(JSON.parse(snapshot['newtone-player-save-v1']).shopOrders)
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
  console.log(`[B restored A state] ${JSON.stringify({ ...saveBefore, room })}`)

  if (room === 'commercial-south-s5-interior') {
    const door = page.locator('button[data-storefront-cell-id="commercial-south-slot-5-character-1"]')
    await expect(door).toBeVisible()
    await door.scrollIntoViewIfNeeded()
    await expect(door).toBeInViewport()
    await door.click()
    const exit = mainlineScenes['commercial-street'].passages.find(passage => passage.portalId === mainlineScenes['commercial-street'].storefronts.find(store => store.id === 'commercial-south-slot-5')?.portalId)!
    await page.waitForFunction(({ x, y }) => {
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(player && Math.hypot(Number(player.dataset.runtimeX) - x, Number(player.dataset.runtimeY) - y) < 1)
    }, exit.crossingTargets[1]!, { timeout: 25_000 })
  }

  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-phase', 'open')
  await phone.locator('[data-app="ride"]').click()
  const destination = phone.locator('.world-phone__ride-destination').nth(1)
  await expect(destination).toBeVisible()
  const destinationLabel = await destination.locator('strong').innerText()
  console.log(`[B selected destination] ${destinationLabel}`)
  await destination.click()
  await expect(phone.locator('.world-phone__ride-page h3')).toContainText(destinationLabel)
  await phone.locator('.world-phone__vehicles button').first().click()
  await phone.locator('.world-phone__list-action').click()
  await expect(page.locator('[data-ride-order="true"]')).toBeVisible()
  await openRideArrivalNotification(page, 90_000)
  await phone.locator('[data-notification-app="ride"]').click()
  if (await phone.getAttribute('data-phone-phase') !== 'closed') await page.keyboard.press('Escape')
  await expect(phone).toHaveAttribute('data-phone-phase', 'closed')

  const pickup = mainlineRidePickupPositions('commercial-street')[0]!
  for (let step = 0; step < 12; step += 1) {
    const point = await stage.evaluate((element, target) => {
      const rect = element.getBoundingClientRect()
      const x = rect.left + 24
      const y = rect.top + rect.height * .52
      const hit = document.elementFromPoint(x, y)
      const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return { x, y, isGround: Boolean(hit?.closest('.scene-mainline-world')) && !hit?.closest('button'), hitClass: typeof hit?.className === 'string' ? hit.className : hit?.className?.baseVal ?? '', stage: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, actor: { x: Number(player?.dataset.runtimeX), y: Number(player?.dataset.runtimeY) }, camera: { x: Number(element.getAttribute('data-camera-offset-x') ?? 0), y: Number(element.getAttribute('data-camera-offset-y') ?? 0) }, pickup: target }
    }, pickup)
    if (!point.isGround) throw new Error(`Taxi walk click missed walkable scene: ${JSON.stringify(point)}`)
    await page.mouse.click(point.x, point.y)
    await page.waitForTimeout(1_800)
    const sceneId = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
    const after = await actor.evaluate(element => ({ x: Number((element as HTMLElement).dataset.runtimeX), y: Number((element as HTMLElement).dataset.runtimeY) }))
    console.log(`[B ground walk ${step}] ${JSON.stringify({ ...point, after, sceneId })}`)
    if (sceneId !== 'commercial-street' || await page.locator('.center-long-distance-travel').isVisible().catch(() => false)) break
  }
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').heldConsumable)).toEqual(expectedHeld)
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('newtone-player-save-v1') ?? '{}').shopOrders)).toEqual(JSON.parse(snapshot['newtone-player-save-v1']).shopOrders)
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()
})

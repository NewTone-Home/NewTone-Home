import { expect, test, type Page } from '@playwright/test'
import { cafeRestroomFaucetId, cafeRestroomFaucetLabel, cafeRestroomRoomId, cafeRestroomToiletId } from '../src/center/runtime/cafeRestroom'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const cafe = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
const restroom = scene.rooms.find(room => room.id === cafeRestroomRoomId)!
const local = (x: number, y: number) => ({ x: cafe.bounds.x + x / 19.2, y: cafe.bounds.y + y / 10.8 })

async function openRestroom(page: Page, position = local(608, -70)) {
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
  await expect(page.locator('[data-actor-id="protagonist"]')).toBeVisible()
  await expect(page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)).toBeVisible()
  await expect(page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function clickWorld(page: Page, worldPoint: { x: number; y: number }) {
  const point = await page.locator('.scene-mainline-world').evaluate((element, target) => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.left + bounds.width * target.x / 100, y: bounds.top + bounds.height * target.y / 100 }
  }, worldPoint)
  await page.mouse.click(point.x, point.y)
}

async function actorPosition(page: Page) {
  return page.locator('[data-actor-id="protagonist"]').evaluate(element => ({
    x: Number((element as HTMLElement).dataset.runtimeX),
    y: Number((element as HTMLElement).dataset.runtimeY),
  }))
}

async function restroomVisual(locator: import('@playwright/test').Locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element)
    const label = element.querySelector('.scene-mainline-object__label')
    return {
      brightness: element.getAttribute('data-restroom-brightness'),
      opacity: style.opacity,
      color: getComputedStyle(label ?? element).color,
      filter: style.filter,
    }
  })
}

test('toilet use prompt can be walked away from without starting use', async ({ page }, info) => {
  await openRestroom(page)
  const toilet = page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)
  const before = await actorPosition(page)
  await toilet.click()
  const action = page.locator(`[data-scene-action="${cafeRestroomToiletId}"]`)
  await expect(action).toBeVisible()
  await expect(action.getByRole('button', { name: '使用', exact: true })).toBeVisible()
  await expect.poll(() => actorPosition(page)).toEqual(before)
  await page.screenshot({ path: info.outputPath('restroom-toilet-use-button.png') })

  await clickWorld(page, local(620, -35))
  await expect(action).toHaveCount(0)
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'idle')
  await expect(toilet).not.toHaveClass(/scene-mainline-interaction--active/)
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect.poll(async () => actorPosition(page), { timeout: 8_000 }).not.toEqual(before)
  await page.screenshot({ path: info.outputPath('restroom-toilet-use-cancelled-by-walking.png') })
})

test('toilet use approaches, locks for a short highlight, ignores repeated input, then unlocks', async ({ page }, info) => {
  await openRestroom(page)
  const stage = page.locator('.mainline-scene-stage')
  const toilet = page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)
  const dimmer = page.locator('.scene-dialogue-dimmer')
  const baselineDimmerOpacity = await dimmer.evaluate(element => getComputedStyle(element).opacity)
  await toilet.click()
  const use = page.getByRole('button', { name: '使用', exact: true })
  await expect(use).toBeVisible()
  await use.click()
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'approaching')
  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using', { timeout: 15_000 })
  await expect(page.locator(`[data-scene-action="${cafeRestroomToiletId}"]`)).toHaveCount(0, { timeout: 3_000 })
  const useStartedAt = await page.evaluate(() => performance.now())
  const toiletColorBeforeUse = (await restroomVisual(toilet)).color
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'normal')
  await expect(toilet).toHaveCSS('opacity', '1')
  expect((await restroomVisual(toilet)).color).toBe(toiletColorBeforeUse)
  expect(await dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe(baselineDimmerOpacity)

  const lockedPosition = await actorPosition(page)
  await page.evaluate(({ toiletId, target }) => {
    const toilet = document.querySelector<HTMLElement>(`[data-object-id="${toiletId}"]`)
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')
    const world = document.querySelector<HTMLElement>('.scene-mainline-world')
    if (!toilet || !stage || !world) throw new Error('Restroom interaction targets must be mounted.')
    const toiletBounds = toilet.getBoundingClientRect()
    toilet.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: toiletBounds.left + toiletBounds.width / 2, clientY: toiletBounds.top + toiletBounds.height / 2 }))
    const worldBounds = world.getBoundingClientRect()
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: worldBounds.left + worldBounds.width * target.x / 100, clientY: worldBounds.top + worldBounds.height * target.y / 100 }))
  }, { toiletId: cafeRestroomToiletId, target: local(620, -35) })
  await page.waitForTimeout(180)
  expect(await actorPosition(page)).toEqual(lockedPosition)

  await expect(stage).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'idle', { timeout: 4_000 })
  const durationMs = await page.evaluate(start => performance.now() - start, useStartedAt)
  expect(durationMs).toBeGreaterThanOrEqual(800)
  expect(durationMs).toBeLessThan(2_000)
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect(toilet).toHaveCSS('opacity', '0.5')
  expect((await restroomVisual(toilet)).color).toBe(toiletColorBeforeUse)

  await clickWorld(page, local(620, -35))
  await expect.poll(async () => actorPosition(page), { timeout: 8_000 }).not.toEqual(lockedPosition)
  await page.screenshot({ path: info.outputPath('restroom-toilet-use-finished-unlocked.png') })
})

test('walking away cancels a selected use while it is still approaching the toilet', async ({ page }) => {
  await openRestroom(page, local(608, -70))
  const stage = page.locator('.mainline-scene-stage')
  const toilet = page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)
  const startingPosition = await actorPosition(page)
  await toilet.click()
  const use = page.getByRole('button', { name: '使用', exact: true })
  await expect(use).toBeVisible()
  await page.evaluate(({ target }) => {
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')
    const world = document.querySelector<HTMLElement>('.scene-mainline-world')
    if (!stage || !world) throw new Error('Restroom navigation targets must be mounted.')
    ;(window as Window & { __restroomApproachCancelled?: boolean }).__restroomApproachCancelled = false
    const clickAway = () => {
      const worldBounds = world.getBoundingClientRect()
      stage.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: worldBounds.left + worldBounds.width * target.x / 100, clientY: worldBounds.top + worldBounds.height * target.y / 100 }))
      ;(window as Window & { __restroomApproachCancelled?: boolean }).__restroomApproachCancelled = true
    }
    const observer = new MutationObserver(() => {
      if (stage.dataset.cafeRestroomToiletUsePhase !== 'approaching') return
      observer.disconnect()
      clickAway()
    })
    observer.observe(stage, { attributes: true, attributeFilter: ['data-cafe-restroom-toilet-use-phase'] })
  }, { target: local(620, -35) })
  await use.click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __restroomApproachCancelled?: boolean }).__restroomApproachCancelled), { timeout: 4_000 }).toBe(true)
  await expect.poll(() => stage.getAttribute('data-cafe-restroom-toilet-use-phase'), { timeout: 4_000 }).toBe('idle')
  await expect.poll(async () => actorPosition(page), { timeout: 8_000 }).not.toEqual(startingPosition)
  await expect(toilet).not.toHaveClass(/scene-mainline-interaction--active/)
})

test('toilet use restores only local brightness, then dims again without changing color', async ({ page }, info) => {
  await openRestroom(page)
  const dimmer = page.locator('.scene-dialogue-dimmer')
  const baselineDimmerOpacity = await dimmer.evaluate(element => getComputedStyle(element).opacity)
  const toilet = page.locator(`[data-object-id="${cafeRestroomToiletId}"]`)
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect(toilet).toHaveCSS('opacity', '0.5')
  const color = (await restroomVisual(toilet)).color
  await toilet.click()
  await page.getByRole('button', { name: '使用', exact: true }).click()
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using', { timeout: 15_000 })
  await expect(toilet).toHaveAttribute('data-restroom-brightness', 'normal')
  await expect(toilet).toHaveCSS('opacity', '1')
  expect((await restroomVisual(toilet)).color).toBe(color)
  const visualEvidence = await page.evaluate(() => ({
    phase: document.querySelector<HTMLElement>('.mainline-scene-stage')?.dataset.cafeRestroomToiletUsePhase,
    dimmerOpacity: getComputedStyle(document.querySelector('.scene-dialogue-dimmer')!).opacity,
    brightness: document.querySelector<HTMLElement>('[data-object-id="cafe-restroom-toilet"]')?.dataset.restroomBrightness,
  }))
  expect(visualEvidence).toEqual({ phase: 'using', dimmerOpacity: baselineDimmerOpacity, brightness: 'normal' })
  await page.screenshot({ path: info.outputPath('restroom-toilet-use-highlight-locked.png') })
})

test('faucet toggles on and off in place, stays clickable while off, then closes on restroom exit', async ({ page }, info) => {
  await openRestroom(page)
  const faucet = page.locator(`[data-object-id="${cafeRestroomFaucetId}"]`)
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'false')
  await expect(faucet).toHaveAttribute('aria-label', new RegExp(cafeRestroomFaucetLabel))
  await expect(faucet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect(faucet).toHaveCSS('opacity', '0.5')
  const closed = await restroomVisual(faucet)

  await faucet.click()
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'true')
  await expect(faucet).toHaveAttribute('data-restroom-brightness', 'normal')
  await expect(faucet).toHaveCSS('opacity', '1')
  const open = await restroomVisual(faucet)
  expect(open.color).toBe(closed.color)
  expect(open.filter).toBe('none')
  await faucet.hover()
  await expect(faucet).toHaveCSS('opacity', '1')
  expect((await restroomVisual(faucet)).color).toBe(closed.color)
  await faucet.focus()
  await expect(faucet).toHaveCSS('opacity', '1')
  expect((await restroomVisual(faucet)).color).toBe(closed.color)
  await page.screenshot({ path: info.outputPath('restroom-faucet-open.png') })

  await faucet.click()
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'false')
  await expect(faucet).toBeVisible()
  await expect(faucet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect(faucet).toHaveCSS('opacity', '0.5')
  await expect(faucet).toBeEnabled()
  const off = await restroomVisual(faucet)
  expect(off.color).toBe(closed.color)
  expect(off.filter).toBe('none')
  await faucet.hover()
  await expect(faucet).toHaveCSS('opacity', '0.5')
  expect((await restroomVisual(faucet)).color).toBe(closed.color)
  await faucet.focus()
  await expect(faucet).toHaveCSS('opacity', '0.5')
  expect((await restroomVisual(faucet)).color).toBe(closed.color)
  await page.screenshot({ path: info.outputPath('restroom-faucet-closed-clickable.png') })

  await faucet.click()
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'true')
  const door = page.locator('button[data-storefront-cell-id*="cafe-restroom"]')
  await expect(door).toHaveCount(1)
  await door.click()
  await expect.poll(async () => {
    const position = await actorPosition(page)
    return position.x < restroom.bounds.x || position.x > restroom.bounds.x + restroom.bounds.width
      || position.y < restroom.bounds.y || position.y > restroom.bounds.y + restroom.bounds.height
  }, { timeout: 15_000 }).toBe(true)
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'false')
  await expect(faucet).toHaveAttribute('data-restroom-brightness', 'half')
  await page.screenshot({ path: info.outputPath('restroom-faucet-auto-closed-on-exit.png') })
  await door.click()
  await expect.poll(async () => {
    const position = await actorPosition(page)
    return position.x >= restroom.bounds.x && position.x <= restroom.bounds.x + restroom.bounds.width
      && position.y >= restroom.bounds.y && position.y <= restroom.bounds.y + restroom.bounds.height
  }, { timeout: 15_000 }).toBe(true)
  await expect(faucet).toHaveAttribute('data-restroom-faucet-open', 'false')
  await expect(faucet).toHaveAttribute('data-restroom-brightness', 'half')
  await expect(faucet).toHaveCSS('opacity', '0.5')
  await page.screenshot({ path: info.outputPath('restroom-faucet-reentry-half-brightness.png') })
})

test('leaving the page during the use highlight cannot leave a movement lock in a later scene', async ({ page }) => {
  await openRestroom(page)
  await page.locator(`[data-object-id="${cafeRestroomToiletId}"]`).click()
  await page.getByRole('button', { name: '使用', exact: true }).click()
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-cafe-restroom-toilet-use-phase', 'using', { timeout: 15_000 })
  await page.goto('/?scene=jijia-ancestral-home&debugRuntimeEvidence=1')
  await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-mainline-scene', 'jijia-ancestral-home')
  const tree = page.locator('[data-object-id="jijia-old-tree"]')
  await expect(tree).toBeVisible()
  await tree.click()
  await expect(tree).toHaveClass(/scene-mainline-interaction--active/)
})

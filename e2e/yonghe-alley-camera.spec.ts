import { expect, test } from '@playwright/test'

test('Yonghe back door keeps its wall opening and switches outdoor pages to indoor follow', async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const baseURL = process.env.SHARED_RUNNER_BASE_URL ?? 'http://127.0.0.1:43117'
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const steps = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort())
  await context.addInitScript(() => {
    const position = { x: 116.64583333333333, y: 34 }
    const save = JSON.stringify({
      _version: 2, currentSceneId: 'yonghe-eatery', currentPosition: position,
      scenePositions: { 'yonghe-eatery': position }, phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 11, minute: 30, weatherCycle: 'sunny' },
      gameTimeMs: 41400000, shopOrders: {}, heldConsumable: null, sceneState: {},
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: 0,
    })
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem('newtone-public-release-cutover-v1', 'center-v1')
      storage.setItem('newtone-e2e-shop-orders-synthetic-save-v1', '1')
      storage.setItem('newtone-player-save-v1', save)
    }
  })
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true })

  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  const backDoor = page.locator('button.scene-mainline-door-button[data-focus-target-group="door:yonghe-back-door"]').first()
  const observe = () => page.evaluate(() => {
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect()
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } : null
    }
    const stage = document.querySelector('.mainline-scene-stage')
    const actor = document.querySelector('[data-actor-id="protagonist"]')
    const door = document.querySelector('button[data-focus-target-group="door:yonghe-back-door"]')
    const world = document.querySelector('.scene-mainline-world')
    const transform = world ? getComputedStyle(world).transform : null
    const translated = transform?.match(/matrix\([^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,]+),\s*([^\)]+)\)/)
    const walls = [...document.querySelectorAll('.scene-mainline-wall:not(.scene-mainline-wall-door)')]
      .filter(element => (element.textContent ?? '').trim() === '墙')
      .map(element => ({ box: box(element), opacity: getComputedStyle(element).opacity }))
      .filter(item => item.box && item.box.right > 0 && item.box.x < innerWidth && item.box.bottom > 0 && item.box.y < innerHeight)
    return {
      scene: stage?.dataset.mainlineScene,
      camera: { x: translated ? Number(translated[1]) : 0, y: translated ? Number(translated[2]) : 0 },
      activeInteriors: document.querySelectorAll('[data-interior-active="true"]').length,
      actor: actor ? { box: box(actor), style: actor.getAttribute('style'), moving: actor.classList.contains('is-moving') } : null,
      door: door ? { box: box(door), disabled: door.matches(':disabled') } : null,
      worldTransform: world ? getComputedStyle(world).transform : null,
      walls, viewport: { width: innerWidth, height: innerHeight },
    }
  })
  const record = async (phase, screenshot) => {
    const state = await observe()
    steps.push({ phase, at: new Date().toISOString(), state })
    await testInfo.attach(`${phase}-state`, { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath(screenshot), fullPage: true })
    return state
  }
  const settle = async () => {
    await expect.poll(async () => (await observe()).actor?.moving, { timeout: 25_000, intervals: [250, 500, 1000] }).toBe(false)
    await page.waitForTimeout(700)
  }
  const floorClick = async (label, x, y) => {
    const hit = await page.evaluate(({ x, y }) => {
      const node = document.elementFromPoint(x, y)
      return { x, y, stage: Boolean(node?.closest('.mainline-scene-stage')), door: node?.closest('[data-focus-target-group]')?.getAttribute('data-focus-target-group') ?? null, object: node?.closest('[data-object-id]')?.getAttribute('data-object-id') ?? null }
    }, { x, y })
    expect(hit.stage && !hit.door && !hit.object, `${label} must hit walkable scene ground`).toBe(true)
    steps.push({ phase: `${label}-hit`, hit })
    await page.mouse.click(x, y)
    await settle()
    return observe()
  }
  const clickDoor = async (phase: string, expectedInteriors: number) => {
    await expect(backDoor).toBeVisible({ timeout: 15_000 })
    await expect(backDoor).toBeEnabled()
    const rect = await backDoor.boundingBox()
    expect(rect).not.toBeNull()
    const point = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 }
    expect(point.x).toBeGreaterThan(0)
    expect(point.x).toBeLessThan(1280)
    expect(point.y).toBeGreaterThan(0)
    expect(point.y).toBeLessThan(720)
    const hit = await page.evaluate(({ x, y }) => {
      const node = document.elementFromPoint(x, y)
      return node?.closest('[data-focus-target-group]')?.getAttribute('data-focus-target-group')
    }, point)
    expect(hit).toBe('door:yonghe-back-door')
    steps.push({ phase: `${phase}-click`, point, hit })
    await page.mouse.click(point.x, point.y)
    await expect.poll(async () => (await observe()).activeInteriors, { timeout: 30_000, intervals: [250, 500, 1000] }).toBe(expectedInteriors)
    await settle()
    return record(phase, `${phase}.png`)
  }

  try {
    await page.goto(`${baseURL}/?scene=yonghe-eatery&e2eShopOrders=1&debugRuntimeEvidence=1`, { waitUntil: 'networkidle', timeout: 60_000 })
    await expect(stage).toHaveAttribute('data-mainline-scene', 'yonghe-eatery')
    await expect(actor).toBeVisible()
    await expect.poll(async () => (await observe()).activeInteriors).toBe(9)
    const start = await record('interior-start', '00-interior-start.png')

    const doorRect = await backDoor.boundingBox()
    if (!doorRect || doorRect.x < 0 || doorRect.y < 0 || doorRect.x + doorRect.width > 1280 || doorRect.y + doorRect.height > 720) {
      await floorClick('approach-rear-door', 1050, 102)
    }
    await expect(backDoor).toBeVisible({ timeout: 15_000 })
    const alley = await clickDoor('alley-arrival', 6)
    expect(alley.scene).toBe('yonghe-eatery')
    expect(alley.door?.disabled).toBe(false)
    expect(alley.door?.box).not.toBeNull()
    expect(alley.door?.box?.x).toBeGreaterThan(0)
    expect(alley.door?.box?.right).toBeLessThan(1280)
    expect(alley.door?.box?.y).toBeGreaterThan(0)
    expect(alley.door?.box?.bottom).toBeLessThan(720)
    expect(alley.walls.length).toBeGreaterThan(0)

    const beforeWest = alley.camera.x
    const actorBox = alley.actor?.box
    expect(actorBox).not.toBeNull()
    const west = await floorClick('walk-west-across-page', 150, actorBox!.y + actorBox!.height / 2)
    expect(west.camera.x).toBeGreaterThan(beforeWest + 1)
    await record('alley-west-page', '02-alley-west-page.png')

    let east = west
    for (let attempt = 0; attempt < 4; attempt++) {
      const currentDoor = await backDoor.boundingBox()
      if (currentDoor && currentDoor.x >= 0 && currentDoor.right <= 1280 && currentDoor.y >= 0 && currentDoor.bottom <= 720) break
      const currentActor = await actor.boundingBox()
      await floorClick(`walk-east-${attempt + 1}`, 1160, (currentActor?.y ?? 360) + (currentActor?.height ?? 0) / 2)
      east = await observe()
    }
    expect(east.camera.x).toBeLessThan(west.camera.x - 1)
    const doorOnReturnPage = await backDoor.boundingBox()
    expect(doorOnReturnPage).not.toBeNull()
    expect(doorOnReturnPage!.x).toBeGreaterThanOrEqual(0)
    expect(doorOnReturnPage!.right).toBeLessThanOrEqual(1280)
    await record('alley-east-page-door-visible', '03-alley-east-page.png')

    const returned = await clickDoor('shop-return', 9)
    const returnedActor = returned.actor?.box
    expect(returned.scene).toBe('yonghe-eatery')
    expect(returned.door?.disabled).toBe(false)
    expect(returnedActor).not.toBeNull()
    expect(returnedActor!.x).toBeGreaterThan(1280 * .3)
    expect(returnedActor!.right).toBeLessThan(1280 * .7)
    expect(errors).toEqual([])
    steps.push({ phase: 'summary', start, alley, west, east, returned, errors })
  } finally {
    await testInfo.attach('business-steps', { body: JSON.stringify(steps, null, 2), contentType: 'application/json' })
    await context.tracing.stop({ path: testInfo.outputPath('trace.zip') })
    await context.close()
  }
})

import { expect, test } from '@playwright/test'
import { mainlinePassageSide } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

async function advanceDialogue(page: import('@playwright/test').Page, maximumAdvances: number) {
  const dialogue = page.locator('[data-scene-dialogue]').first()
  for (let index = 0; index < maximumAdvances; index += 1) {
    if (await dialogue.count() === 0) return
    const previousText = await dialogue.textContent()
    const transition = page.evaluate((previousText) => new Promise<void>((resolve) => {
      const hasAdvanced = () => {
        const current = document.querySelector<HTMLElement>('[data-scene-dialogue]')
        return !current || current.textContent !== previousText
      }
      if (hasAdvanced()) return resolve()
      const observer = new MutationObserver(() => {
        if (!hasAdvanced()) return
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dialogue-line-id'] })
    }), previousText)
    await dialogue.click({ force: true })
    await transition
  }
  await expect(dialogue).toHaveCount(0)
}

type RuntimePoint = { x: number; y: number }

function runtimePoint(attributes: { x: string | null; y: string | null }): RuntimePoint {
  const x = Number(attributes.x)
  const y = Number(attributes.y)
  expect(Number.isFinite(x)).toBe(true)
  expect(Number.isFinite(y)).toBe(true)
  return { x, y }
}

async function runtimePosition(locator: import('@playwright/test').Locator, kind: 'runtime' | 'rendered' = 'runtime') {
  return runtimePoint({
    x: await locator.getAttribute(`data-${kind}-x`),
    y: await locator.getAttribute(`data-${kind}-y`),
  })
}

function pointDistance(first: RuntimePoint, second: RuntimePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function boxesOverlap(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y
}

type CollisionRegion = { x: number; y: number; width: number; height: number }

async function furnitureNavigationRegions(page: import('@playwright/test').Page): Promise<CollisionRegion[]> {
  return page.locator('[data-object-id]').evaluateAll((nodes) => {
    const read = (node: Element) => ({
      id: (node as HTMLElement).dataset.objectId!,
      tableId: (node as HTMLElement).dataset.seatTableId,
      side: (node as HTMLElement).dataset.seatSide,
      x: Number((node as HTMLElement).dataset.collisionX),
      y: Number((node as HTMLElement).dataset.collisionY),
      width: Number((node as HTMLElement).dataset.collisionWidth),
      height: Number((node as HTMLElement).dataset.collisionHeight),
    })
    const objects = nodes.map(read).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isFinite(item.width) && Number.isFinite(item.height))
    // APPROVED CONTRACT MIGRATION: furniture relations are crossing barriers,
    // not hidden occupied rectangles. This browser assertion checks only
    // actual visible collision bodies; navigation-barrier.spec.ts proves that
    // their internal relation still cannot be crossed.
    return objects
      .filter((item) => item.tableId || item.id.endsWith('-table') || item.id.includes('-table-'))
      .map(({ x, y, width, height }) => ({ x, y, width, height }))
  })
}

function expectRouteOutsideRegions(points: readonly RuntimePoint[], regions: readonly CollisionRegion[]) {
  points.forEach((point) => regions.forEach((region) => {
    expect(point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height).toBe(false)
  }))
}

async function collectActorPositions(page: import('@playwright/test').Page, actorId: string, frames = 180): Promise<RuntimePoint[]> {
  return page.evaluate(async ({ actorId, frames }) => {
    const positions: RuntimePoint[] = []
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const actor = document.querySelector<HTMLElement>(`[data-actor-id="${actorId}"]`)
      const x = Number(actor?.dataset.runtimeX)
      const y = Number(actor?.dataset.runtimeY)
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      const last = positions.at(-1)
      if (!last || Math.hypot(last.x - x, last.y - y) > .002) positions.push({ x, y })
    }
    return positions
  }, { actorId, frames })
}

/** Wait on actual runtime attribute mutation instead of polling a moving actor. */
async function waitForActorYBefore(page: import('@playwright/test').Page, actorId: string, maximum: number) {
  await page.evaluate(async ({ actorId, maximum }) => new Promise<void>((resolve) => {
    const actor = document.querySelector<HTMLElement>(`[data-actor-id="${actorId}"]`)
    if (!actor) throw new Error(`Missing actor ${actorId}`)
    const hasArrived = () => Number(actor.dataset.runtimeY) < maximum
    if (hasArrived()) {
      resolve()
      return
    }
    const observer = new MutationObserver(() => {
      if (!hasArrived()) return
      observer.disconnect()
      resolve()
    })
    observer.observe(actor, { attributes: true, attributeFilter: ['data-runtime-y'] })
  }), { actorId, maximum })
}

/** Wait for actual runtime entry into the public side, not merely a duty transition. */
async function waitForActorYAfter(page: import('@playwright/test').Page, actorId: string, minimum: number) {
  await page.evaluate(async ({ actorId, minimum }) => new Promise<void>((resolve) => {
    const actor = document.querySelector<HTMLElement>(`[data-actor-id="${actorId}"]`)
    if (!actor) throw new Error(`Missing actor ${actorId}`)
    const hasEntered = () => Number(actor.dataset.runtimeY) > minimum
    if (hasEntered()) {
      resolve()
      return
    }
    const observer = new MutationObserver(() => {
      if (!hasEntered()) return
      observer.disconnect()
      resolve()
    })
    observer.observe(actor, { attributes: true, attributeFilter: ['data-runtime-y'] })
  }), { actorId, minimum })
}

function expectUniqueProgress(points: RuntimePoint[]) {
  expect(points.length).toBeGreaterThan(1)
  points.slice(1).forEach((point, index) => expect(pointDistance(point, points[index]!)).toBeGreaterThan(.001))
}

async function café(page: import('@playwright/test').Page, search: string) {
  await page.goto(`/?scene=commercial-cafe&debugRuntimeEvidence=1&${search}`)
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-debug-runtime-evidence', 'true')
}

async function clickCafeWorldPoint(page: import('@playwright/test').Page, point: RuntimePoint) {
  const stage = page.locator('.mainline-scene-stage').first()
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  const camera = {
    x: Number(await stage.getAttribute('data-camera-offset-x')),
    y: Number(await stage.getAttribute('data-camera-offset-y')),
  }
  const position = {
    x: Math.round(bounds!.width * ((point.x + camera.x) / 100)),
    y: Math.round(bounds!.height * ((point.y + camera.y) / 100)),
  }
  await stage.click({ position })
  return {
    x: position.x / bounds!.width * 100 - camera.x,
    y: position.y / bounds!.height * 100 - camera.y,
  }
}

async function expectWorldMarkerAt(marker: import('@playwright/test').Locator, point: RuntimePoint) {
  await expect(marker).toHaveCount(1)
  const actual = await marker.evaluate((node) => ({
    x: Number.parseFloat((node as HTMLElement).style.left),
    y: Number.parseFloat((node as HTMLElement).style.top),
  }))
  expect(actual.x).toBeCloseTo(point.x, 3)
  expect(actual.y).toBeCloseTo(point.y, 3)
}

test('isolated café fixture keeps stage in memory and proves presentation lifecycle', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(page.locator('[data-object-id="commercial-cafe-right-window-upper-group-table"]').getByText('桌子', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(0)
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible()
  await page.screenshot({ path: 'test-results/cafe-coffee-delivered.png', fullPage: true })
})

test('fresh isolated cafe orders coffee through a physical counter segment and persists the stage only after choice', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  const orderChoice = page.getByRole('button', { name: '点一杯咖啡' })
  await expect(orderChoice).toBeVisible({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await orderChoice.click()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
})

test('menu and blackboard remain visual wall features but resolve customer-side floor contacts', async ({ page }) => {
  for (const [entityId, start] of [['commercial-cafe-menu', '18,30'], ['commercial-cafe-blackboard', '32,30']] as const) {
    await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${start}`)
    const protagonist = page.locator('[data-actor-id="protagonist"]')
    await page.getByRole('button', { name: new RegExp(entityId.endsWith('menu') ? '菜单' : '黑板') }).click()
    await expect(protagonist).toHaveAttribute('data-runtime-y', /2[1-9](?:\.|$)/, { timeout: 30_000 })
  }
})

test('APPROVED CONTRACT MIGRATION: staff-area clicks retain the raw marker while shared navigation resolves the public-side stop', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafePlayerPosition=55,24')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  const staffRegion = {
    x: Number(await scene.getAttribute('data-e2e-access-region-x')),
    y: Number(await scene.getAttribute('data-e2e-access-region-y')),
    width: Number(await scene.getAttribute('data-e2e-access-region-width')),
    height: Number(await scene.getAttribute('data-e2e-access-region-height')),
  }
  const requested = { x: staffRegion.x + staffRegion.width / 2, y: staffRegion.y + staffRegion.height / 2 }
  const clicked = await clickCafeWorldPoint(page, requested)
  await expect(page.locator('.scene-mainline-echo')).toContainText('还是别进去打扰他们工作了', { timeout: 30_000 })
  const marker = page.locator('.scene-walk-target')
  await expectWorldMarkerAt(marker, clicked)
  const final = await runtimePosition(page.locator('[data-actor-id="protagonist"]'))
  expect(pointDistance(final, requested)).toBeGreaterThan(.2)
})

test('an inaccessible direct cafe back-door click does not bypass staff access or start its locked lifecycle', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafePlayerPosition=55,24')
  const backDoor = page.locator('[data-focus-target-group="door:cafe-back-door"]').first()
  await expect(backDoor).toHaveAttribute('data-focus-passage-phase', 'closed')

  await backDoor.click()

  await expect(backDoor).toHaveAttribute('data-focus-passage-phase', 'closed')
  await expect(page.locator('.scene-feedback')).toContainText('这扇门当前无法从这里靠近。')
  await expect(page.locator('.scene-mainline-echo')).toHaveCount(0)
})

test('a DEV-only server route reaches the cafe back-door approach before the shared locked lifecycle denies it', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafeServerBackDoor=1')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-e2e-server-back-door', 'true')
  const backDoor = page.locator('[data-focus-target-group="door:cafe-back-door"]').first()
  const server = page.locator('[data-npc-id="server"]')
  const before = await runtimePosition(server)

  await expect(scene).toHaveAttribute('data-e2e-server-back-door-status', 'lifecycle-requested', { timeout: 30_000 })
  expect(pointDistance(await runtimePosition(server), before)).toBeGreaterThan(.2)
  await expect(backDoor).toHaveAttribute('data-focus-passage-phase', 'closed')
  await expect(page.locator('.scene-mainline-echo')).toContainText('后门暂未开启')
})

test('a world route ending in front of the cafe exit does not open the door', async ({ page }) => {
  const cafe = mainlineScenes['commercial-cafe']
  const start = cafe.initialPlayerPosition
  await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${start.x},${start.y}`)
  const exitDoor = page.locator('[data-focus-target-group="door:street-cafe-entry"]').first()
  const exit = cafe.passages.find((passage) => passage.id === 'street-cafe-entry')!
  const requested = exit.thresholds[mainlinePassageSide(exit, start)]

  await expect(exitDoor).toHaveAttribute('data-focus-passage-phase', 'closed')
  const clicked = await clickCafeWorldPoint(page, requested)
  await expect(page.locator('.scene-feedback')).toContainText('修杰停在这里。', { timeout: 30_000 })
  await expect(exitDoor).toHaveAttribute('data-focus-passage-phase', 'closed')
  const marker = page.locator('.scene-walk-target')
  await expectWorldMarkerAt(marker, clicked)
})

test('an isolated real save retains coffee order after browser reload without touching a user profile', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await page.getByRole('button', { name: '点一杯咖啡' }).click({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
  await page.reload()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
})

test('server begins an ambient semantic duty without a debug control and moves under its own coordinator', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.prepare')
  const motion = await page.evaluate(async () => {
    const server = document.querySelector('[data-npc-id="server"]')
    const before = server?.getAttribute('style')
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return { before, after: server?.getAttribute('style') }
  })
  expect(motion.after).not.toBe(motion.before)
})

test('fresh isolated player completes the authored cafe story through dialogue, delivery, props, exit, and persisted resolution', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()

  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await page.getByRole('button', { name: '点一杯咖啡' }).click({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')

  await page.locator('[data-npc-id="lao-zhou"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-lao-zhou-seat-guide', { timeout: 30_000 })
  await advanceDialogue(page, 4)

  await page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-bottom"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-lao-zhou-first-xiujie', { timeout: 30_000 })
  await advanceDialogue(page, 8)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'met-lao-zhou')

  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await page.locator('[data-attached-prop-id="commercial-cafe-coffee"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-coffee-xiujie')
  await advanceDialogue(page, 40)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'intel-received')

  await page.locator('[data-npc-id="lao-zhou"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-resolution-xiujie')
  await advanceDialogue(page, 12)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(1)
  await expect(page.locator('[data-object-id="commercial-cafe-right-window-upper-group-table"]').getByText('桌子', { exact: true })).toHaveCount(0)
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]').first()).toBeVisible({ timeout: 30_000 })
  const savedStage = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-cafe']?.commercialCafeStoryStage
  })
  expect(savedStage).toBe('complete')
  await page.goto('/?scene=commercial-cafe')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'complete')
  await page.reload()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'complete')
})

test('ready-to-leave café exits through the authored passage rather than completing on dialogue alone', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=ready-to-leave')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]').first()).toBeVisible({ timeout: 30_000 })
})

test('debug stage never uses the player save and resolves old prototype information in the shared dialogue surface', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1')
  await page.locator('[data-attached-prop-id="commercial-cafe-coffee"]').click()
  await expect(page.getByText('你还是不爱喝咖啡')).toBeVisible()
  await advanceDialogue(page, 40)
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'intel-received')
  await page.locator('[data-npc-id="lao-zhou"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-resolution-xiujie')
  await advanceDialogue(page, 12)
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(1)
})

test('met Lao Zhou starts one real server delivery, reveals coffee on arrival, then returns through shared movement', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/?scene=commercial-cafe&debugCafeStage=met-lao-zhou&debugCafeFixture=1')
  await page.bringToFront()
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  const serverAdvanced = await page.evaluate(async () => {
    const server = document.querySelector('[data-npc-id="server"]')
    const before = server?.getAttribute('style')
    await new Promise<void>((resolve) => {
      let frames = 0
      const next = () => {
        frames += 1
        if (frames >= 12) resolve()
        else requestAnimationFrame(next)
      }
      requestAnimationFrame(next)
    })
    return { before, after: server?.getAttribute('style') }
  })
  expect(pageErrors).toEqual([])
  expect(serverAdvanced.after).not.toBe(serverAdvanced.before)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.return-to-counter', { timeout: 30_000 })
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.prepare', { timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-server-behavior', 'ambient-moving')
})

test('isolated browser executes animation frames used by shared actor locomotion', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const frameTime = await page.evaluate(() => new Promise<number>((resolve) => requestAnimationFrame(resolve)))
  expect(frameTime).toBeGreaterThan(0)
})

test('debug harness click stays inside its control and cannot bubble into scene walking', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1&debugNpcMovement=1')
  const seatedProtagonist = page.getByLabel('修杰，已坐下')
  await expect(seatedProtagonist).toHaveCount(1)
  await page.getByRole('button', { name: '演示店员移动' }).dispatchEvent('click')
  await expect(seatedProtagonist).toHaveCount(1)
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
})

test('ordinary cafe entity proximity uses distinct legal contacts and does not move an already-near protagonist', async ({ page }) => {
  const entityId = 'commercial-cafe-right-inner-middle-group-table'
  const contacts: RuntimePoint[] = []
  for (const start of ['60,50', '80,50']) {
    await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${start}`)
    const protagonist = page.locator('[data-actor-id="protagonist"]')
    await expect(protagonist).toHaveAttribute('data-runtime-x', start.split(',')[0]!)
    await expect(protagonist).toHaveAttribute('data-runtime-y', start.split(',')[1]!)
    const motion = collectActorPositions(page, 'protagonist')
    await page.locator(`[data-object-id="${entityId}"]`).click()
    const points = await motion
    expectUniqueProgress(points)
    contacts.push(await runtimePosition(protagonist))
  }
  // Both routes end at a real actor-radius contact, but they do not collapse
  // to one authored table approach point.
  expect(contacts[0]).not.toEqual(contacts[1])
  expect(pointDistance(contacts[0]!, contacts[1]!)).toBeGreaterThan(.1)

  const contact = contacts[0]!
  await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${contact.x},${contact.y}`)
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const before = await runtimePosition(protagonist)
  await page.locator(`[data-object-id="${entityId}"]`).click()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  expect(await runtimePosition(protagonist)).toEqual(before)
})

test('NPC proximity reaches Lao Zhou from distinct sides without reusing a fixed approach', async ({ page }) => {
  const contacts: RuntimePoint[] = []
  for (const start of ['76,26', '84,36']) {
    await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${start}`)
    const protagonist = page.locator('[data-actor-id="protagonist"]')
    await expect(protagonist).toHaveAttribute('data-runtime-x', start.split(',')[0]!)
    await expect(protagonist).toHaveAttribute('data-runtime-y', start.split(',')[1]!)
    const motion = collectActorPositions(page, 'protagonist')
    await page.locator('[data-npc-id="lao-zhou"]').click()
    const points = await motion
    expect(points.length).toBeGreaterThan(0)
    const npc = await runtimePosition(page.locator('[data-npc-id="lao-zhou"]'))
    const contact = await runtimePosition(protagonist)
    expect(pointDistance(contact, npc)).toBeGreaterThan(.4)
    contacts.push(contact)
  }
  // Both routes end at a real actor-radius contact, but they must not collapse
  // to one authored approach coordinate.  The exact separation is geometry-
  // dependent, so assert distinct resolved contacts rather than a made-up gap.
  expect(contacts[0]).not.toEqual(contacts[1])
  expect(pointDistance(contacts[0]!, contacts[1]!)).toBeGreaterThan(.1)
})

test('real protagonist routes around two-seat and four-seat furniture while a free seat still performs pulled-to-sit', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafePlayerPosition=60,50')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const twoSeatMotion = collectActorPositions(page, 'protagonist')
  await page.locator('[data-object-id="commercial-cafe-right-inner-middle-group-table"]').click()
  const twoSeatRoute = await twoSeatMotion
  expectUniqueProgress(twoSeatRoute)
  expectRouteOutsideRegions(twoSeatRoute, await furnitureNavigationRegions(page))
  expect((await runtimePosition(protagonist)).x).toBeGreaterThan(63.5)

  await café(page, 'debugCafeStage=entered&debugCafePlayerPosition=30,70')
  const fourSeatMotion = collectActorPositions(page, 'protagonist')
  await page.locator('[data-object-id="commercial-cafe-bottom-center-group-table"]').click()
  const fourSeatRoute = await fourSeatMotion
  expectUniqueProgress(fourSeatRoute)
  expectRouteOutsideRegions(fourSeatRoute, await furnitureNavigationRegions(page))
  expect((await runtimePosition(protagonist)).x).toBeGreaterThan(36)

  await café(page, 'debugCafeStage=entered&debugCafePlayerPosition=64,58')
  await page.locator('[data-object-id="commercial-cafe-right-inner-middle-group-chair-bottom"]').click()
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
})

test('each four-seat chair still uses the outside-to-pulled-to-sit interaction path', async ({ page }) => {
  const seats = [
    ['commercial-cafe-bottom-center-group-chair-top', '30,70'],
    ['commercial-cafe-bottom-center-group-chair-right', '54,70'],
    ['commercial-cafe-bottom-center-group-chair-bottom', '30,88'],
    ['commercial-cafe-bottom-center-group-chair-left', '54,88'],
  ] as const
  for (const [seatId, start] of seats) {
    await café(page, `debugCafeStage=entered&debugCafePlayerPosition=${start}`)
    await page.locator(`[data-object-id="${seatId}"]`).click()
    // The visual label is an inner span; occupancy belongs to the actor wrapper.
    await expect(page.locator('[data-actor-id="protagonist"]')).toHaveAttribute('data-seat-entity-id', seatId, { timeout: 30_000 })
    await expect(page.getByLabel('修杰，已坐下')).toBeVisible()
    await expect(page.locator(`[data-object-id="${seatId}"]`).getByText('椅子', { exact: true })).toHaveCount(0)
  }
})

test('server delivery route provides continuous runtime evidence and never duplicates the server actor', async ({ page }) => {
  await café(page, 'debugCafeStage=met-lao-zhou&debugCafeFixture=1')
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  const motion = await collectActorPositions(page, 'server')
  expectUniqueProgress(motion)
  expectRouteOutsideRegions(motion, await furnitureNavigationRegions(page))
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-npc-id="server"]')).toHaveCount(1)
})

test('ambient movement is interrupted by one real story delivery without a stale ambient arrival', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafeStoryInterrupt=1&debugCafeFixture=1')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee', { timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-server-behavior', 'delivering')
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.return-to-counter', { timeout: 30_000 })
})

test('a DEV-only dynamic actor blocks delivery without teleporting or progressing the story, then reload recovery delivers once', async ({ page }) => {
  await café(page, 'debugCafeStage=met-lao-zhou&debugCafeFixture=1&debugCafeServerBlocker=1')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  const blockedPosition = await runtimePosition(server)
  await expect(server).toHaveAttribute('data-npc-phase', 'blocked', { timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'met-lao-zhou')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(0)
  expect(await runtimePosition(server)).toEqual(blockedPosition)

  await café(page, 'debugCafeStage=met-lao-zhou&debugCafeFixture=1')
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
})

test('a dynamically occupied nearest table contact falls back to another legal delivery contact', async ({ page }) => {
  await café(page, 'debugCafeStage=met-lao-zhou&debugCafeFixture=1&debugCafeServerBlocker=nearest')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  await expect(scene).toHaveAttribute('data-e2e-server-blocker-x', /.+/)
  const blocker = runtimePoint({
    x: await scene.getAttribute('data-e2e-server-blocker-x'),
    y: await scene.getAttribute('data-e2e-server-blocker-y'),
  })
  const selected = runtimePoint({
    x: await server.getAttribute('data-npc-target-x'),
    y: await server.getAttribute('data-npc-target-y'),
  })
  expect(pointDistance(selected, blocker)).toBeGreaterThan(.1)
  await expect(server).not.toHaveAttribute('data-npc-phase', 'blocked')
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
})

test('ambient service crosses staff and public areas with semantic table work before returning to the counter', async ({ page }) => {
  await café(page, 'debugCafeStage=entered')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  const counterY = Number(await scene.getAttribute('data-e2e-counter-structure-y'))
  const counterHeight = Number(await scene.getAttribute('data-e2e-counter-structure-height'))
  const counter = {
    x: Number(await scene.getAttribute('data-e2e-counter-structure-x')),
    width: Number(await scene.getAttribute('data-e2e-counter-structure-width')),
  }
  expect(Number.isFinite(counter.x) && Number.isFinite(counter.width)).toBe(true)
  const motion = collectActorPositions(page, 'server', 540)

  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.table-service', { timeout: 30_000 })
  await expect(server).toHaveAttribute('data-npc-target-id', /-table/)
  await waitForActorYAfter(page, 'server', counterY + counterHeight)
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.counter-service', { timeout: 30_000 })
  await waitForActorYBefore(page, 'server', counterY)

  const points = await motion
  expectUniqueProgress(points)
  expectRouteOutsideRegions(points, [...await furnitureNavigationRegions(page), { x: counter.x, y: counterY, width: counter.width, height: counterHeight }])
})

test('a story delivery interrupts an active public table-service duty from its live position', async ({ page }) => {
  await café(page, 'debugCafeStage=entered&debugCafeFixture=1&debugCafeStoryInterrupt=public')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(scene).toHaveAttribute('data-e2e-story-interrupt-from-duty', 'server.table-service', { timeout: 30_000 })
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
})

test('reload fixtures recover delivery and preserve delivered and ready-to-leave presentation without duplicate delivery', async ({ page }) => {
  await café(page, 'debugCafeStage=met-lao-zhou&debugCafeFixture=1')
  await expect(page.locator('[data-npc-id="server"]')).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  await page.reload()
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)

  await café(page, 'debugCafeStage=coffee-delivered&debugCafeFixture=1')
  await page.reload()
  await expect(page.locator('[data-npc-id="server"]')).not.toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)

  await café(page, 'debugCafeStage=ready-to-leave&debugCafeFixture=1')
  await page.reload()
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(1)
})

test('objective seated and cafe presentation anchors agree with the rendered DOM', async ({ page }) => {
  await café(page, 'debugCafeStage=coffee-delivered&debugCafeFixture=1')
  const stage = page.locator('[data-mainline-scene="commercial-cafe"].mainline-scene-stage')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const laoZhou = page.locator('[data-npc-id="lao-zhou"]')
  const playerSeat = page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-bottom"]')
  const laoSeat = page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-top"]')
  expect(await runtimePosition(protagonist, 'rendered')).toEqual(await runtimePosition(playerSeat, 'rendered'))
  expect(await runtimePosition(laoZhou, 'rendered')).toEqual(await runtimePosition(laoSeat, 'rendered'))
  // APPROVED CONTRACT MIGRATION: a stable seated NPC no longer keeps a
  // collision-safe offset apart from its visual anchor. The visible label and
  // NavigationRuntime obstacle use the same occupied-seat center.
  expect(await runtimePosition(laoZhou)).toEqual(await runtimePosition(laoZhou, 'rendered'))
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
  await expect(page.locator('[data-npc-id="lao-zhou"]')).toHaveCount(1)
  await expect(page.locator('[data-npc-id="server"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(page.locator('[data-object-id="commercial-cafe-right-window-upper-group-table"]').getByText('桌子', { exact: true })).toHaveCount(0)
  await expect(playerSeat.getByText('椅子', { exact: true })).toHaveCount(0)
  await expect(laoSeat.getByText('椅子', { exact: true })).toHaveCount(0)
  const server = page.locator('[data-npc-id="server"]')
  const counterCell = page.locator('[data-object-id="commercial-cafe-counter"]')
  const counter = runtimePoint({
    x: await stage.getAttribute('data-e2e-counter-structure-x'),
    y: await stage.getAttribute('data-e2e-counter-structure-y'),
  })
  const [stageBox, protagonistBox, seatBox, serverBox, counterBox] = await Promise.all([stage.boundingBox(), protagonist.boundingBox(), playerSeat.boundingBox(), server.boundingBox(), counterCell.boundingBox()])
  expect(stageBox).not.toBeNull()
  expect(protagonistBox).not.toBeNull()
  expect(seatBox).not.toBeNull()
  expect(serverBox).not.toBeNull()
  expect(counterBox).not.toBeNull()
  expect(Math.abs((protagonistBox!.x + protagonistBox!.width / 2) - (seatBox!.x + seatBox!.width / 2))).toBeLessThan(.1)
  expect(Math.abs((protagonistBox!.y + protagonistBox!.height / 2) - (seatBox!.y + seatBox!.height / 2))).toBeLessThan(.1)
  expect(boxesOverlap(serverBox!, counterBox!)).toBe(false)
  const serverPosition = await runtimePosition(server)
  const counterWidth = Number(await stage.getAttribute('data-e2e-counter-structure-width'))
  const counterHeight = Number(await stage.getAttribute('data-e2e-counter-structure-height'))
  expect(Number.isFinite(counterWidth) && Number.isFinite(counterHeight)).toBe(true)
  expect(
    serverPosition.x >= counter.x
      && serverPosition.x <= counter.x + counterWidth
      && serverPosition.y >= counter.y
      && serverPosition.y <= counter.y + counterHeight,
  ).toBe(false)
})

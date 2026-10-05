import { expect, test, type Page } from '@playwright/test'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { navigationBarrierBlocksTravel } from '../src/center/runtime/scenePathfinding'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'
import { mainlineRidePickupPositions } from '../src/center/runtime/mainlineRide'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })
async function reading(page: Page) {
  for (let index = 0; index < 25; index += 1) {
    const shield = page.locator('[data-scene-dialogue-shield="true"]')
    if (!await shield.count()) return
    const echo = page.locator('[data-scene-observation-typing="true"]')
    if (await echo.count()) await expect(echo).toHaveCount(0, { timeout: 15000 })
    await shield.click({ force: true })
    await page.waitForTimeout(120)
  }
}
async function point(page: Page, target: { x: number; y: number }) {
  const screen = await page.locator('.mainline-scene-stage').evaluate((element, point) => {
    const r = element.getBoundingClientRect()
    const transform = (element.querySelector('.scene-mainline-world') as HTMLElement).style.transform
    const offsets = transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)!
    return { x: r.x + r.width * (point.x + Number(offsets[1])) / 100, y: r.y + r.height * (point.y + Number(offsets[2])) / 100 }
  }, target)
  await page.mouse.click(screen.x, screen.y)
}
async function moveAcrossStreet(page: Page, targetX: number) {
  for (let step = 0; step < 30; step += 1) {
    if (!await page.locator('.scene-shell[data-mainline-scene="commercial-street"]').count()) return
    await reading(page)
    const actor = page.locator('[data-actor-id="protagonist"]')
    const x = await actor.evaluate(element => parseFloat((element as HTMLElement).style.left))
    if (Math.abs(x - targetX) < 2) return
    await point(page, { x: x + Math.sign(targetX - x) * Math.min(22, Math.abs(targetX - x)), y: 46 })
    await expect.poll(async () => Math.abs(await actor.evaluate(element => parseFloat((element as HTMLElement).style.left)) - x), { timeout: 15000 }).toBeGreaterThan(0.1)
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15000 })
  }
  throw new Error('Street walking did not reach its target')
}
async function requestRide(page: Page, destination: string) {
  const phone = page.locator('.world-phone')
  await expect(phone).toHaveAttribute('data-phone-device', 'inner', { timeout: 10000 })
  if (!await phone.getAttribute('class').then(c => c?.includes('is-open'))) await page.getByLabel('打开手机').click()
  if (!await phone.locator('section[aria-label="叫车"]').isVisible()) await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: new RegExp(destination + '.*从当前位置出发') }).click()
  await phone.getByRole('button', { name: '呼叫车辆前往' + destination, exact: true }).click()
}
async function pickup(page: Page, targetScene: string) {
  if (await page.locator('.world-phone.is-open').count()) await page.getByLabel('收起手机').click()
  const sceneId = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene')
  await point(page, mainlineRidePickupPositions(sceneId as keyof typeof mainlineScenes)[0])
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="' + targetScene + '"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.center-long-distance-travel')).toHaveCount(0, { timeout: 10000 })
  await expect(page.locator('.center-experience')).not.toHaveAttribute('data-long-distance-phase', /.+/)
}

test('real Cafe ride order waits independently, boards only at Street pickup, and preserves the reverse ride', async ({ page }, info) => {
  test.setTimeout(150000)
  const errors: string[] = []
  await page.addInitScript(() => {
    const original = console.error
    console.error = (...args) => {
      if (args.some(arg => String(arg).includes('Maximum update depth'))) console.log('P1_UPDATE_STACK', new Error().stack)
      original(...args)
    }
  })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.text().includes('P1_UPDATE_STACK')) console.log(message.text())
    if (message.text().includes('Maximum update depth')) {
      errors.push(message.text())
      console.log('REACT_UPDATE_DEPTH_LOCATION', message.location())
    }
  })
  await page.route('**/rest/v1/analytics_events**', route => route.fulfill({ status: 201, body: '' }))
  await page.goto('/?scene=zhongshuyuan-office&debugRuntimeEvidence=1')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toBeVisible({ timeout: 15000 })
  await reading(page)
  await page.getByRole('button', { name: '换手机', exact: true }).click()
  await requestRide(page, '商业街')
  await pickup(page, 'commercial-street')
  await moveAcrossStreet(page, 185)
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.center-local-slide__surface--target .scene-shell')).toHaveCount(0)
  for (let visit = 0; visit < 3; visit += 1) {
    await point(page, { x: 64, y: 60 })
    await expect.poll(async () => page.locator('[data-actor-id="protagonist"]').evaluate(element => parseFloat((element as HTMLElement).style.left))).toBeCloseTo(64, 0)
    await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
    await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
    await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toHaveCount(0, { timeout: 15000 })
    await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
    await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.center-local-slide__surface--target .scene-shell')).toHaveCount(0)
  }
  await point(page, { x: 64, y: 60 })
  await expect.poll(async () => page.locator('[data-actor-id="protagonist"]').evaluate(element => parseFloat((element as HTMLElement).style.left))).toBeCloseTo(64, 0)
  await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/)
  await requestRide(page, '中枢院')
  const order = page.locator('[data-ride-order="true"]')
  await expect(order).toContainText('司机预计')
  await page.screenshot({ path: info.outputPath('cafe-ride-eta.png') })
  await expect(order).toContainText('请回到商业街口等车')
  await expect(order).not.toContainText(/第一章|上车点/)
  await page.getByLabel('收起手机').click()
  const staffArea = mainlineScenes['commercial-cafe'].accessRegions.find(region => region.requiredAccess === 'staff')!
  await point(page, { x: staffArea.x + staffArea.width / 2, y: staffArea.y + staffArea.height / 2 })
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible({ timeout: 15000 })
  const deadline = await page.evaluate(() => {
    const save=JSON.parse(localStorage.getItem('newtone-player-save-v1')!)
    return save.sceneState['commercial-street'].rideDriverArrivesAt
  })
  await expect.poll(() => Date.now(), { timeout: 30000 }).toBeGreaterThanOrEqual(deadline)
  await expect(page.locator('.world-phone')).not.toHaveClass(/is-open/)
  await expect(page.locator('[data-scene-dialogue-shield="true"]')).toBeVisible()
  await reading(page)
  await expect(page.locator('[data-notification-app="ride"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('[data-notification-app="ride"]')).toContainText('正在商业街口等你')
  await page.screenshot({ path: info.outputPath('ride-reading-deferred-notification.png') })
  await page.locator('.world-phone__lock-hint').click()
  await expect(page.locator('[data-app="ride"]')).toHaveAttribute('data-unread', 'true')
  await page.reload()
  await page.getByLabel('打开手机').click()
  await expect(page.locator('[data-app="ride"]')).toHaveAttribute('data-unread', 'true')
  await page.locator('[data-app="ride"]').click()
  await expect(order).toContainText('司机已到达')
  await page.getByLabel('返回手机主屏').click()
  await expect(page.locator('[data-app="ride"]')).toHaveAttribute('data-unread', 'false')
  await page.locator('[data-app="ride"]').click()
  await page.screenshot({ path: info.outputPath('cafe-driver-waiting.png') })
  await page.getByLabel('收起手机').click()
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.center-local-slide__surface--target .scene-shell')).toHaveCount(0)
  await moveAcrossStreet(page, mainlineRidePickupPositions('commercial-street')[0].x)
  if (await page.locator('.scene-shell[data-mainline-scene="commercial-street"]').count()) await point(page, mainlineRidePickupPositions('commercial-street')[0])
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-office"]')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.center-long-distance-travel')).toHaveCount(0, { timeout: 10000 })
  expect(errors).toEqual([])
})


test('real scrolling clicks respect the deadzone and smooth camera; fixed Cafe stays fixed', async ({ page }, info) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  const before = Number(await stage.getAttribute('data-camera-offset-x'))
  await point(page, { x: 45, y: 50 })
  await expect(actor).not.toHaveClass(/is-moving/)
  expect(Number(await stage.getAttribute('data-camera-offset-x'))).toBe(before)
  await point(page, { x: 60, y: 50 })
  await expect(actor).not.toHaveClass(/is-moving/)
  expect(Number(await stage.getAttribute('data-camera-offset-x'))).toBe(before)
  const sample = page.evaluate(async () => {
    const offsets: number[] = []
    for (let frame = 0; frame < 100; frame += 1) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      offsets.push(Number(document.querySelector('.mainline-scene-stage')?.getAttribute('data-camera-offset-x')))
    }
    return offsets
  })
  await point(page, { x: 85, y: 50 })
  const offsets = await sample
  expect(Math.min(...offsets)).toBeLessThan(before)
  expect(Math.max(...offsets.slice(1).map((value, index) => Math.abs(value - offsets[index])))).toBeLessThan(4)
  await expect(actor).not.toHaveClass(/is-moving/)
  expect(Number(await actor.getAttribute('data-runtime-x'))).toBeCloseTo(85, 0)
  await page.screenshot({ path: info.outputPath('camera-smooth-follow.png') })
  await page.goto('/?scene=commercial-cafe&debugRuntimeEvidence=1')
  const fixed = await stage.getAttribute('data-camera-offset-x')
  await point(page, { x: 60, y: 60 })
  await expect(actor).not.toHaveClass(/is-moving/)
  expect(await stage.getAttribute('data-camera-offset-x')).toBe(fixed)
})

test('real altar gap attempts detour around each authored edge connection without invisible collision', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.goto('/?scene=jijia-ancestral-interior&debugRuntimeEvidence=1')
  const scene = mainlineScenes['jijia-ancestral-interior']
  const metrics = await page.locator('.mainline-scene-stage').evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))
  const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, metrics)
  const footprint = mainlineProtagonistDotFootprint(scene.initialPlayerPosition, metrics)
  const actor = page.locator('[data-actor-id="protagonist"]')
  for (const barrier of snapshot.navigationBarriers) {
    const dx = barrier.end.x - barrier.start.x, dy = barrier.end.y - barrier.start.y
    const length = Math.hypot(dx, dy)
    const center = { x: (barrier.start.x + barrier.end.x) / 2, y: (barrier.start.y + barrier.end.y) / 2 }
    const from = { x: center.x - dy / length * 6, y: center.y + dx / length * 6 }
    const to = { x: center.x + dy / length * 6, y: center.y - dx / length * 6 }
    await reading(page)
    await point(page, from)
    await expect(actor).not.toHaveClass(/is-moving/)
    await reading(page)
    const sampling = page.evaluate(async () => {
      const points: { x: number; y: number }[] = []
      for (let frame = 0; frame < 100; frame += 1) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        const a = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')!
        points.push({ x: Number(a.dataset.runtimeX), y: Number(a.dataset.runtimeY) })
      }
      return points
    })
    await point(page, to)
    const positions = await sampling
    for (let index = 1; index < positions.length; index += 1) expect(navigationBarrierBlocksTravel(positions[index - 1], positions[index], barrier, footprint)).toBe(false)
    await expect(actor).not.toHaveClass(/is-moving/)
  }
  await page.getByRole('button', { name: '香炉，点击让主角前往互动' }).click()
  await expect(page.locator('[data-scene-echo="jijia-incense-burner"]')).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: info.outputPath('altar-compact-reachable.png') })
})

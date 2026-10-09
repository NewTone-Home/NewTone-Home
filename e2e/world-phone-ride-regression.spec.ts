import { openRideArrivalNotification } from './phoneRideNotification'
import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { mainlineRidePickupPositions } from '../src/center/runtime/mainlineRide'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })
async function walkToExit(page: Page, index = 0) {
  // Wait for the real driver before entering the exit. A Phone notification that
  // appears mid-walk owns its next click, so it must be read/dismissed first.
  const driverPending = await page.evaluate(() => {
    const save=JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return Object.values(save.sceneState ?? {}).some((state:any)=>state.rideDriverArrivesAt > Date.now())
  })
  if (await page.locator('.world-phone.is-open').count()) {
    await page.keyboard.press('Escape')
    await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
  }
  if(driverPending) await openRideArrivalNotification(page, 30000)
  if(await page.locator('[data-notification-app="ride"]').isVisible()) await page.locator('[data-notification-app="ride"]').click()
  if (await page.locator('.world-phone.is-open').count()) {
    await page.keyboard.press('Escape')
    await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
  }
  const id = await page.locator('.scene-shell[data-mainline-scene]').getAttribute('data-mainline-scene') as keyof typeof mainlineScenes
  const exit = mainlineScenes[id].externalExits[index]
  const pickup = mainlineRidePickupPositions(id)[index]
  // Choose the interior of the declared trigger, avoiding exact floating-point threshold equality.
  const target = { ...pickup, [exit.axis]: pickup[exit.axis] + exit.direction }
  for (let step = 0; step < 12; step += 1) {
    if (await page.locator('.world-phone.is-open').count()) {
      await page.keyboard.press('Escape')
      await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
    }
    const stage=page.locator('.mainline-scene-stage')
    const projected=await stage.evaluate((e,p)=>{
      const r=e.getBoundingClientRect(), world=e.querySelector<HTMLElement>('.scene-mainline-world')!
      const o=world.style.transform.match(/translate\(([-\d.]+)%, ([-\d.]+)%\)/)!
      const x=r.x+r.width*(p.x+Number(o[1]))/100,y=r.y+r.height*(p.y+Number(o[2]))/100
      return {x:Math.max(r.x+20,Math.min(r.right-20,x)),y:Math.max(r.y+20,Math.min(r.bottom-30,y)),final:x>=r.x&&x<=r.right&&y>=r.y&&y<=r.bottom}
    },target)
    await page.mouse.click(projected.x,projected.y)
    if(projected.final)return
    await expect(page.locator('[data-actor-id="protagonist"]')).toHaveClass(/is-moving/)
    await expect(page.locator('[data-actor-id="protagonist"]')).not.toHaveClass(/is-moving/,{timeout:15000})
  }
  throw new Error('Exit could not be reached through visible world inputs')
}

test('the Office desk Phone Action switches the carried device in both directions', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.route('**/rest/v1/analytics_events**', async (route) => route.fulfill({ status: 201, body: '' }))
  await page.goto('/?scene=zhongshuyuan-office')

  const phone = page.locator('.world-phone')
  await expect(phone).toHaveAttribute('data-phone-device', 'surface')
  for (const target of ['inner', 'surface'] as const) {
    await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
    const echo = page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')
    const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
    await expect(echo).toBeVisible({ timeout: 15_000 })
    await expect(readingShield).toBeVisible()
    await expect(echo).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15_000 })
    await readingShield.click({ force: true })
    const switchAction = page.getByRole('button', { name: '换手机', exact: true })
    await expect(switchAction).toBeEnabled({ timeout: 15_000 })
    await switchAction.click()
    await expect(phone).toHaveAttribute('data-phone-device', target)
    await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
    await expect(phone).not.toHaveClass(/is-open/)
  }
  expect(consoleErrors).toEqual([])
})

test('the inner-world Phone keeps the existing Office to Commercial Street ride handoff', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=zhongshuyuan-office')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(readingShield).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(900)
  await readingShield.click({ force: true })
  await page.getByRole('button', { name: '换手机', exact: true }).click({ timeout: 15_000 })

  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible()
  await expect(phone).toHaveAttribute('data-phone-device', 'inner')
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /商业街.*从当前位置出发/ }).click()
  await phone.getByRole('button',{name:/^快车/}).click(); await phone.getByRole('button',{name:'确认叫车',exact:true}).click(); await expect(page.locator('[data-ride-order="true"]')).toBeVisible()

  await walkToExit(page)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})

test('Commercial Street can ride through the inner-world Phone back to the Zhongshuyuan Office', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  test.setTimeout(90000)
  // Establish the inner-world device through its real Office desk Action;
  // a fresh save correctly starts with the surface phone and is offline here.
  await page.goto('/?scene=zhongshuyuan-office')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  const deskEcho = page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')
  const readingShield = page.locator('[data-scene-dialogue-shield="true"]')
  await expect(deskEcho).toBeVisible({ timeout: 15_000 })
  await expect(readingShield).toBeVisible()
  await expect(deskEcho).toHaveAttribute('data-scene-observation-typing', 'false', { timeout: 15_000 })
  const innerPhoneAction = page.getByRole('button', { name: '换手机', exact: true })
  await readingShield.click({ force: true })
  await expect(innerPhoneAction).toBeEnabled()
  await innerPhoneAction.click()
  const phone = page.locator('.world-phone')
  await expect(phone).toBeVisible()
  await expect(phone).toHaveAttribute('data-phone-device', 'inner')
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /商业街.*从当前位置出发/ }).click()
  await phone.getByRole('button',{name:/^快车/}).click(); await phone.getByRole('button',{name:'确认叫车',exact:true}).click(); await expect(page.locator('[data-ride-order="true"]')).toBeVisible()

  await walkToExit(page)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.center-experience')).not.toHaveAttribute('data-long-distance-phase', /.+/)
  if (!await phone.getAttribute('class').then(value => value?.includes('is-open'))) await page.getByLabel('打开手机').click()
  await expect(phone).toHaveAttribute('data-phone-device', 'inner')
  await expect(phone.locator('section[aria-label="手机主屏"]')).toBeVisible()
  await phone.locator('[data-app="map"]').click()
  await expect(phone.locator('[data-map-world="inner"] [data-scene-id="jijia-ancestral-home"]')).toHaveCount(0)
  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button', { name: /中枢院.*从当前位置出发/ }).click()
  await phone.getByRole('button',{name:/^快车/}).click(); await phone.getByRole('button',{name:'确认叫车',exact:true}).click(); await expect(page.locator('[data-ride-order="true"]')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
  await openRideArrivalNotification(page, 15000)
  await page.locator('[data-notification-app="ride"]').click()
  await expect(phone.locator('section[aria-label="叫车"]')).toBeVisible()

  await walkToExit(page)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-office"]')).toBeVisible({ timeout: 15_000 })
  expect(consoleErrors).toEqual([])
})

async function enableInnerPhone(page: Page) {
  await page.goto('/?scene=zhongshuyuan-office')
  await page.locator('[data-object-id="zhongshuyuan-office-desk"]').click()
  await expect(page.locator('[data-scene-echo="zhongshuyuan-office-desk"]')).toHaveAttribute('data-scene-observation-typing','false',{timeout:15000})
  await page.locator('[data-scene-dialogue-shield="true"]').click({force:true})
  await page.getByRole('button',{name:'换手机',exact:true}).click()
  await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-device','inner')
}
async function callRide(page: Page, destination: string) {
  const phone=page.locator('.world-phone')
  if(!await phone.getAttribute('class').then(c=>c?.includes('is-open'))) await page.getByLabel('打开手机').click()
  await phone.locator('[data-app="ride"]').click()
  await phone.getByRole('button',{name:new RegExp(destination+'.*从当前位置出发')}).click()
  await page.locator('.world-phone').getByRole('button',{name:/^快车/}).click(); await page.getByRole('button',{name:'确认叫车',exact:true}).click(); await expect(page.locator('[data-ride-order="true"], [data-notification-app="ride"]')).toBeVisible()
}
test('Office right external exit boards after a real driver notification card',async({page},info)=>{
  await enableInnerPhone(page)
  await callRide(page,'商业街')
  await expect(page.locator('[data-ride-order="true"]')).toContainText('请到办公室出口等车')
  await expect(page.locator('[data-ride-order="true"]')).not.toContainText(/第一章|第二章|第三章/)
  await page.keyboard.press('Escape'); await expect(page.locator('.world-phone')).toHaveAttribute('data-phone-phase','closed')
  await openRideArrivalNotification(page, 15000)
  await page.locator('[data-notification-app="ride"]').click()
  await expect(page.locator('section[aria-label="叫车"]')).toBeVisible()
  await page.getByLabel('返回手机主屏').click()
  await expect(page.locator('[data-app="ride"]')).toHaveAttribute('data-unread','false')
  await page.screenshot({path:info.outputPath('office-driver-notification-read.png')})
  await walkToExit(page,1)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({timeout:15000})
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]')).toBeVisible({timeout:15000})
  await expect(page.locator('[data-ride-pickup]')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'上车点',exact:true})).toHaveCount(0)
})
test('Mining guidance and boarding use the original external entrance',async({page},info)=>{
  test.setTimeout(70000)
  await enableInnerPhone(page)
  await callRide(page,'矿区')
  await walkToExit(page)
  await expect(page.locator('.scene-shell[data-mainline-scene="yonghe-mining-perimeter"]')).toBeVisible({timeout:20000})
  await expect(page.locator('.center-experience')).not.toHaveAttribute('data-long-distance-phase',/.+/)
  await callRide(page,'中枢院')
  await openRideArrivalNotification(page, 10000)
  await page.locator('[data-notification-app="ride"]').click()
  await expect(page.locator('[data-ride-order="true"]')).toContainText('请到矿区入口等车')
  await expect(page.locator('[data-ride-order="true"]')).not.toContainText(/第一章|第二章|第三章/)
  await page.screenshot({path:info.outputPath('mining-exit-guidance.png')})
  await walkToExit(page)
  await expect(page.locator('.center-long-distance-travel')).toBeVisible({timeout:10000})
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-office"]')).toBeVisible({timeout:15000})
})

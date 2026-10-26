import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

async function startIsolatedWorld(page: import('@playwright/test').Page, url = '/?scene=jijia-ancestral-home') {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    return route.abort()
  })
  await page.goto(url)
  await expect(page.locator('.center-experience')).toBeVisible()
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
}

async function phoneMinutes(page: import('@playwright/test').Page) {
  const text = await page.locator('.world-phone__world-status').textContent()
  const match = text?.match(/(\d{2}):(\d{2})/)
  expect(match).not.toBeNull()
  return Number(match![1]) * 60 + Number(match![2])
}

function minuteDelta(before: number, after: number) {
  return (after - before + 24 * 60) % (24 * 60)
}

test('mounts the real CenterExperience entry without runtime reference errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  // Playwright supplies a fresh browser context: this does not use a user's browser save.
  await startIsolatedWorld(page)
  expect(runtimeErrors).toEqual([])
})

test('restores only the synthetic saved game time after a stale wall-clock gap', async ({ page, browser }) => {
  const gameTimeMs = (15 * 60 + 20) * 60_000
  const syntheticSave = {
    _version: 2,
    currentSceneId: 'jijia-ancestral-home',
    currentPosition: null,
    scenePositions: {},
    phoneDevice: 'inner',
    storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
    gameTimeMs,
    sceneState: {},
    phoneNotifications: [],
    phoneNotes: [],
    phoneContactNotes: {},
    phoneCallHistory: [],
    updatedAt: 1,
  }
  await page.clock.install({ time: new Date('2020-01-01T00:00:00Z') })
  await page.addInitScript((save) => {
    localStorage.setItem('newtone-player-save-v1', JSON.stringify(save))
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
  }, syntheticSave)
  await startIsolatedWorld(page)
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect.poll(() => phoneMinutes(page)).toBe(15 * 60 + 20)

  await page.clock.runFor(10_000)
  const firstSessionStoredTime = await page.evaluate(() => JSON.parse(localStorage.getItem('newtone-player-save-v1')!).gameTimeMs)
  expect(firstSessionStoredTime).toBeGreaterThan(gameTimeMs + 60_000)
  expect(firstSessionStoredTime).toBeLessThan(gameTimeMs + 600_000)

  const storageState = await page.context().storageState()
  const resumedContext = await browser.newContext({ storageState })
  try {
    const resumedPage = await resumedContext.newPage()
    await resumedPage.clock.install({ time: new Date('2035-01-01T00:00:00Z') })
    await resumedPage.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
      return route.abort()
    })
    await resumedPage.goto('/?scene=jijia-ancestral-home')
    await expect(resumedPage.locator('.center-experience')).toBeVisible()
    const resumedPhone = resumedPage.locator('.world-phone')
    await resumedPhone.locator('.world-phone__handle').click()
    await expect.poll(() => phoneMinutes(resumedPage)).toBe(Math.floor(firstSessionStoredTime / 60_000) % (24 * 60))
  } finally {
    await resumedContext.close()
  }
})
test('a real phone click restores 15x from idle, while a synthetic event does not', async ({ page }) => {
  await page.clock.install()
  await startIsolatedWorld(page)
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-open', 'true')
  await expect(phone.locator('.world-phone__home-screen')).toBeVisible()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await phone.locator('.world-phone__contact-actions button').first().click()
  await expect(phone.locator('.world-phone__message-thread')).toBeVisible()
  const start = await phoneMinutes(page)

  await page.clock.runFor(80_000)
  const idle = await phoneMinutes(page)
  expect(minuteDelta(start, idle)).toBeGreaterThanOrEqual(16)
  expect(minuteDelta(start, idle)).toBeLessThanOrEqual(17) // 60s at 15x, then 20s at idle 5x; floor display may straddle a minute.

  await phone.evaluate(element => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
  await page.clock.runFor(12_000)
  const afterSyntheticInput = await phoneMinutes(page)
  expect(minuteDelta(idle, afterSyntheticInput)).toBe(1) // Synthetic isTrusted=false; idle remains 5x.

  await phone.locator('.world-phone__message-bubble').first().click()
  const beforeClickInterval = await phoneMinutes(page)
  await page.clock.runFor(12_000)
  const afterClickInterval = await phoneMinutes(page)
  expect(minuteDelta(beforeClickInterval, afterClickInterval)).toBe(3) // Trusted click restores ordinary-reading 15x.
})

test('a trusted touch on the phone is observed before its local propagation handlers', async ({ page }) => {
  await page.clock.install()
  await startIsolatedWorld(page)
  const phone = page.locator('.world-phone')
  await phone.locator('.world-phone__handle').click()
  await expect(phone).toHaveAttribute('data-phone-open', 'true')
  const start = await phoneMinutes(page)

  await page.clock.runFor(72_000)
  const idle = await phoneMinutes(page)
  expect(minuteDelta(start, idle)).toBeGreaterThanOrEqual(16)
  expect(minuteDelta(start, idle)).toBeLessThanOrEqual(17) // Reading until 60s, idle 5x for the remaining 12s.

  await page.context().newCDPSession(page).then(async cdp => {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    const box = await phone.locator('[data-app="contacts"]').boundingBox()
    expect(box).not.toBeNull()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  })
  await expect(phone.locator('[data-app-view="contacts"]')).toBeVisible()
  const beforeTouchInterval = await phoneMinutes(page)
  await page.clock.runFor(12_000)
  const afterTouchInterval = await phoneMinutes(page)
  expect(minuteDelta(beforeTouchInterval, afterTouchInterval)).toBe(3) // Trusted touch restores 15x.

  await page.clock.runFor(72_000)
  const beforeKeyboard = await phoneMinutes(page)
  await page.keyboard.press('Tab')
  await page.clock.runFor(12_000)
  const afterKeyboard = await phoneMinutes(page)
  expect(minuteDelta(beforeKeyboard, afterKeyboard)).toBe(3) // Trusted keydown restores 15x.
})

async function startProductionDialogueClockTrial(page: import('@playwright/test').Page, mode: 'formal-dialogue' | 'inner-monologue') {
  await page.clock.install()
  const initialGameTimeMs = (10 * 60) * 60_000
  await page.addInitScript(gameTimeMs => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 2,
      currentSceneId: 'commercial-street',
      currentPosition: null,
      scenePositions: {},
      phoneDevice: 'inner',
      storyClock: { dayId: 'story-day-001', stage: 'opening', month: 4, day: 12, weekday: 6, hour: 10, minute: 0, weatherCycle: 'sunny' },
      gameTimeMs,
      sceneState: {},
      phoneNotifications: [],
      phoneNotes: [],
      phoneContactNotes: {},
      phoneCallHistory: [],
      updatedAt: 1,
    }))
  }, initialGameTimeMs)
  await startIsolatedWorld(page, `/?scene=commercial-street&debugRuntimeEvidence=1&debugClockTrial=${mode}`)
  const center = page.locator('.center-experience')
  const scene = page.locator('.mainline-scene[data-mainline-scene="commercial-street"]')
  const expectedSource = mode === 'inner-monologue' ? 'inner-monologue' : 'npc-dialogue'
  await expect(scene).toHaveAttribute('data-e2e-clock-source', expectedSource)
  await expect(scene.locator('[data-scene-dialogue]')).toBeVisible()
  await expect(center).toHaveAttribute('data-e2e-game-clock-activity', expectedSource)
  await expect(center).toHaveAttribute('data-e2e-game-clock-mode', 'dialogue')
  await expect(center).toHaveAttribute('data-e2e-game-clock-multiplier', '0')
  const gameTimeAtDialogueStart = Number(await center.getAttribute('data-e2e-game-time-ms'))
  return { center, scene, initialGameTimeMs, gameTimeAtDialogueStart }
}

for (const mode of ['formal-dialogue', 'inner-monologue'] as const) {
  test(`production CenterExperience ${mode} freezes, idles at 5x, restores dialogue freeze, and carries time across scenes`, async ({ page }) => {
    const { center, scene, gameTimeAtDialogueStart } = await startProductionDialogueClockTrial(page, mode)

    await page.clock.fastForward(60_000)
    await expect(center).toHaveAttribute('data-e2e-game-clock-idle', 'true')
    await expect(center).toHaveAttribute('data-e2e-game-clock-multiplier', '5')
    const gameTimeAtIdleStart = Number(await center.getAttribute('data-e2e-game-time-ms'))
    // Allow the initial scene's source-registration turn to settle, then prove
    // the dialogue rate remains effectively frozen up to the idle boundary.
    expect(gameTimeAtIdleStart - gameTimeAtDialogueStart).toBeLessThanOrEqual(5_000)

    await page.clock.fastForward(12_000)
    const idleGameTimeMs = Number(await center.getAttribute('data-e2e-game-time-ms'))
    expect(idleGameTimeMs).toBeGreaterThanOrEqual(gameTimeAtIdleStart + 60_000)
    expect(idleGameTimeMs).toBeLessThanOrEqual(gameTimeAtIdleStart + 60_250)

    const gameTimeBeforeTrustedInput = Number(await center.getAttribute('data-e2e-game-time-ms'))
    await scene.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await expect(center).toHaveAttribute('data-e2e-game-clock-activity', mode === 'inner-monologue' ? 'inner-monologue' : 'npc-dialogue')
    await expect(center).toHaveAttribute('data-e2e-game-clock-idle', 'false')
    await expect(center).toHaveAttribute('data-e2e-game-clock-multiplier', '0')
    const gameTimeAfterTrustedInput = Number(await center.getAttribute('data-e2e-game-time-ms'))
    expect(gameTimeAfterTrustedInput - gameTimeBeforeTrustedInput).toBeLessThanOrEqual(1_000)
    await page.clock.fastForward(2_000)
    const restoredDialogueGameTimeMs = Number(await center.getAttribute('data-e2e-game-time-ms'))
    expect(restoredDialogueGameTimeMs - gameTimeAfterTrustedInput).toBeLessThanOrEqual(250)

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('newtone:e2e-clock-transition', { detail: { sceneId: 'jijia-ancestral-interior' } })))
    await expect(page.locator('.mainline-scene[data-mainline-scene="jijia-ancestral-interior"]')).toBeVisible()
    await expect(center).toHaveAttribute('data-e2e-game-clock-activity', 'normal-play')
    await expect(center).toHaveAttribute('data-e2e-game-clock-mode', 'normal-play')
    await expect(center).toHaveAttribute('data-e2e-game-clock-multiplier', '30')
    const gameTimeAtNextScene = Number(await center.getAttribute('data-e2e-game-time-ms'))
    expect(gameTimeAtNextScene).toBeGreaterThanOrEqual(restoredDialogueGameTimeMs)
    expect(gameTimeAtNextScene - restoredDialogueGameTimeMs).toBeLessThanOrEqual(1_000)

    await page.clock.fastForward(2_000)
    const afterSceneChange = Number(await center.getAttribute('data-e2e-game-time-ms'))
    expect(afterSceneChange - gameTimeAtNextScene).toBeGreaterThanOrEqual(60_000)
    expect(afterSceneChange - gameTimeAtNextScene).toBeLessThanOrEqual(67_500)
  })
}

import { registerPhoneTestNetwork } from './phoneTestNetwork'
registerPhoneTestNetwork()
import { expect, test, type Page } from '@playwright/test'
import { ACKNOWLEDGED, AUTHORITY, SAVE_EPOCH, WRITER_LOCK } from '../src/services/saveEpoch.mjs'

// Every browser case enters through the real UI; no legacy slot or bootstrap override.
async function waitForEnteredGame(page: Page): Promise<string> {
  // Traces show ~5.1s entry handoffs, including lazy runtime loading and
  // cover/scene/ACK/reveal. Give only this composite boundary 10s, within the
  // unchanged 45s test budget. Keep the active, surface and ACK assertions below.
  await expect.poll(() => page.evaluate(({ AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY) ?? 'null')
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED) ?? 'null')
    return {
      active: document.querySelector('.center-experience--active') !== null,
      surfaceGone: document.querySelector('.entry-surface') === null,
      acknowledged: Boolean(authority?.saveEpoch === SAVE_EPOCH && ack?.saveEpoch === SAVE_EPOCH
        && ack.generationId === authority.generation.id
        && ack.operationId === authority.operationReceipt.operationId),
      entryPhase: document.querySelector('[data-save-entry-phase]')?.getAttribute('data-save-entry-phase') ?? null,
      worldPhase: document.querySelector('[data-world-entry-phase]')?.getAttribute('data-world-entry-phase') ?? null,
      reasons: document.querySelector('[data-save-entry-reasons]')?.textContent ?? null,
    }
  }, { AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }), {
    timeout: 10_000,
    message: 'Entry handoff must reach active, remove its surface and acknowledge the current save; last phases/reasons follow',
  }).toMatchObject({ active: true, surfaceGone: true, acknowledged: true })
  await expect(page.locator('.center-experience--active')).toBeVisible()
  await expect(page.locator('.entry-surface')).toHaveCount(0)
  await expect.poll(() => page.evaluate(({ AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH }) => {
    const authority = JSON.parse(localStorage.getItem(AUTHORITY) ?? 'null')
    const ack = JSON.parse(localStorage.getItem(ACKNOWLEDGED) ?? 'null')
    return Boolean(authority?.saveEpoch === SAVE_EPOCH && ack?.saveEpoch === SAVE_EPOCH
      && ack.generationId === authority.generation.id
      && ack.operationId === authority.operationReceipt.operationId)
  }, { AUTHORITY, ACKNOWLEDGED, SAVE_EPOCH })).toBe(true)
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).generation.id, AUTHORITY)
}

async function continueGame(page: Page, generation: string) {
  await expect(page.locator('[data-save-entry-phase="choice-ready"]')).toBeVisible()
  await page.locator('[data-entry-group-entry="continue"]').click()
  expect(await waitForEnteredGame(page)).toBe(generation)
}

async function startCompletedCafeGame(page: Page): Promise<string> {
  await page.goto('/')
  await expect(page.locator('[data-save-entry-phase="start-ready"]')).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), AUTHORITY)).toBeNull()
  await page.locator('[data-entry-group-entry="create"]').click()
  const generation = await waitForEnteredGame(page)

  // Leave the mounted game before fixture writes: its cleanup cannot overwrite them.
  // This test-only blank document has no App. All fixture writes still use the
  // existing service lock, ticket, validator and bound storage, never raw authority.
  const fixtureUrl = '/__phone-current-fixture__.html'
  await page.route('**' + fixtureUrl, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Phone fixture setup</title>',
  }))
  await page.goto(fixtureUrl)
  await page.unroute('**' + fixtureUrl)
  await expect.poll(() => page.evaluate(async lockName => {
    const state = await navigator.locks.query()
    return !(state.held ?? []).some(lock => lock.name === lockName)
  }, WRITER_LOCK)).toBe(true)

  const fixture = await page.evaluate(async expectedGeneration => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { getSaveEntryService, PLAYER } = await load('/src/services/saveEntryService.mjs')
    const { loadPlayerSave, sanitizePlayerSave, savePlayerSave } = await load('/src/center/runtime/playerSave.ts')
    const { validateNew } = await load('/src/services/saveMigration.mjs')
    const { commercialCafeStoryStatePatch, commercialCafeNarrativeDialogue } = await load('/src/center/runtime/commercialCafeStory.ts')
    const { openingGuidancePatch } = await load('/src/center/runtime/openingGuidance.ts')
    const service = getSaveEntryService()
    const inspection = await service.inspectSave()
    if (inspection.classification !== 'generation-current') throw Error('Fixture requires a real current save')
    const prepared = await service.prepareEntry({ intent: 'continue', snapshotToken: inspection.snapshotToken })
    if (prepared.status !== 'prepared') throw Error('Fixture prepare: ' + JSON.stringify(prepared))
    const committed = await service.commitEntry({ ticket: prepared.ticket })
    if (committed.status !== 'committed') throw Error('Fixture commit: ' + JSON.stringify(committed))
    const handle = committed.sessionHandle
    try {
      if (handle.generation !== expectedGeneration) throw Error('Fixture changed the game generation')
      const current = validateNew(loadPlayerSave(handle.storage))
      const completedCafe = commercialCafeStoryStatePatch({
        status: 'complete', narrativeCursor: commercialCafeNarrativeDialogue.lines.length,
        coffeeStatus: 'delivered', coffeePreparationStartedAt: null,
        narrativePhase: 'complete', laoZhouDeparture: 'departed', completedAt: Date.now(),
      })
      const candidate = openingGuidancePatch({
        ...current, currentSceneId: 'commercial-cafe', currentPosition: null,
        storyClock: { ...current.storyClock, stage: 'cafe' },
        sceneState: { ...current.sceneState,
          'commercial-street': { ...current.sceneState['commercial-street'],
            laoZhouConversationTriggered: true, laoZhouTriggerEvidenceVersion: 1 },
          'commercial-cafe': { ...current.sceneState['commercial-cafe'], ...completedCafe },
        },
      }, { state: 'triggered', evidence: ['test-fixture:completed-cafe'] })
      // Normalize with the real writer, validate BEFORE writing, then read back.
      const valid = validateNew(sanitizePlayerSave(candidate, 'commercial-cafe'))
      const saved = savePlayerSave(valid, handle.storage)
      validateNew(JSON.parse(handle.storage.getItem(PLAYER)!))
      if (saved.phoneNotes.some((note: { id: string }) => note.id === 'story-yonghe-lead')) {
        throw Error('Fixture must not manufacture the runtime-generated Yonghe note')
      }
      const ack = await service.acknowledgeEntry({ ticket: prepared.ticket, sessionHandle: handle })
      if (ack.status !== 'acknowledged') throw Error('Fixture ACK: ' + JSON.stringify(ack))
      return { balance: saved.walletBalance, epoch: committed.snapshot.saveEpoch,
        generation: handle.generation, complete: saved.sceneState['commercial-cafe'].commercialCafeStoryStatus }
    } finally {
      await handle.close()
    }
  }, generation)
  expect(fixture).toEqual({ balance: 800, epoch: SAVE_EPOCH, generation, complete: 'complete' })
  expect(await page.evaluate(() => localStorage.getItem('newtone-player-save-v1'))).toBeNull()

  // The fixture is not the acceptance entrance. Re-open and click real Continue.
  await page.goto('/')
  await continueGame(page, generation)
  return generation
}

test('Notes persist and the contact flow supports details, location cards, and a manually ended call', async ({ page }) => {
  // R2 trace used ~45s before refresh; real reload/Continue plus final persistence
  // checks need ~14s more. Allow this long flow 65s, not a global timeout increase.
  // Each entry handoff still has its independent 10s active/ACK deadline.
  test.setTimeout(65_000)
  const generation = await startCompletedCafeGame(page)
  const phone = page.locator('.world-phone')
  await page.getByRole('button', { name: '打开手机' }).click()

  await phone.locator('.world-phone__pin-candidates button').click()
  await expect(phone.locator('.world-phone__pin-candidates button')).toHaveAttribute('aria-pressed', 'true')
  await phone.locator('.world-phone__memo-open').click()
  const lead = phone.locator('.world-phone__note[data-note-kind="story"]').filter({ hasText: '永和线索' })
  await expect(lead).toBeVisible()
  // Readable clue facts live in the note; the map card uses decorative strokes.
  await expect(lead.locator('p')).toContainText('永和小馆')
  await expect(lead.locator('p')).toContainText('陈副部长')
  await page.screenshot({ path: 'test-results/phone-notes-list.png' })
  await phone.getByRole('button', { name: '新增备忘' }).click()
  await page.screenshot({ path: 'test-results/phone-notes-compose.png' })
  await phone.getByLabel('新备忘标题').fill('问老周')
  await phone.getByLabel('新备忘内容').fill('确认下一步去哪里。')
  await phone.getByRole('button', { name: '保存备忘' }).click()
  const createdNote = phone.locator('.world-phone__note[data-note-kind="player"]')
  await expect(createdNote).toBeVisible()
  await createdNote.getByRole('button').click()
  await phone.getByLabel('新备忘内容').fill('编辑后仍然持久化。')
  await phone.getByRole('button', { name: '保存备忘' }).click()
  await expect(createdNote).toContainText('编辑后仍然持久化。')
  await phone.locator('.world-phone__home-indicator').click()
  await expect(phone.getByLabel('备忘录')).toContainText('问老周')
  await expect(phone.getByLabel('备忘录')).toContainText('永和线索')

  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toBeVisible()
  await phone.getByLabel('联系人备注').fill('咖啡馆认识的联系人')
  await phone.getByLabel('联系人备注').blur()
  await phone.getByRole('button', { name: '信息' }).click()
  const thread = phone.getByRole('region', { name: '与老周的短信' })
  await expect(thread.locator('.world-phone__message-bubble').first()).toHaveText('陈副部长失踪了。')
  const location = thread.locator('.world-phone__message-place')
  await expect(location).toBeVisible()
  const messageBubble = location.locator('.world-phone__message-bubble--place')
  await expect(messageBubble).toHaveText('\u6c38\u548c\u5c0f\u9986')
  await messageBubble.hover()
  const placeCard = location.locator('.world-phone__place-card')
  await expect(placeCard).toBeVisible()
  const miniMap = placeCard.locator('[data-yonghe-map-preview]')
  await expect(miniMap.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await expect(placeCard.locator('.world-phone__place-card-heading')).toContainText('永和小馆')
  await expect(placeCard.locator('.world-phone__place-card-clue-label')).toHaveText('线索')
  await expect(placeCard).toHaveAttribute('aria-label', '永和小馆地点卡')
  const clueDrawing = placeCard.locator('.world-phone__place-card-copy svg.world-phone__place-card-scribble')
  await expect(clueDrawing).toBeVisible()
  await expect(clueDrawing).toHaveAttribute('aria-hidden', 'true')
  await expect(clueDrawing).toHaveAttribute('viewBox', '0 0 120 30')
  const clueStrokes = clueDrawing.locator('path')
  await expect(clueStrokes).toHaveCount(3)
  for (const stroke of await clueStrokes.all()) await expect(stroke).toHaveAttribute('d', /^M/)
  const desktopAlignment = await messageBubble.evaluate((bubble) => {
    const bubbleRect = bubble.getBoundingClientRect()
    const cardRect = bubble.parentElement!.querySelector('.world-phone__place-card')!.getBoundingClientRect()
    return { right: cardRect.left >= bubbleRect.right - 1, aligned: Math.abs((cardRect.top + cardRect.height / 2) - (bubbleRect.top + bubbleRect.height / 2)) < 12 }
  })
  expect(desktopAlignment).toEqual({ right: true, aligned: true })
  await expect(location.locator('[data-yonghe-card-preview]')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await expect(placeCard).toBeHidden()

  await page.setViewportSize({ width: 1280, height: 900 })
  await messageBubble.hover()
  await expect(placeCard).toBeVisible()
  const cardBeforeHover = await placeCard.boundingBox()
  expect(cardBeforeHover).not.toBeNull()
  expect(cardBeforeHover!.height).toBeGreaterThan(cardBeforeHover!.width)
  await placeCard.hover()
  await expect.poll(async () => (await placeCard.boundingBox())!.width).toBeGreaterThan(cardBeforeHover!.width)
  await placeCard.evaluate(async element => {
    const animations: Animation[] = []
    let current: Element | null = element
    while (current) { animations.push(...current.getAnimations()); current = current.parentElement }
    await Promise.all(animations.filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)))
  })
  await placeCard.click()
  await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
  const map = phone.locator('[data-map-world="inner"]')
  await expect(map).toBeVisible()
  await expect(map).toHaveAttribute('data-map-zoom', '1.650')
  await expect(phone.locator('[data-map-region="mine"]')).toHaveCount(0)
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toHaveAttribute('data-map-poi-region', 'mine')
  await expect(phone.locator('.world-phone__detail-heading strong')).toBeVisible()

  await phone.getByRole('button', { name: '缩小地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.320')
  await phone.getByRole('button', { name: '缩小地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.056')
  await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toHaveCount(0)
  await phone.getByRole('button', { name: '放大地图' }).click()
  await expect(map).toHaveAttribute('data-map-zoom', '1.320')
  await phone.locator('.world-phone__map-viewport').hover()
  await page.mouse.wheel(0, -100)
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(1.6)
  await page.mouse.wheel(0, 100)
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeCloseTo(1.32, 2)

  const viewport = phone.locator('.world-phone__map-viewport')
  const viewportBox = await viewport.boundingBox()
  expect(viewportBox).not.toBeNull()
  const startTransform = await map.getAttribute('style')
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 4)
  await page.mouse.down()
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2 + 45, viewportBox!.y + viewportBox!.height / 4 + 30)
  await page.mouse.up()
  await expect.poll(() => map.getAttribute('style')).not.toBe(startTransform)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const centerX = viewportBox!.x + viewportBox!.width / 2
  const centerY = viewportBox!.y + viewportBox!.height / 4
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: centerX - 24, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: centerX - 24, y: centerY }, { id: 2, x: centerX + 24, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: centerX - 42, y: centerY }, { id: 2, x: centerX + 42, y: centerY }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(2)
  await cdp.detach()

  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByLabel('联系人备注')).toHaveValue('咖啡馆认识的联系人')
  await phone.getByRole('button', { name: '电话' }).click()
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await page.waitForTimeout(3500)
  await expect(phone.getByRole('region', { name: '正在呼叫老周' })).toBeVisible()
  await expect(phone.getByText(/响铃中/)).toBeVisible()
  await phone.getByRole('button', { name: '挂断' }).click()
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toContainText('已挂断')

  await page.reload()
  await continueGame(page, generation)
  await page.getByRole('button', { name: '打开手机' }).click()
  await expect(phone.locator('.world-phone__pin-candidates button')).toHaveAttribute('aria-pressed','true')
  await phone.locator('.world-phone__memo-open').click()
  await expect(phone.locator('.world-phone__note[data-note-kind="player"]')).toContainText('编辑后仍然持久化。')
  await phone.getByLabel('返回手机主屏').click()
  await phone.locator('[data-app="contacts"]').click()
  await phone.locator('.world-phone__contact-row').click()
  await expect(phone.getByLabel('联系人备注')).toHaveValue('咖啡馆认识的联系人')
  await expect(phone.getByRole('region', { name: '老周联系人详情' })).toContainText('已挂断')
})

for (const width of [411, 360]) {
  test(`Yonghe location card supports touch tap and restores the message on close at ${width}px`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height: 914 }, hasTouch: true, isMobile: true })
    await context.route('**/phone-v1-validation.invalid/**', route => route.fulfill({
      status: route.request().method() === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: route.request().method() === 'GET' ? '[]' : '',
    }))
    const page = await context.newPage()
    await startCompletedCafeGame(page)
    const phone = page.locator('.world-phone')
    await phone.locator('.world-phone__handle').tap()
    await phone.locator('[data-app="contacts"]').tap()
    await phone.locator('.world-phone__contact-row').tap()
    await phone.getByRole('button', { name: '\u4fe1\u606f' }).tap()
    const bubble = phone.locator('.world-phone__message-bubble--place')
    const card = phone.locator('.world-phone__place-card')
    await expect(bubble).toBeVisible()
    await bubble.evaluate(async element => {
      const animations: Animation[] = []
      let current: Element | null = element
      while (current) { animations.push(...current.getAnimations()); current = current.parentElement }
      await Promise.all(animations.filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)))
    })
    const bubbleBefore = await bubble.boundingBox()

    await bubble.tap()
    await expect(card).toBeVisible()
    await expect(card.locator('.world-phone__place-card-map-link')).toHaveCount(0)
    await expect(card.locator('[data-yonghe-map-preview]')).toBeVisible()
    const bubbleAfter = await bubble.boundingBox()
    const bubbleGeometry = await bubble.evaluate(element => {
      const parent = element.parentElement?.getBoundingClientRect()
      const phone = element.closest<HTMLElement>('.world-phone')
      const phoneRect = phone?.getBoundingClientRect()
      return { parent, phoneRect, scrollX: window.scrollX, visualViewport: window.visualViewport ? { offsetLeft: window.visualViewport.offsetLeft, pageLeft: window.visualViewport.pageLeft, width: window.visualViewport.width } : null, css: { position: getComputedStyle(element).position, transform: getComputedStyle(element).transform, margin: getComputedStyle(element).margin } }
    })
    expect(bubbleAfter, JSON.stringify({ bubbleBefore, bubbleAfter, bubbleGeometry })).toEqual(bubbleBefore)
    const fitsPhone = await card.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const content = element.closest('.world-phone__app-content')!.getBoundingClientRect()
      return rect.left >= content.left && rect.right <= content.right && rect.top >= content.top && rect.bottom <= content.bottom
    })
    expect(fitsPhone).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`yonghe-card-${width}.png`) })
    await card.locator('.world-phone__place-card-close').tap()
    await expect(card).toBeHidden()
    await expect(bubble).toHaveAttribute('aria-expanded', 'false')
    await expect(phone.locator('.world-phone__app-view[data-app-view="map"]')).toHaveCount(0)

    await bubble.tap()
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('aria-hidden', 'false')
    await card.tap()
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'opening')
    await expect(phone).toHaveAttribute('data-yonghe-map-handoff', 'settled', { timeout: 3000 })
    await expect(phone.locator('[data-map-poi="yonghe-eatery"]')).toBeVisible()
    await context.close()
  })
}

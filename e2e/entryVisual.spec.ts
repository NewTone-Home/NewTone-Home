import { test, expect } from '@playwright/test'
import { AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, SAVE_EPOCH, EPOCH_PREFIX, BACKUP_PREFIX, WRITER_LOCK } from '../src/services/saveEpoch.mjs'
type Frame = { at: number; opacity: number; y: number; animation: string; text: string; beginVisible: boolean; beginFrame: number; beginText: number }
type Trace = { frames: Frame[]; done: boolean; error?: string }
type GesturePoint = { type: string; x: number; y: number; at: number; pointerId: number }
type ObserverWindow = Window & { __entryVisualMotion?: Record<string, Trace>; __entryVisualPointerTypes?: string[]; __entryVisualStartElement?: Element | null; __entryVisualPath?: GesturePoint[]; __entryVisualPathAbort?: AbortController }

function expectActiveBreathing(frames: Frame[]) {
  const active = frames.filter(frame => frame.animation.includes('dialogue-choice-breathe'))
  expect(active.length).toBeGreaterThanOrEqual(10)
  const first = frames.indexOf(active[0]), last = frames.indexOf(active.at(-1)!)
  expect(last - first + 1).toBe(active.length)
  expect(active.at(-1)!.at - active[0].at).toBeGreaterThan(300)
  expect(Math.max(...active.map(f => f.opacity)) - Math.min(...active.map(f => f.opacity))).toBeGreaterThan(.12)
}
test.use({ locale: 'zh-CN' })

// Real rendered public entry, not the dormant Reader fallback or source strings.
// QA saves these PNGs locally for the coordinator's approval; no upload here.
for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 1366, height: 768 }]) {
  const touch = viewport.width <= 390
  test.describe(`actual public entry ${viewport.width}`, () => {
  test.use({ viewport, hasTouch: touch, isMobile: touch })
  test(`Start/menu/confirmation/Updates ${viewport.width}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000)
    const activate = async (locator: ReturnType<typeof page.locator>) => touch ? locator.tap() : locator.click()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const screenshot = async (label: string, movingSelector?: string, requireTranslation = true) => {
      if (movingSelector) {
        const state = await page.locator(movingSelector).evaluate(node => {
          const style = getComputedStyle(node)
          return { at: performance.now(), opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 }
        })
        expect(state.opacity).toBeGreaterThan(.05); expect(state.opacity).toBeLessThan(.95)
        if (requireTranslation) expect(state.y).toBeLessThan(-.2)
        await testInfo.attach(`${viewport.width}-${label}-capture-request`, { body: JSON.stringify(state), contentType: 'application/json' })
      }
      const path = testInfo.outputPath(`${viewport.width}-${label}.png`)
      await page.screenshot({ path, fullPage: true, animations: 'allow' })
      await testInfo.attach(`${viewport.width}-${label}`, { path, contentType: 'image/png' })
    }
    const facts = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
      .sort().map(key => [key, localStorage.getItem(key)])))
    // Observe real frames only: no animation seeking, fake clock, or app state mutation.
    const startTrace = async (key: string, selector: string, duration: number) => page.evaluate(({ key, selector, duration }) => {
      const host = window as ObserverWindow, trace: Trace = { frames: [], done: false }
      ;(host.__entryVisualMotion ??= {})[key] = trace
      const started = performance.now()
      let first: number | null = null
      const tick = (now: number) => {
        const node = document.querySelector(selector)
        if (node) {
          first ??= now
          const style = getComputedStyle(node)
          const begin = document.querySelector('[data-entry-id="begin"]')
          trace.frames.push({ at: now, opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42, animation: style.animationName, text: node.textContent ?? '',
            beginVisible: !!begin && getComputedStyle(begin).visibility !== 'hidden' && begin.getAttribute('data-entry-visible') === 'true',
            beginFrame: Number(begin?.getAttribute('data-entry-frame-progress')), beginText: Number(begin?.getAttribute('data-entry-text-progress')) })
        }
        if (first !== null && now - first >= duration) trace.done = true
        else if (now - started > 10_000) { trace.error = 'actual element never appeared'; trace.done = true }
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { key, selector, duration })
    const finishTrace = async (key: string, minimumFrames = 8) => {
      await page.waitForFunction(key => (window as ObserverWindow).__entryVisualMotion?.[key]?.done, key)
      const trace = await page.evaluate(key => (window as ObserverWindow).__entryVisualMotion![key], key)
      await testInfo.attach(`${viewport.width}-${key}-frames`, { body: JSON.stringify(trace, null, 2), contentType: 'application/json' })
      expect(trace.error).toBeUndefined(); expect(trace.frames.length).toBeGreaterThan(minimumFrames)
      return trace.frames
    }
    const observeBreathing = async (selector: string, key: string) => {
      const option = page.locator(selector)
      await startTrace(key, selector, 700)
      if (touch) {
        const box = (await option.boundingBox())!, cdp = await context.newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
        await page.waitForFunction(key => (window as ObserverWindow).__entryVisualMotion?.[key].frames.some(frame => frame.animation.includes('dialogue-choice-breathe') && frame.opacity < .9), key)
        await screenshot(`${key}-touch-in-progress`)
        expectActiveBreathing(await finishTrace(key))
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
        await cdp.detach()
        expect(await page.evaluate(() => (window as ObserverWindow).__entryVisualPointerTypes)).toContain('touch')
      } else {
        await option.hover()
        await page.waitForFunction(key => (window as ObserverWindow).__entryVisualMotion?.[key].frames.some(frame => frame.animation.includes('dialogue-choice-breathe') && frame.opacity < .9), key)
        await screenshot(`${key}-hover-in-progress`)
        expectActiveBreathing(await finishTrace(key))
        await page.mouse.move(0, 0)
      }
    }
    await page.goto('/')
    const begin = page.locator('[data-entry-id="begin"]')
    await expect(begin).toBeEnabled({ timeout: 20_000 })
    await expect(begin).toContainText('开始游戏')
    await expect(page.locator('[data-entry-id="continue"]')).toHaveCount(0)
    await expect(page.locator('[data-entry-id="request-replace"]')).toHaveCount(0)
    const updates = page.locator('[data-entry-id="updates"]')
    await expect(updates).toBeEnabled()
    await expect(updates.locator('svg')).not.toHaveCount(0)
    expect(await page.evaluate(() => navigator.maxTouchPoints > 0)).toBe(touch)
    await screenshot('empty-start-framed-updates')
    const originalStart = await begin.elementHandle()
    await startTrace('loading-caption', '[data-entry-id="begin"] [data-entry-text-fade-value]', 1000)
    await activate(begin)
    await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['loading-caption'].frames.some(frame => frame.text === '加载游戏中' && frame.animation === 'entry-text-fade-in' && frame.opacity > .05 && frame.opacity < .95))
    await screenshot('loading-caption-fade-in', '[data-entry-id="begin"] [data-entry-text-fade-value]', false)
    expect(await originalStart!.evaluate(node => node === document.querySelector('[data-entry-id="begin"]'))).toBe(true)
    const loadingFrames = await finishTrace('loading-caption')
    expect(loadingFrames.some(frame => frame.text === '开始游戏' && frame.animation === 'entry-text-fade-out' && frame.opacity > .05 && frame.opacity < .95)).toBe(true)
    expect(loadingFrames.some(frame => frame.text === '加载游戏中' && frame.animation === 'entry-text-fade-in' && frame.opacity > .05 && frame.opacity < .95)).toBe(true)
    expect(loadingFrames.every(frame => frame.beginVisible && frame.beginFrame === 1)).toBe(true)
    await expect(page.locator('.center-experience')).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 20_000 })
    await page.reload()
    await expect(begin).toBeEnabled({ timeout: 20_000 })
    expect(await page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
    await expect(page.locator('[data-entry-id="continue"]')).toHaveCount(0)
    // Collect ALL physical keys, not the obsolete pre-epoch prefix. Explicitly
    // prove this is a valid nonempty current save before any zero-write comparison.
    const before = await facts()
    for (const key of [AUTHORITY, PENDING, ACKNOWLEDGED, GUARD]) {
      expect(Object.prototype.hasOwnProperty.call(before, key), `missing actual key ${key}`).toBe(true)
      expect(typeof before[key]).toBe('string'); expect(before[key]!.length).toBeGreaterThan(0)
    }
    const authority = JSON.parse(before[AUTHORITY]!)
    expect(authority.saveEpoch).toBe(SAVE_EPOCH); expect(authority.protocolVersion).toBe(2)
    expect(authority.values['newtone-player-save-v1']).toBeTruthy()
    await testInfo.attach(`${viewport.width}-snapshot-keys`, { body: JSON.stringify(Object.keys(before), null, 2), contentType: 'application/json' })
    const anchors = async () => ({
      start: await begin.boundingBox(),
      startSlot: await page.locator('.save-entry-primary-slot').boundingBox(),
      updates: await page.locator('[data-entry-group="landing-updates"]').boundingBox(),
    })
    const originalAnchors = await anchors()
    expect(originalAnchors.start && originalAnchors.startSlot && originalAnchors.updates).toBeTruthy()
    await page.evaluate(() => { (window as ObserverWindow).__entryVisualStartElement = document.querySelector('[data-entry-id="begin"]') })
    const expectStartRetained = async (label: string, requireSameNode = true) => {
      await expect(begin).toBeVisible(); await expect(begin).toContainText('开始游戏')
      await expect(begin).toHaveAttribute('data-entry-frame-progress', '1.000')
      await expect(begin).toHaveAttribute('data-entry-text-progress', '1.000')
      if (requireSameNode) {
      expect(await page.evaluate(() => (window as ObserverWindow).__entryVisualStartElement === document.querySelector('[data-entry-id="begin"]'))).toBe(true)
      }
      const after = await anchors()
      for (const key of ['startSlot', 'updates'] as const) {
        expect(after[key]).not.toBeNull()
        expect(Math.abs(after[key]!.x - originalAnchors[key]!.x)).toBeLessThan(1)
        expect(Math.abs(after[key]!.y - originalAnchors[key]!.y)).toBeLessThan(1)
      }
      await testInfo.attach(`${viewport.width}-${label}-anchors`, { body: JSON.stringify({ before: originalAnchors, after }, null, 2), contentType: 'application/json' })
    }
    await screenshot('current-start-before-expansion')
    await startTrace('expand', '.save-entry-choices', 500)
    await activate(begin)
    await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.expand.frames.some(frame => frame.opacity > .05 && frame.opacity < .95 && frame.y < -.2))
    await screenshot('expansion-in-progress', '.save-entry-choices')
    const frames = await finishTrace('expand'), first = frames[0], last = frames.at(-1)!
    expect(frames.some(frame => frame.opacity > .05 && frame.opacity < .95 && frame.y < -.2)).toBe(true)
    expect(last.opacity - first.opacity).toBeGreaterThan(.2)
    expect(last.y - first.y).toBeGreaterThan(1)
    expect(last.opacity).toBeCloseTo(1, 1); expect(Math.abs(last.y)).toBeLessThan(.2)
    expect(frames.every(frame => frame.beginVisible && frame.beginFrame === 1 && frame.beginText === 1)).toBe(true)
    await expectStartRetained('expanded')
    const choices = page.locator('.save-entry-choices')
    await expect(choices).toBeVisible()
    const animation = await choices.evaluate(node => ({ name: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration }))
    expect(animation.name).toBe('save-entry-options-reveal')
    expect(animation.duration).toBe('0.32s')
    const current = page.locator('[data-entry-id="continue"]'), fresh = page.locator('[data-entry-id="request-replace"]')
    await expect(current).toBeEnabled(); await expect(fresh).toBeEnabled()
    const [startBox, currentBox, freshBox] = await Promise.all([begin.boundingBox(), current.boundingBox(), fresh.boundingBox()])
    expect(startBox && currentBox && freshBox).toBeTruthy()
    expect(currentBox!.y).toBeGreaterThanOrEqual(startBox!.y + startBox!.height)
    expect(freshBox!.y).toBeGreaterThanOrEqual(currentBox!.y + currentBox!.height)
    expect(Math.abs(currentBox!.x + currentBox!.width / 2 - freshBox!.x - freshBox!.width / 2)).toBeLessThan(1)
    await activate(begin)
    await expectStartRetained('repeated-start')
    await expect(current).toBeEnabled()
    expect(await facts()).toEqual(before)
    for (const option of [current, fresh]) {
      expect(await option.evaluate(node => ({ border: getComputedStyle(node).borderTopWidth, background: getComputedStyle(node).backgroundColor, shadow: getComputedStyle(node).boxShadow })))
        .toEqual({ border: '0px', background: 'rgba(0, 0, 0, 0)', shadow: 'none' })
      await expect(option.locator('svg')).toHaveCount(0)
    }
    expect(await facts()).toEqual(before)
    await page.evaluate(() => {
      const host = window as ObserverWindow
      host.__entryVisualPointerTypes = []
      document.addEventListener('pointerdown', event => host.__entryVisualPointerTypes!.push(event.pointerType), { capture: true })
    })
    await observeBreathing('[data-entry-id="continue"]', 'continue-breathe')
    expect(await facts()).toEqual(before)
    await screenshot('current-expanded-pure-text')
    await startTrace('confirmation-enter', '.save-entry-confirm', 500)
    await activate(fresh)
    await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['confirmation-enter'].frames.some(frame => frame.opacity > .05 && frame.opacity < .95 && frame.y < -.2))
    await screenshot('confirmation-in-progress', '.save-entry-confirm')
    const confirmFrames = await finishTrace('confirmation-enter')
    expect(confirmFrames.some(frame => frame.opacity > .05 && frame.opacity < .95 && frame.y < -.2)).toBe(true)
    expect(confirmFrames.at(-1)!.opacity - confirmFrames[0].opacity).toBeGreaterThan(.2)
    expect(confirmFrames.at(-1)!.y - confirmFrames[0].y).toBeGreaterThan(1)
    const confirm = page.locator('[data-entry-id="replace"]'), cancel = page.locator('[data-entry-id="cancel"]')
    await expect(confirm).toBeEnabled(); await expect(cancel).toBeEnabled()
    await expectStartRetained('confirmation')
    await expect(current).toBeVisible(); await expect(fresh).toBeVisible()
    await activate(begin)
    await expect(confirm).toBeEnabled(); await expect(cancel).toBeEnabled()
    const [newBox, yesBox, noBox] = await Promise.all([fresh.boundingBox(), confirm.boundingBox(), cancel.boundingBox()])
    expect(newBox && yesBox && noBox).toBeTruthy()
    expect(yesBox!.y).toBeGreaterThanOrEqual(newBox!.y + newBox!.height)
    expect(Math.abs(yesBox!.y - noBox!.y)).toBeLessThan(2)
    expect(noBox!.x).toBeGreaterThan(yesBox!.x)
    await expect(confirm).toBeInViewport({ ratio: 1 }); await expect(cancel).toBeInViewport({ ratio: 1 })
    expect(await facts()).toEqual(before)
    await screenshot('confirm-cancel-below-new-game')
    await expect(page.locator('.landing-device-hint')).toHaveCount(0)
    await expect(page.locator('.save-entry > p[role="status"]')).toHaveCount(0)
    await observeBreathing('[data-entry-id="replace"]', 'confirm-breathe')
    await observeBreathing('[data-entry-id="cancel"]', 'cancel-breathe')
    expect(await facts()).toEqual(before)
    await startTrace('cancel-fade-out', '.save-entry-confirm', 400)
    await activate(cancel)
    await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['cancel-fade-out'].frames.some(frame => frame.opacity > .05 && frame.opacity < .95))
    await screenshot('cancel-fade-out', '.save-entry-confirm', false)
    const cancelFrames = await finishTrace('cancel-fade-out', 3)
    expect(cancelFrames.some(frame => frame.opacity > .05 && frame.opacity < .95)).toBe(true)
    await expect(fresh).toBeFocused()
    await expect(page.locator('[data-save-entry-menu="choices"]')).toBeVisible()
    expect(await facts()).toEqual(before)
    await page.keyboard.press('Escape')
    await expect(begin).toBeEnabled()
    await expect.poll(() => page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
    await expectStartRetained('collapsed-after-cancel')
    const outsideTap = async () => touch ? page.touchscreen.tap(12, 120) : page.mouse.click(12, 120)
    const outsideOutAndBack = async (label: string) => {
      // Exact endpoint-return proof uses a real mouse path: touch scrolling can
      // legitimately emit pointercancel, which is a different guard, not proof
      // that the sticky movement threshold handled an endpoint-return gesture.
      await page.mouse.move(12, 120)
      await page.evaluate(() => {
        const host = window as ObserverWindow
        host.__entryVisualPathAbort?.abort()
        const controller = new AbortController(), points: GesturePoint[] = []
        host.__entryVisualPathAbort = controller; host.__entryVisualPath = points
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
          document.addEventListener(type, event => {
            const pointer = event as PointerEvent
            points.push({ type, x: pointer.clientX, y: pointer.clientY, at: pointer.timeStamp, pointerId: pointer.pointerId })
          }, { capture: true, passive: true, signal: controller.signal })
        }
      })
      await page.mouse.down()
      await page.mouse.move(82, 120, { steps: 3 })
      await page.mouse.move(12, 120, { steps: 3 })
      await page.mouse.up()
      const path = await page.evaluate(() => {
        const host = window as ObserverWindow
        host.__entryVisualPathAbort?.abort()
        return host.__entryVisualPath!
      })
      await testInfo.attach(`${viewport.width}-${label}-actual-pointer-path`, { body: JSON.stringify(path, null, 2), contentType: 'application/json' })
      const down = path.find(p => p.type === 'pointerdown')!, up = path.find(p => p.type === 'pointerup')!
      expect(down && up).toBeTruthy()
      expect(up.pointerId).toBe(down.pointerId)
      expect(up.x).toBe(down.x); expect(up.y).toBe(down.y)
      expect(up.at - down.at).toBeLessThanOrEqual(700)
      expect(path.some(p => p.type === 'pointermove' && p.pointerId === down.pointerId && Math.hypot(p.x - down.x, p.y - down.y) > 10)).toBe(true)
      expect(path.some(p => p.type === 'pointercancel')).toBe(false)
    }
    await activate(begin)
    await expect(current).toBeEnabled()
    if (!touch) {
      await outsideOutAndBack('choices-out-and-back')
      await expect(current).toBeEnabled()
      await expectStartRetained('choices-preserved-after-path')
      expect(await facts()).toEqual(before)
    }
    await startTrace('outside-fade-out', '.save-entry-choices', 400)
    await outsideTap()
    await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['outside-fade-out'].frames.some(frame => frame.opacity > .05 && frame.opacity < .95))
    await screenshot('outside-fade-out', '.save-entry-choices', false)
    expect((await finishTrace('outside-fade-out', 3)).some(frame => frame.opacity > .05 && frame.opacity < .95)).toBe(true)
    await expect(page.locator('.save-entry-choices')).toHaveCount(0)
    await expectStartRetained('outside-choices-collapse')
    expect(await facts()).toEqual(before)
    await activate(begin)
    await expect(fresh).toBeEnabled(); await activate(fresh)
    await expect(confirm).toBeEnabled()
    if (!touch) {
      await outsideOutAndBack('confirmation-out-and-back')
      await expect(confirm).toBeEnabled(); await expect(cancel).toBeEnabled()
      await expectStartRetained('confirmation-preserved-after-path')
      expect(await facts()).toEqual(before)
    }
    await outsideTap()
    await expect(page.locator('.save-entry-choices')).toHaveCount(0)
    await expect(page.locator('.save-entry-confirm')).toHaveCount(0)
    await expect(page.locator('[data-save-entry-phase="choice-ready"]')).toBeVisible()
    await expectStartRetained('outside-confirmation-collapse')
    expect(await facts()).toEqual(before)
    await activate(updates)
    await expect(page.locator('.landing-updates-page[data-updates-phase="updates"]')).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
    await screenshot('updates-open')
    if (touch) {
      await activate(page.locator('[data-entry-id="landing-updates-return"]'))
      await expect(page.locator('.landing[data-updates-phase="landing"]')).toBeVisible({ timeout: 15_000 })
      await expect(begin).toBeEnabled()
      // Updates legitimately unmounts the entry controls; validate the NEW
      // mounted Start against the same layout/safety contract, not old identity.
      await expectStartRetained('short-updates-return', false)
      expect(await page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
      await page.evaluate(() => { (window as ObserverWindow).__entryVisualStartElement = document.querySelector('[data-entry-id="begin"]') })
      expect(await facts()).toEqual(before)
      if (viewport.width === 375) {
        await activate(begin); await expect(current).toBeEnabled(); await activate(current)
        await expect(page.locator('.center-experience')).toBeVisible({ timeout: 25_000 })
        await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 20_000 })
      } else {
        await activate(begin); await expect(fresh).toBeEnabled(); await activate(fresh)
        await expect(confirm).toBeEnabled()
        const box = (await confirm.boundingBox())!
        await startTrace('confirm-fade-out', '.save-entry-choices', 400)
        await startTrace('confirmed-loading-caption', '[data-entry-id="begin"] [data-entry-text-fade-value]', 1200)
        // Real repeated taps at the verified confirmation point, not direct service calls.
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['confirm-fade-out'].frames.some(frame => frame.opacity > .05 && frame.opacity < .95))
        expect((await finishTrace('confirm-fade-out', 3)).some(frame => frame.opacity > .05 && frame.opacity < .95)).toBe(true)
        await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.['confirmed-loading-caption'].frames.some(frame => frame.text === '加载游戏中' && frame.animation === 'entry-text-fade-in' && frame.opacity > .05 && frame.opacity < .95))
        await screenshot('confirmed-loading-caption-fade-in', '[data-entry-id="begin"] [data-entry-text-fade-value]', false)
        const confirmedCaption = await finishTrace('confirmed-loading-caption')
        expect(confirmedCaption.some(frame => frame.text === '开始游戏' && frame.animation === 'entry-text-fade-out' && frame.opacity > .05 && frame.opacity < .95)).toBe(true)
        expect(confirmedCaption.some(frame => frame.text === '加载游戏中' && frame.animation === 'entry-text-fade-in' && frame.opacity > .05 && frame.opacity < .95)).toBe(true)
        expect(confirmedCaption.every(frame => frame.beginVisible && frame.beginFrame === 1)).toBe(true)
        await expect(page.locator('.center-experience')).toBeVisible({ timeout: 25_000 })
        await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 20_000 })
        const after = await facts(), replaced = JSON.parse(after[AUTHORITY]!)
        expect(replaced.generation.sequence).toBe(authority.generation.sequence + 1)
        expect(replaced.generation.id).not.toBe(authority.generation.id)
        expect(JSON.parse(replaced.values['newtone-player-save-v1']).walletBalance).toBe(800)
        const newBackups = Object.keys(after).filter(key => key.startsWith(BACKUP_PREFIX) && !(key in before))
        expect(newBackups).toHaveLength(1)
        expect(JSON.parse(after[newBackups[0]]!).authorityRaw).toBe(before[AUTHORITY])
        for (const [key, value] of Object.entries(before)) {
          if (!key.startsWith(EPOCH_PREFIX) && key !== WRITER_LOCK) expect(after[key]).toBe(value)
        }
      }
    }
  })
  })
}

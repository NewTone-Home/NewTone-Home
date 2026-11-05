import { test, expect } from '@playwright/test'
import { AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, SAVE_EPOCH } from '../src/services/saveEpoch.mjs'
type Frame = { at: number; opacity: number; y: number; animation: string; beginVisible: boolean; beginFrame: number; beginText: number }
type Trace = { frames: Frame[]; done: boolean; error?: string }
type ObserverWindow = Window & { __entryVisualMotion?: Record<string, Trace>; __entryVisualPointerTypes?: string[]; __entryVisualStartElement?: Element | null }

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
    const screenshot = async (label: string, movingSelector?: string) => {
      if (movingSelector) {
        const state = await page.locator(movingSelector).evaluate(node => {
          const style = getComputedStyle(node)
          return { at: performance.now(), opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 }
        })
        expect(state.opacity).toBeGreaterThan(.05); expect(state.opacity).toBeLessThan(.95)
        expect(state.y).toBeLessThan(-.2)
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
          trace.frames.push({ at: now, opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42, animation: style.animationName,
            beginVisible: !!begin && getComputedStyle(begin).visibility !== 'hidden' && begin.getAttribute('data-entry-visible') === 'true',
            beginFrame: Number(begin?.getAttribute('data-entry-frame-progress')), beginText: Number(begin?.getAttribute('data-entry-text-progress')) })
        }
        if (first !== null && now - first >= duration) trace.done = true
        else if (now - started > 10_000) { trace.error = 'actual element never appeared'; trace.done = true }
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { key, selector, duration })
    const finishTrace = async (key: string) => {
      await page.waitForFunction(key => (window as ObserverWindow).__entryVisualMotion?.[key]?.done, key)
      const trace = await page.evaluate(key => (window as ObserverWindow).__entryVisualMotion![key], key)
      await testInfo.attach(`${viewport.width}-${key}-frames`, { body: JSON.stringify(trace, null, 2), contentType: 'application/json' })
      expect(trace.error).toBeUndefined(); expect(trace.frames.length).toBeGreaterThan(8)
      return trace.frames
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
    await activate(begin)
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
    await startTrace('breathe', '[data-entry-id="continue"]', 700)
    if (touch) {
      const box = (await current.boundingBox())!, cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
      await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.breathe.frames.some(frame => frame.animation.includes('dialogue-choice-breathe') && frame.opacity < .9))
      await screenshot('touch-hold-breathe-in-progress')
      const breath = await finishTrace('breathe')
      expectActiveBreathing(breath)
      // Cancel a held touch, rather than select Continue and leave the test menu.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      await cdp.detach()
      expect(await page.evaluate(() => (window as ObserverWindow).__entryVisualPointerTypes)).toContain('touch')
    } else {
      await current.hover()
      await page.waitForFunction(() => (window as ObserverWindow).__entryVisualMotion?.breathe.frames.some(frame => frame.animation.includes('dialogue-choice-breathe') && frame.opacity < .9))
      await screenshot('mouse-hover-breathe-in-progress')
      const breath = await finishTrace('breathe')
      expectActiveBreathing(breath)
      await page.mouse.move(0, 0)
    }
    expect(await facts()).toEqual(before)
    await screenshot('current-expanded-pure-text')
    await activate(fresh)
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
    if (viewport.width === 375) {
      const landing = page.locator('.landing'), hint = page.locator('.landing-device-hint[data-world-mode="true"]')
      expect(await landing.evaluate(node => getComputedStyle(node).overflowY)).toBe('auto')
      const cdp = await context.newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 12, y: 600 }] })
      for (const y of [580, 560, 540]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 12, y }] })
        await page.waitForTimeout(30) // real input spacing, not a fake clock or programmatic scroll
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
      await expect.poll(() => landing.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
      await expect(hint).toBeInViewport({ ratio: 1 })
      await expect.poll(async () => { const visible = await hint.boundingBox(); return visible!.y + visible!.height })
        .toBeLessThanOrEqual(viewport.height - 10)
      expect(await facts()).toEqual(before)
      await screenshot('short-touch-scrolled-complete-device-note')
    }
    await activate(cancel)
    await expect(fresh).toBeFocused()
    expect(await facts()).toEqual(before)
    await page.keyboard.press('Escape')
    await expect(begin).toBeEnabled()
    await expect.poll(() => page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
    await expectStartRetained('collapsed-after-scroll')
    expect(await facts()).toEqual(before)
    await activate(updates)
    await expect(page.locator('.landing-updates-page[data-updates-phase="updates"]')).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
    await screenshot('updates-open')
    if (viewport.width === 375) {
      await activate(page.locator('[data-entry-id="landing-updates-return"]'))
      await expect(page.locator('.landing[data-updates-phase="landing"]')).toBeVisible({ timeout: 15_000 })
      await expect(begin).toBeEnabled()
      // Updates legitimately unmounts the entry controls; validate the NEW
      // mounted Start against the same layout/safety contract, not old identity.
      await expectStartRetained('short-updates-return', false)
      expect(await page.locator('.landing').evaluate(node => node.scrollTop)).toBe(0)
      await page.evaluate(() => { (window as ObserverWindow).__entryVisualStartElement = document.querySelector('[data-entry-id="begin"]') })
      expect(await facts()).toEqual(before)
      await activate(begin)
      await expect(current).toBeEnabled()
      await activate(current)
      await expect(page.locator('.center-experience')).toBeVisible({ timeout: 25_000 })
      await expect(page.locator('[data-world-entry-phase]')).toHaveCount(0, { timeout: 20_000 })
    }
  })
  })
}

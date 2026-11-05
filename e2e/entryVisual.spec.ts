import { test, expect } from '@playwright/test'
import { AUTHORITY, PENDING, ACKNOWLEDGED, GUARD, SAVE_EPOCH } from '../src/services/saveEpoch.mjs'
type Frame = { at: number; opacity: number; y: number; animation: string }
type Trace = { frames: Frame[]; done: boolean; error?: string }
type ObserverWindow = Window & { __entryVisualMotion?: Record<string, Trace>; __entryVisualPointerTypes?: string[] }

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
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  const touch = viewport.width === 390
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
          trace.frames.push({ at: now, opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42, animation: style.animationName })
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
    const choices = page.locator('.save-entry-choices')
    await expect(choices).toBeVisible()
    const animation = await choices.evaluate(node => ({ name: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration }))
    expect(animation.name).toBe('save-entry-options-reveal')
    expect(animation.duration).toBe('0.32s')
    const current = page.locator('[data-entry-id="continue"]'), fresh = page.locator('[data-entry-id="request-replace"]')
    await expect(current).toBeEnabled(); await expect(fresh).toBeEnabled()
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
    const [newBox, yesBox, noBox] = await Promise.all([fresh.boundingBox(), confirm.boundingBox(), cancel.boundingBox()])
    expect(newBox && yesBox && noBox).toBeTruthy()
    expect(yesBox!.y).toBeGreaterThanOrEqual(newBox!.y + newBox!.height)
    expect(Math.abs(yesBox!.y - noBox!.y)).toBeLessThan(2)
    expect(noBox!.x).toBeGreaterThan(yesBox!.x)
    expect(await facts()).toEqual(before)
    await screenshot('confirm-cancel-below-new-game')
    await activate(cancel)
    await expect(fresh).toBeFocused()
    expect(await facts()).toEqual(before)
    await page.keyboard.press('Escape')
    await expect(begin).toBeEnabled()
    expect(await facts()).toEqual(before)
    await activate(updates)
    await expect(page.locator('.landing-updates-page[data-updates-phase="updates"]')).toBeVisible({ timeout: 15_000 })
    await screenshot('updates-open')
  })
  })
}

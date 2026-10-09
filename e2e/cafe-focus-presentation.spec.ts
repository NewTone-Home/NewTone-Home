import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`Café frame keeps façade dimensions through reveal and leave at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto('/e2e/fixtures/center-presentation.html')
    const group = page.locator('[data-focus-target-group="storefront:commercial-cafe-slot:baseline"]')
    const label = group.locator('[data-storefront-label-phase]')
    const frame = group.locator('[data-focus-frame-phase]')
    await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
    await group.evaluate(element => {
      const history: { phase: string; retracted: boolean }[] = []
      ;(window as unknown as { cafeHistory: typeof history }).cafeHistory = history
      new MutationObserver(() => {
        const phase = element.querySelector<HTMLElement>('[data-storefront-label-phase]')!.dataset.storefrontLabelPhase!
        history.push({ phase, retracted: element.querySelector('.scene-focus-frame')!.classList.contains('is-requested-retraction') })
      }).observe(element, { attributes: true, subtree: true, attributeFilter: ['data-storefront-label-phase'] })
    })
    const original = (await group.boundingBox())!
    const originalFrame = (await frame.boundingBox())!
    expect(await group.evaluate(element => element.style.height)).toMatch(/%$/)
    const initialLabelGeometry = await group.evaluate(element => {
      const slot = element.querySelector<HTMLElement>('[data-storefront-label-slot]')!
      const track = slot.querySelector<HTMLElement>('[data-storefront-label-phase]')!
      const slotRect = slot.getBoundingClientRect()
      const trackRect = track.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(track)
      const glyphRects = Array.from(range.getClientRects())
      return {
        slot: { left: slotRect.left, right: slotRect.right, top: slotRect.top, bottom: slotRect.bottom, width: slotRect.width },
        track: { left: trackRect.left, right: trackRect.right, width: trackRect.width },
        glyphRects: glyphRects.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
        overflow: getComputedStyle(slot).overflow,
        transitionDuration: getComputedStyle(track).transitionDuration,
      }
    })
    expect(initialLabelGeometry.overflow).toBe('hidden')
    expect(initialLabelGeometry.transitionDuration).toBe('0.7s')
    expect(initialLabelGeometry.slot.width).toBeGreaterThan(initialLabelGeometry.track.width)
    expect(initialLabelGeometry.glyphRects.length).toBeGreaterThan(0)
    for (const glyph of initialLabelGeometry.glyphRects) {
      expect(glyph.left).toBeGreaterThanOrEqual(initialLabelGeometry.slot.left - 0.5)
      expect(glyph.right).toBeLessThanOrEqual(initialLabelGeometry.slot.right + 0.5)
    }
    expect((initialLabelGeometry.slot.left + initialLabelGeometry.slot.right) / 2).toBeCloseTo((original.x + original.width / 2), 0)
    await page.screenshot({ path: info.outputPath('cafe-baseline.png') })
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'revealing')
    const revealSamples = []
    for (const percent of [0, 25, 50, 75, 99]) {
      const sample = await label.evaluate((track, progress) => {
        const transition = track.getAnimations().find(animation => animation.constructor.name === 'CSSTransition'
          && (animation as Animation & { transitionProperty?: string }).transitionProperty === 'transform')
        if (!transition || !transition.effect) throw new Error('Expected an active storefront transform transition')
        const duration = Number(transition.effect.getTiming().duration)
        transition.pause()
        transition.currentTime = duration * progress / 100
        const rect = track.getBoundingClientRect()
        const parent = track.parentElement!.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(track)
        const glyphRects = Array.from(range.getClientRects()).map(item => ({ left: item.left, right: item.right, top: item.top, bottom: item.bottom }))
        return {
          duration,
          transform: getComputedStyle(track).transform,
          opacity: getComputedStyle(track).opacity,
          textOpacity: getComputedStyle(track.querySelector('.scene-mainline-storefront__label-text')!).opacity,
          track: { top: rect.top, bottom: rect.bottom },
          slot: { top: parent.top, bottom: parent.bottom },
          glyphRects,
          background: getComputedStyle(track).backgroundColor,
          room: getComputedStyle(document.querySelector('.mainline-scene-stage')!).getPropertyValue('--room').trim(),
        }
      }, percent)
      expect(sample.duration).toBe(700)
      expect(sample.background).toBe('rgb(11, 15, 18)')
      expect(sample.room).toBe('#0b0f12')
      expect(sample.opacity).toBe('1')
      expect(sample.textOpacity).toBe('1')
      expect(sample.glyphRects.length).toBeGreaterThan(0)
      revealSamples.push(sample)
      await page.screenshot({ path: info.outputPath(`cafe-reveal-${percent}.png`) })
    }
    expect(new Set(revealSamples.map(sample => sample.transform)).size).toBeGreaterThan(3)
    await label.evaluate(track => {
      const transition = track.getAnimations().find(animation => animation.constructor.name === 'CSSTransition'
        && (animation as Animation & { transitionProperty?: string }).transitionProperty === 'transform')
      transition?.finish()
    })
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await expect(frame).toHaveClass(/is-requested-retraction/)
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'lingering')
    await expect(frame).toHaveClass(/is-requested-retraction/)
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'lingering')
    await page.screenshot({ path: info.outputPath('cafe-lingering.png') })
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'restoring', { timeout: 5000 })
    const restoreSamples = []
    for (const percent of [0, 25, 50, 75, 99]) {
      const sample = await label.evaluate((track, progress) => {
        const animation = track.getAnimations().find(candidate => candidate.constructor.name === 'CSSAnimation'
          && (candidate as CSSAnimation).animationName === 'storefront-presentation-restore')
        if (!animation || !animation.effect) throw new Error('Expected an active storefront restore animation')
        const duration = Number(animation.effect.getTiming().duration)
        animation.pause()
        animation.currentTime = duration * progress / 100
        const rect = track.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(track)
        const glyphRects = Array.from(range.getClientRects()).map(item => ({ left: item.left, right: item.right, top: item.top, bottom: item.bottom }))
        return { duration, transform: getComputedStyle(track).transform, opacity: getComputedStyle(track).opacity, textOpacity: getComputedStyle(track.querySelector('.scene-mainline-storefront__label-text')!).opacity, top: rect.top, glyphRects, background: getComputedStyle(track).backgroundColor }
      }, percent)
      expect(sample.duration).toBe(700)
      expect(sample.background).toBe('rgb(11, 15, 18)')
      expect(sample.opacity).toBe('1')
      expect(sample.textOpacity).toBe('1')
      expect(sample.glyphRects.length).toBeGreaterThan(0)
      restoreSamples.push(sample)
      await page.screenshot({ path: info.outputPath(`cafe-restore-${percent}.png`) })
    }
    expect(new Set(restoreSamples.map(sample => sample.transform)).size).toBeGreaterThan(3)
    await label.evaluate(track => track.getAnimations().find(animation => animation.constructor.name === 'CSSAnimation'
      && (animation as CSSAnimation).animationName === 'storefront-presentation-restore')?.finish())
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'baseline', { timeout: 5000 })
    const history = await page.evaluate(() => (window as unknown as { cafeHistory: { phase: string; retracted: boolean }[] }).cafeHistory)
    expect(history).toContainEqual({ phase: 'lingering', retracted: true })
    expect(history).toContainEqual({ phase: 'restoring', retracted: false })
    await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
    const restored = (await group.boundingBox())!
    expect(restored.width).toBeCloseTo(original.width, 1)
    expect(restored.height).toBeCloseTo(original.height, 1)
    const restoredFrame = (await frame.boundingBox())!
    expect(restoredFrame.width).toBeCloseTo(originalFrame.width, 1)
    expect(restoredFrame.height).toBeCloseTo(originalFrame.height, 1)
    await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible', { timeout: 4000 })
    await page.screenshot({ path: info.outputPath('cafe-restored.png') })
    expect(errors).toEqual([])
  })
}

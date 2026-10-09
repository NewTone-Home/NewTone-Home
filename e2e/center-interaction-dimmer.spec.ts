import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`interaction dimmer transitions without owning the input shield at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/center-presentation.html')
    const dimmer = page.locator('.scene-dialogue-dimmer')
    await expect(dimmer).toHaveCount(1)
    expect(await dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
    expect(await dimmer.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')

    await page.locator('[data-fixture-observation]').click()
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(1)
    await page.locator('[data-scene-dialogue-shield]').click({ position: { x: 10, y: 10 }, force: true })
    expect(await page.evaluate(() => (window as Window & { fixtureWalkCount?: number }).fixtureWalkCount ?? 0)).toBe(0)
    const observation = await dimmer.evaluate(element => {
      const transition = element.getAnimations().find(animation => animation.constructor.name === 'CSSTransition'
        && (animation as Animation & { transitionProperty?: string }).transitionProperty === 'opacity')
      if (!transition?.effect) throw new Error('Expected observation opacity transition')
      const duration = Number(transition.effect.getTiming().duration)
      transition.pause()
      transition.currentTime = duration / 2
      return { duration, opacity: Number(getComputedStyle(element).opacity), pointerEvents: getComputedStyle(element).pointerEvents }
    })
    expect(observation.duration).toBe(250)
    expect(observation.opacity).toBeGreaterThan(0)
    expect(observation.opacity).toBeLessThan(.18)
    expect(observation.pointerEvents).toBe('none')
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0.18')

    await page.locator('[data-fixture-dialogue]').evaluate(element => (element as HTMLButtonElement).click())
    const dialogue = await dimmer.evaluate(element => {
      const transition = element.getAnimations().find(animation => animation.constructor.name === 'CSSTransition'
        && (animation as Animation & { transitionProperty?: string }).transitionProperty === 'opacity')
      if (!transition?.effect) throw new Error('Expected dialogue opacity transition')
      const duration = Number(transition.effect.getTiming().duration)
      transition.pause()
      transition.currentTime = duration / 2
      return { duration, opacity: Number(getComputedStyle(element).opacity) }
    })
    expect(dialogue.duration).toBe(250)
    expect(dialogue.opacity).toBeGreaterThan(.18)
    expect(dialogue.opacity).toBeLessThan(.42)
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(1)
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0.42')

    await page.locator('[data-fixture-close]').evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(0)
    const exiting = await dimmer.evaluate(element => {
      const transition = element.getAnimations().find(animation => animation.constructor.name === 'CSSTransition'
        && (animation as Animation & { transitionProperty?: string }).transitionProperty === 'opacity')
      if (!transition?.effect) throw new Error('Expected exit opacity transition')
      const duration = Number(transition.effect.getTiming().duration)
      transition.pause()
      transition.currentTime = duration / 2
      return { duration, opacity: Number(getComputedStyle(element).opacity), pointerEvents: getComputedStyle(element).pointerEvents }
    })
    expect(exiting.duration).toBe(250)
    expect(exiting.opacity).toBeGreaterThan(0)
    expect(exiting.opacity).toBeLessThan(.42)
    expect(exiting.pointerEvents).toBe('none')
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
    await page.locator('.mainline-scene-stage').click({ position: { x: viewport.width * .9, y: viewport.height * .9 } })
    expect(await page.evaluate(() => (window as Window & { fixtureWalkCount?: number }).fixtureWalkCount ?? 0)).toBeGreaterThan(0)
    await expect(dimmer).toHaveCount(1)
  })
}

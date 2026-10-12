import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`interaction dimmer follows one opacity rate without owning the input shield at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/center-presentation.html')
    const dimmer = page.locator('.scene-dialogue-dimmer')
    await expect(dimmer).toHaveCount(1)
    expect(await dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
    expect(await dimmer.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')

    await page.locator('[data-fixture-observation]').click()
    await expect(page.locator('.scene-mainline-text[data-scene-echo]')).toContainText('我跟你说')
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(1)
    await page.locator('[data-scene-dialogue-shield]').click({ position: { x: 10, y: 10 }, force: true })
    expect(await page.evaluate(() => (window as Window & { fixtureWalkCount?: number }).fixtureWalkCount ?? 0)).toBe(0)
    await expect.poll(() => dimmer.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    const entering = await dimmer.evaluate(element => {
      const animation = element.getAnimations()[0]
      if (!animation?.effect) throw new Error('Expected observation opacity animation')
      const duration = Number(animation.effect.getTiming().duration)
      animation.pause()
      const samples = [0.25, 0.5, 0.75].map(progress => {
        animation.currentTime = duration * progress
        return Number(getComputedStyle(element).opacity)
      })
      return { duration, samples }
    })
    expect(entering.duration).toBe(800)
    expect(Math.abs(entering.samples[0] - .045)).toBeLessThan(.001)
    expect(Math.abs(entering.samples[1] - .09)).toBeLessThan(.001)
    expect(Math.abs(entering.samples[2] - .135)).toBeLessThan(.001)
    expect(await dimmer.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0.18')

    await page.locator('[data-fixture-dialogue]').evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('.scene-mainline-text[data-scene-dialogue]')).toContainText('我跟你说')
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(1)
    await expect.poll(() => dimmer.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    const dialogue = await dimmer.evaluate(element => {
      const animation = element.getAnimations()[0]
      if (!animation?.effect) throw new Error('Expected dialogue opacity animation')
      const duration = Number(animation.effect.getTiming().duration)
      animation.pause()
      animation.currentTime = duration / 2
      return { duration, midpoint: Number(getComputedStyle(element).opacity) }
    })
    expect(dialogue.duration).toBeCloseTo(800 * .24 / .42, 1)
    expect(dialogue.midpoint).toBeCloseTo(.3, 3)
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0.42')

    await page.locator('[data-fixture-close]').evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(0)
    await expect.poll(() => dimmer.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    const exiting = await dimmer.evaluate(element => {
      const animation = element.getAnimations()[0]
      if (!animation?.effect) throw new Error('Expected exit opacity animation')
      const duration = Number(animation.effect.getTiming().duration)
      animation.pause()
      const samples = [0.25, 0.5, 0.75].map(progress => {
        animation.currentTime = duration * progress
        return Number(getComputedStyle(element).opacity)
      })
      return { duration, samples }
    })
    expect(exiting.duration).toBe(800)
    expect(Math.abs(exiting.samples[0] - .315)).toBeLessThan(.001)
    expect(Math.abs(exiting.samples[1] - .21)).toBeLessThan(.001)
    expect(Math.abs(exiting.samples[2] - .105)).toBeLessThan(.001)
    await dimmer.evaluate(element => {
      const animation = element.getAnimations()[0]
      if (animation) animation.currentTime = Number(animation.effect?.getTiming().duration) / 2
    })
    await page.locator('[data-fixture-observation]').evaluate(element => (element as HTMLButtonElement).click())
    await expect.poll(() => dimmer.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    const reversed = await dimmer.evaluate(element => {
      const animation = element.getAnimations()[0]
      if (!animation?.effect) throw new Error('Expected reversed opacity animation')
      const duration = Number(animation.effect.getTiming().duration)
      animation.pause()
      animation.currentTime = duration / 2
      return { duration, midpoint: Number(getComputedStyle(element).opacity) }
    })
    expect(reversed.duration).toBeCloseTo(800 * .03 / .18, 1)
    expect(reversed.midpoint).toBeCloseTo(.195, 3)
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0.18')

    await page.locator('[data-fixture-close]').evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('[data-scene-dialogue-shield]')).toHaveCount(0)
    await expect.poll(() => dimmer.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    await dimmer.evaluate(element => element.getAnimations()[0]?.finish())
    await expect.poll(() => dimmer.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
    expect(await dimmer.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
    await page.locator('.mainline-scene-stage').click({ position: { x: viewport.width * .9, y: viewport.height * .9 } })
    expect(await page.evaluate(() => (window as Window & { fixtureWalkCount?: number }).fixtureWalkCount ?? 0)).toBeGreaterThan(0)
    await expect(dimmer).toHaveCount(1)
  })
}

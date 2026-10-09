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
    expect(await group.evaluate(element => element.style.height)).toMatch(/%$/)
    await page.screenshot({ path: info.outputPath('cafe-baseline.png') })
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await expect(frame).toHaveClass(/is-requested-retraction/)
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'lingering')
    await expect(frame).toHaveClass(/is-requested-retraction/)
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await page.locator('[data-fixture-approach]').click()
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'lingering')
    await expect(label).toHaveAttribute('data-storefront-label-phase', 'baseline', { timeout: 5000 })
    const history = await page.evaluate(() => (window as unknown as { cafeHistory: { phase: string; retracted: boolean }[] }).cafeHistory)
    expect(history).toContainEqual({ phase: 'lingering', retracted: true })
    expect(history).toContainEqual({ phase: 'restoring', retracted: false })
    await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
    const restored = (await group.boundingBox())!
    expect(restored.width).toBeCloseTo(original.width, 1)
    expect(restored.height).toBeCloseTo(original.height, 1)
    await page.screenshot({ path: info.outputPath('cafe-restored.png') })
    expect(errors).toEqual([])
  })
}

import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test('Café fixed cells, synchronized switches and real door at ' + viewport.width + 'x' + viewport.height, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/e2e/fixtures/center-presentation.html')
    const host = page.locator('.scene-portal-characters')
    const cells = host.locator('[data-storefront-cell-id]')
    const large = host.locator('[data-focus-frame-group="storefront:commercial-cafe-slot:baseline"]')
    const small = host.locator('[data-focus-frame-group="door:street-cafe-entry"]')
    await expect(large).toHaveAttribute('data-focus-frame-phase', 'visible')
    await expect(cells).toHaveCount(3)
    await expect(host.locator('button')).toHaveCount(1)
    await expect(page.locator('.scene-mainline-storefront__replacement,.scene-storefront-door-character')).toHaveCount(0)
    const initial = await cells.evaluateAll(nodes => nodes.map(node => ({ id: (node as HTMLElement).dataset.storefrontCellId, left: (node as HTMLElement).style.left, top: (node as HTMLElement).style.top, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
    expect(new Set(initial.map(cell => cell.id)).size).toBe(3)
    expect(new Set(initial.map(cell => cell.top)).size).toBe(3)
    expect(await host.locator('.scene-character-switch__before').allTextContents()).toEqual(['咖', '啡', '馆'])
    await page.screenshot({ path: info.outputPath('baseline.png') })
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealing')
    expect(await large.getAttribute('data-focus-frame-phase')).toBe('collapsed')
    expect(await small.getAttribute('data-focus-frame-phase')).toBe('collapsed')
    await expect(host).toHaveAttribute('data-character-motion-duration', '700')
    const samples: number[] = []
    for (const [index, threshold] of [0.14, 0.48, 0.82].entries()) {
      const sampled = await page.waitForFunction(minimum => {
        const progress = Number(document.querySelector<HTMLElement>('.scene-portal-characters')?.dataset.characterProgress)
        return progress >= minimum && progress < 1 ? progress : false
      }, threshold)
      const value = await sampled.jsonValue() as number
      samples.push(value)
      const inherited = await host.locator('.scene-character-switch').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).getPropertyValue('--character-progress')))
      expect(new Set(inherited).size).toBe(1)
      expect(await large.getAttribute('data-focus-frame-phase')).toBe('collapsed')
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThan(1)
      await page.screenshot({ path: info.outputPath(`reveal-${[25, 50, 75][index]}pct.png`) })
    }
    expect(samples[0]).toBeGreaterThan(0)
    expect(samples[2]).toBeGreaterThan(samples[0])
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealed')
    expect(await host.getAttribute('data-character-motion-duration')).toBe('700')
    await page.screenshot({ path: info.outputPath('reveal-100pct.png') })
    await expect(small).toHaveAttribute('data-focus-frame-phase', 'visible')
    await page.screenshot({ path: info.outputPath('door-frame-aligned.png') })
    const doorAlignment = await page.evaluate(() => {
      const stage = document.querySelector('.mainline-scene-stage')!
      const glyph = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
        .find(node => node.dataset.focusVisualGroup === 'door:street-cafe-entry')!
      const frame = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame')]
        .find(node => node.dataset.focusFrameGroup === 'door:street-cafe-entry')!
      const range = document.createRange()
      range.selectNodeContents(glyph)
      const ink = range.getBoundingClientRect()
      const box = frame.getBoundingClientRect()
      return {
        glyph: { left: ink.left, top: ink.top, width: ink.width, height: ink.height },
        frame: { left: box.left, top: box.top, width: box.width, height: box.height },
        centerDelta: { x: (box.left + box.width / 2) - (ink.left + ink.width / 2), y: (box.top + box.height / 2) - (ink.top + ink.height / 2) },
      }
    })
    await info.attach(`cafe-door-alignment-${viewport.width}x${viewport.height}`, { body: JSON.stringify(doorAlignment), contentType: 'application/json' })
    expect(Math.hypot(doorAlignment.centerDelta.x, doorAlignment.centerDelta.y), JSON.stringify(doorAlignment)).toBeLessThanOrEqual(2)
    const final = await cells.evaluateAll(nodes => nodes.map(node => ({ id: (node as HTMLElement).dataset.storefrontCellId, left: (node as HTMLElement).style.left, top: (node as HTMLElement).style.top, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })))
    expect(final).toEqual(initial)
    expect(await host.locator('.scene-character-switch__after').allTextContents()).toEqual(['墙', '门', '墙'])
    await host.locator('button').click()
    expect(await page.evaluate(() => (window as Window & { fixtureInteractionId?: string }).fixtureInteractionId)).toBe('street-cafe-entry')
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'lingering')
    await expect(small).toHaveAttribute('data-focus-frame-phase', 'retracting')
    const departedAt = await page.evaluate(() => performance.now())
    await page.waitForFunction(start => {
      const current = document.querySelector<HTMLElement>('.scene-portal-characters')
      return performance.now() - start >= 2_200 && current?.dataset.storefrontLabelPhase === 'lingering'
    }, departedAt)
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'restoring')
    await expect(small).toHaveAttribute('data-focus-frame-phase', 'collapsed')
    await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('.scene-portal-characters')?.dataset.characterProgress) <= .7)
    await page.screenshot({ path: info.outputPath('restore-middle.png') })
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealing')
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealed')
    await page.locator('[data-fixture-approach]').click()
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'restoring')
    expect(await host.getAttribute('data-character-motion-duration')).toBe('700')
    for (const [index, progress] of [0.9, 0.5, 0.1].entries()) {
      await page.waitForFunction(({ selector, threshold }) => {
        const node = document.querySelector<HTMLElement>(selector)
        return node && Number(node.dataset.characterProgress) <= threshold
      }, { selector: '.scene-portal-characters', threshold: progress })
      expect(await host.getAttribute('data-storefront-label-phase')).toBe('restoring')
      await page.screenshot({ path: info.outputPath(`restore-${[25, 50, 75][index]}pct.png`) })
    }
    await expect(host).toHaveAttribute('data-storefront-label-phase', 'baseline')
    await expect(large).toHaveAttribute('data-focus-frame-phase', 'visible')
    await page.screenshot({ path: info.outputPath('restored.png') })
    expect(errors).toEqual([])
  })
}

test('reduced motion shortens glyph motion while preserving the departure state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/e2e/fixtures/center-presentation.html')
  const host = page.locator('.scene-portal-characters')
  await page.locator('[data-fixture-approach]').click()
  await expect(host).toHaveAttribute('data-storefront-label-phase', 'revealed')
  await expect(host).toHaveAttribute('data-character-motion-duration', '1')
  await page.locator('[data-fixture-approach]').click()
  await expect(host).toHaveAttribute('data-storefront-label-phase', 'lingering')
})

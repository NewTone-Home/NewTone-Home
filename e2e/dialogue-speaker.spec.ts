import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`speaker anchor and lifecycle remain independent of the body at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/e2e/fixtures/center-presentation.html')
    await page.locator('[data-fixture-dialogue]').click()
    const speaker = page.locator('.scene-mainline-speaker-anchor .scene-mainline-text__speaker')
    await expect(speaker).toHaveAttribute('data-speaker-phase', 'steady')
    const original = (await speaker.boundingBox())!
    await page.locator('[data-fixture-camera]').click()
    const widths: number[] = []
    for (const text of ['我跟你说，这一段长文字需要保持原有正文的阅读方式。', '好。', '我跟你说，这一段长文字需要保持原有正文的阅读方式。']) {
      await page.locator('[data-fixture-text]').fill(text)
      await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-scene-dialogue-ready', 'true')
      await expect(speaker).toHaveAttribute('data-speaker-phase', 'steady')
      const box = (await speaker.boundingBox())!
      expect(box.x).toBeCloseTo(original.x, 1)
      expect(box.y).toBeCloseTo(original.y, 1)
      widths.push((await page.locator('[data-scene-dialogue]').boundingBox())!.width)
      expect(await page.locator('[data-scene-text-mode="dialogue"] > span').evaluate(element => getComputedStyle(element).animationName)).toBe('mainline-echo-segment-scroll-down')
    }
    expect(widths[0]).toBeGreaterThan(widths[1])
    await speaker.evaluate(element => {
      const history: string[] = []
      ;(window as unknown as { speakerHistory: string[] }).speakerHistory = history
      new MutationObserver(() => history.push(`${element.textContent}:${element.getAttribute('data-speaker-phase')}`)).observe(element, { attributes: true, childList: true, characterData: true, subtree: true })
    })
    await page.locator('[data-fixture-speaker]').fill('老周')
    await expect(speaker).toHaveText('老周')
    await expect(speaker).toHaveAttribute('data-speaker-phase', 'steady')
    const history = await page.evaluate(() => (window as unknown as { speakerHistory: string[] }).speakerHistory)
    expect(history).toContain('修杰:exiting')
    expect(history).toContain('老周:entering')
    await page.locator('[data-fixture-speaker]').fill('店员')
    await page.locator('[data-fixture-speaker]').fill('一个较长的中文名字')
    await page.locator('[data-fixture-speaker]').fill('English Speaker')
    await expect(speaker).toHaveText('English Speaker')
    await expect(speaker).toHaveAttribute('data-speaker-phase', 'steady')
    await expect(speaker).toHaveCount(1)
    await page.screenshot({ path: info.outputPath('speaker-stable.png') })
    await page.locator('[data-fixture-close]').click()
    await expect(speaker).toHaveCount(0)
    await page.locator('[data-fixture-dialogue]').click()
    await expect(speaker).toHaveText('English Speaker')
    expect(errors).toEqual([])
  })
}

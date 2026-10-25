import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 800 }, { width: 411, height: 914 }]) {
  test(`reading box and occlusion boundary resize together at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/reading-layout-transition.html')
    await page.locator('[data-reading-start]').click()
    const text = page.locator('.scene-mainline-text[data-scene-echo]')
    await expect(text).toContainText('比较宽的第一页')
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'false')
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      ;(window as Window & { __readingTextNode?: Element | null }).__readingTextNode = document.querySelector('.scene-mainline-text[data-scene-echo]')
    })
    const before = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: style.fontSize,
        layoutWidth: Number((element as HTMLElement).dataset.sceneReadingLayoutWidth),
        occlusionWidth: Number((element as HTMLElement).dataset.sceneReadingOcclusionWidth),
        worldScale: Number((element as HTMLElement).dataset.sceneReadingWorldScale),
        worldX: Number((element as HTMLElement).dataset.sceneReadingPositionX),
        worldY: Number((element as HTMLElement).dataset.sceneReadingPositionY),
        pageKey: (element as HTMLElement).dataset.sceneReadingPageKey }
    })

    await page.evaluate(() => {
      const target = window as Window & { __readingLayoutSamples?: Array<Record<string, number | string>> }
      target.__readingLayoutSamples = []
      const stopAt = performance.now() + 1200
      const sample = () => {
        const element = document.querySelector<HTMLElement>('.scene-mainline-text[data-scene-echo]')
        if (element) {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          target.__readingLayoutSamples!.push({
            pageKey: element.dataset.sceneReadingPageKey ?? '',
            width: rect.width,
            height: rect.height,
            layoutWidth: Number(element.dataset.sceneReadingLayoutWidth),
            occlusionWidth: Number(element.dataset.sceneReadingOcclusionWidth),
            worldScale: Number(element.dataset.sceneReadingWorldScale),
            fontSize: style.fontSize,
            transitioning: element.dataset.sceneReadingLayoutTransitioning ?? '',
            worldX: Number(element.dataset.sceneReadingPositionX),
            worldY: Number(element.dataset.sceneReadingPositionY),
            x: rect.x,
            y: rect.y,
          })
        }
        if (performance.now() < stopAt) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.locator('[data-reading-next]').click()
    await expect(text).toContainText('短页')
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'false', { timeout: 1500 })
    const samples = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>('.scene-mainline-text[data-scene-echo]')
      const pageKey = element?.dataset.sceneReadingPageKey
      return ((window as Window & { __readingLayoutSamples?: Array<Record<string, number | string>> }).__readingLayoutSamples ?? [])
        .filter(sample => sample.pageKey === pageKey)
        .map(sample => sample as { width: number; height: number; layoutWidth: number; occlusionWidth: number; worldScale: number; fontSize: string; transitioning: string; x: number; y: number; worldX: number; worldY: number })
    })
    expect(samples.length).toBeGreaterThan(8)
    expect(samples[0].width).toBeCloseTo(before.width, 0)
    expect(samples.at(-1)!.width).toBeLessThan(samples[0].width)
    expect(samples.some(sample => sample.transitioning === 'true')).toBe(true)
    expect(samples.every(sample => sample.fontSize === before.fontSize)).toBe(true)
    expect(samples.every(sample => sample.transitioning === 'true' || sample.transitioning === 'false')).toBe(true)
    expect(samples.every(sample => sample.width > 0 && sample.height > 0 && sample.occlusionWidth > 0)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.occlusionWidth * sample.worldScale - sample.layoutWidth) < .1)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.x + sample.width / 2 - (before.x + before.width / 2)) < 1)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.y + sample.height / 2 - (before.y + before.height / 2)) < 1.5)).toBe(true)
    expect(samples.every(sample => sample.worldX === before.worldX && sample.worldY === before.worldY)).toBe(true)
    const sameNode = await page.evaluate(() => (window as Window & { __readingTextNode?: Element | null }).__readingTextNode === document.querySelector('.scene-mainline-text[data-scene-echo]'))
    expect(sameNode).toBe(true)
    const transitionCommits = await page.evaluate(() => (window as Window & { __readingLayoutCommitCount?: number }).__readingLayoutCommitCount ?? 0)
    expect(transitionCommits).toBeLessThan(60)
    await page.waitForTimeout(250)
    const idleBefore = await page.evaluate(() => (window as Window & { __readingLayoutCommitCount?: number }).__readingLayoutCommitCount ?? 0)
    await page.waitForTimeout(250)
    const idleAfter = await page.evaluate(() => (window as Window & { __readingLayoutCommitCount?: number }).__readingLayoutCommitCount ?? 0)
    expect(idleAfter).toBe(idleBefore)

    await page.locator('[data-reading-next]').click()
    await expect(text).toContainText('第三页比短页宽一些')
    await page.locator('[data-reading-next]').click()
    await expect(text).toContainText('比较宽的第一页')
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'false', { timeout: 1500 })
    await page.locator('[data-reading-next]').click()
    await expect(text).toContainText('短页')
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'false', { timeout: 1500 })
    const finalPage = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        worldX: Number((element as HTMLElement).dataset.sceneReadingPositionX), worldY: Number((element as HTMLElement).dataset.sceneReadingPositionY) }
    })
    await page.locator('[data-reading-leave]').click()
    await expect(text).toHaveClass(/is-leaving/)
    const leaving = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: style.fontSize, opacity: style.opacity,
        worldX: Number((element as HTMLElement).dataset.sceneReadingPositionX), worldY: Number((element as HTMLElement).dataset.sceneReadingPositionY) }
    })
    expect(leaving.x).toBeCloseTo(finalPage.x, 0)
    expect(leaving.y).toBeCloseTo(finalPage.y, 0)
    expect(leaving.width).toBeCloseTo(finalPage.width, 0)
    expect(leaving.height).toBeCloseTo(finalPage.height, 0)
    expect(leaving.worldX).toBe(finalPage.worldX)
    expect(leaving.worldY).toBe(finalPage.worldY)
    expect(leaving.fontSize).toBe(before.fontSize)
    expect(Number(leaving.opacity)).toBeLessThanOrEqual(1)
    await page.locator('[data-reading-start]').click()
    await expect(text).not.toHaveClass(/is-leaving/)
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'true')
  })
}

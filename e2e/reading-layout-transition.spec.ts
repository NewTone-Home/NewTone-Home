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
        layoutHeight: Number((element as HTMLElement).dataset.sceneReadingLayoutHeight),
        occlusionWidth: Number((element as HTMLElement).dataset.sceneReadingOcclusionWidth),
        occlusionHeight: Number((element as HTMLElement).dataset.sceneReadingOcclusionHeight),
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
            layoutHeight: Number(element.dataset.sceneReadingLayoutHeight),
            occlusionWidth: Number(element.dataset.sceneReadingOcclusionWidth),
            occlusionHeight: Number(element.dataset.sceneReadingOcclusionHeight),
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
    await expect(text.locator('[data-page-flip="running"]')).toHaveCount(1)
    await expect(text.locator('[data-reading-page-role="outgoing"]')).toHaveCount(1)
    await expect(text.locator('[data-reading-page-role="incoming"]')).toHaveCount(1)
    await expect(text).toContainText('短页')
    await expect(text).toHaveAttribute('data-scene-reading-layout-transitioning', 'false', { timeout: 1500 })
    const samples = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>('.scene-mainline-text[data-scene-echo]')
      const pageKey = element?.dataset.sceneReadingPageKey
      return ((window as Window & { __readingLayoutSamples?: Array<Record<string, number | string>> }).__readingLayoutSamples ?? [])
        .filter(sample => sample.pageKey === pageKey)
        .map(sample => sample as { width: number; height: number; layoutWidth: number; layoutHeight: number; occlusionWidth: number; occlusionHeight: number; worldScale: number; fontSize: string; transitioning: string; x: number; y: number; worldX: number; worldY: number })
    })
    expect(samples.length).toBeGreaterThan(8)
    expect(samples[0].width).toBeCloseTo(before.width, 0)
    expect(samples.at(-1)!.width).toBeLessThan(samples[0].width)
    expect(samples.some(sample => sample.transitioning === 'true')).toBe(true)
    expect(samples.every(sample => sample.fontSize === before.fontSize)).toBe(true)
    expect(samples.every(sample => sample.transitioning === 'true' || sample.transitioning === 'false')).toBe(true)
    expect(samples.every(sample => sample.width > 0 && sample.height > 0 && sample.occlusionWidth > 0)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.height * sample.worldScale - sample.layoutHeight) < 1)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.occlusionWidth * sample.worldScale - sample.layoutWidth) < .1)).toBe(true)
    expect(samples.every(sample => Math.abs(sample.occlusionHeight * sample.worldScale - sample.layoutHeight) < .1)).toBe(true)
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

for (const viewport of [{ width: 1280, height: 800 }, { width: 411, height: 914 }]) {
  test(`dialogue page performs the same two-sided flip at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/reading-layout-transition.html')
    await page.locator('[data-reading-dialogue]').click()
    const text = page.locator('.scene-mainline-text[data-scene-dialogue]')
    await expect(text).toBeVisible()
    await expect(text.locator('[data-page-flip="settled"]')).toHaveCount(1)
    const before = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const node = element as HTMLElement
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: getComputedStyle(element).fontSize,
        worldX: node.dataset.sceneReadingPositionX, worldY: node.dataset.sceneReadingPositionY,
        scale: Number(node.dataset.sceneReadingWorldScale), layoutHeight: Number(node.dataset.sceneReadingLayoutHeight) }
    })

    await page.locator('[data-reading-next]').click()
    await expect(text.locator('[data-reading-page-role="outgoing"]')).toHaveCount(1)
    await expect(text.locator('[data-reading-page-role="incoming"]')).toHaveCount(1)
    await page.waitForTimeout(220)
    const midFlip = await text.evaluate(element => {
      const node = element as HTMLElement
      const rect = element.getBoundingClientRect()
      const outgoing = element.querySelector<HTMLElement>('[data-reading-page-role="outgoing"]')!
      const incoming = element.querySelector<HTMLElement>('[data-reading-page-role="incoming"]')!
      return { height: rect.height, layoutHeight: Number(node.dataset.sceneReadingLayoutHeight),
        scale: Number(node.dataset.sceneReadingWorldScale), fontSize: getComputedStyle(element).fontSize,
        outgoingOpacity: Number(getComputedStyle(outgoing).opacity), incomingOpacity: Number(getComputedStyle(incoming).opacity),
        worldX: node.dataset.sceneReadingPositionX, worldY: node.dataset.sceneReadingPositionY }
    })
    expect(Math.abs(midFlip.height * midFlip.scale - midFlip.layoutHeight)).toBeLessThan(1)
    expect(midFlip.fontSize).toBe(before.fontSize)
    expect(midFlip.worldX).toBe(before.worldX)
    expect(midFlip.worldY).toBe(before.worldY)
    expect(midFlip.outgoingOpacity + midFlip.incomingOpacity).toBeLessThan(1.01)

    await expect(text.locator('[data-page-flip="settled"]')).toHaveCount(1, { timeout: 1500 })
    await expect(text).toHaveAttribute('data-scene-dialogue-ready', 'true')
    const after = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const node = element as HTMLElement
      return { x: rect.x, y: rect.y, height: rect.height, worldX: node.dataset.sceneReadingPositionX, worldY: node.dataset.sceneReadingPositionY }
    })
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
    expect(after.worldX).toBe(before.worldX)
    expect(after.worldY).toBe(before.worldY)

    await page.locator('[data-reading-leave]').click()
    await expect(text).toHaveClass(/is-leaving/)
    const leaving = await text.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, height: rect.height }
    })
    expect(leaving.x).toBeCloseTo(after.x, 0)
    expect(leaving.y).toBeCloseTo(after.y, 0)
    expect(leaving.height).toBeCloseTo(after.height, 0)
  })
}

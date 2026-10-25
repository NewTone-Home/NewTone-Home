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
    // getBoundingClientRect is already in viewport CSS pixels; the rendered
    // layout token is also CSS pixels after the world scale transform.
    expect(samples.every(sample => Math.abs(sample.height - sample.layoutHeight) < 1)).toBe(true)
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
  test(`dialogue page rolls old text down and new text in from above at ${viewport.width}x${viewport.height}`, async ({ page }) => {
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
      const outgoingMatrix = new DOMMatrixReadOnly(getComputedStyle(outgoing).transform)
      const incomingMatrix = new DOMMatrixReadOnly(getComputedStyle(incoming).transform)
      const stack = element.querySelector<HTMLElement>('.scene-mainline-page-stack')!
      return { height: rect.height, layoutHeight: Number(node.dataset.sceneReadingLayoutHeight),
        scale: Number(node.dataset.sceneReadingWorldScale), fontSize: getComputedStyle(element).fontSize,
        outgoingY: outgoingMatrix.m42, incomingY: incomingMatrix.m42,
        progress: Number(stack.dataset.flipProgress),
        outgoingText: outgoing.textContent, incomingText: incoming.textContent,
        worldX: node.dataset.sceneReadingPositionX, worldY: node.dataset.sceneReadingPositionY }
    })
    expect(Math.abs(midFlip.height - midFlip.layoutHeight)).toBeLessThan(1)
    expect(midFlip.fontSize).toBe(before.fontSize)
    expect(midFlip.worldX).toBe(before.worldX)
    expect(midFlip.worldY).toBe(before.worldY)
    expect(midFlip.outgoingY).toBeGreaterThan(0)
    expect(midFlip.incomingY).toBeLessThan(0)
    expect(midFlip.progress).toBeGreaterThan(0)
    expect(midFlip.progress).toBeLessThan(1)
    expect(midFlip.outgoingText).not.toBe(midFlip.incomingText)
    expect(midFlip.outgoingText.length).toBeGreaterThan(0)
    expect(midFlip.incomingText.length).toBeGreaterThan(0)

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

for (const viewport of [{ width: 1280, height: 800 }, { width: 411, height: 914 }]) {
  test(`dialogue speaker label hugs the current body box at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/reading-layout-transition.html')
    await page.locator('[data-reading-dialogue]').click()
    const body = page.locator('.scene-mainline-text[data-scene-dialogue]')
    const name = page.locator('.scene-mainline-speaker-anchor .scene-mainline-text__speaker:not(.scene-mainline-text__speaker-space)')
    await expect(body.locator('[data-page-flip="settled"]')).toHaveCount(1)
    const measure = async () => Promise.all([
      body.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, centerX: rect.x + rect.width / 2 }
      }),
      name.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom }
      }),
      body.locator('.scene-mainline-page--current').evaluate(element => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const rect = range.getBoundingClientRect()
        return { x: rect.x, y: rect.y, height: rect.height }
      }),
    ])
    const before = await measure()
    expect(Math.abs(before[1].x - before[0].x)).toBeLessThanOrEqual(2)
    expect(before[2].height).toBeGreaterThan(0)
    expect(before[2].y - before[1].bottom).toBeGreaterThanOrEqual(-2)
    expect(before[2].y - before[1].bottom).toBeLessThanOrEqual(14)

    await page.locator('[data-reading-next]').click()
    await expect(body.locator('[data-page-flip="settled"]')).toHaveCount(1, { timeout: 1500 })
    const after = await measure()
    expect(Math.abs(after[1].x - after[0].x)).toBeLessThanOrEqual(2)
    expect(after[0].centerX).toBeCloseTo(before[0].centerX, 0)
    expect(after[2].y - after[1].bottom).toBeGreaterThanOrEqual(-2)
    expect(after[2].y - after[1].bottom).toBeLessThanOrEqual(14)
  })
}

for (const mode of ['observation', 'dialogue'] as const) {
  test(`${mode} ignores repeated continue input during a page flip but accepts the next page afterward`, async ({ page }) => {
    await page.setViewportSize({ width: 411, height: 914 })
    await page.goto('/e2e/fixtures/reading-layout-transition.html')
    await page.locator(mode === 'observation' ? '[data-reading-start]' : '[data-reading-dialogue]').click()
    const text = page.locator(mode === 'observation' ? '.scene-mainline-text[data-scene-echo]' : '.scene-mainline-text[data-scene-dialogue]')
    if (mode === 'dialogue') await expect(text).toHaveAttribute('data-scene-dialogue-ready', 'true')
    if (mode === 'observation') {
      await page.locator('[data-reading-type]').click()
      await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-typing', 'true')
      await page.locator('[data-scene-dialogue-shield]').evaluate(element => {
        const shield = element as HTMLButtonElement
        shield.click()
        shield.click()
      })
      await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-typing', 'false')
      await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-page-index', '0')
    }
    await page.locator('[data-scene-dialogue-shield]').evaluate(element => {
      const shield = element as HTMLButtonElement
      shield.click()
      shield.click()
      shield.click()
    })
    await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-page-index', '1')
    await expect(text.locator('[data-page-flip="settled"]')).toHaveCount(1, { timeout: 1500 })
    if (mode === 'dialogue') await expect(text).toHaveAttribute('data-scene-dialogue-ready', 'true')
    await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
    await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-page-index', '2')
  })
}

test('a delayed low-frame roll keeps the continue lock until its matching animation completes', async ({ page }) => {
  await page.setViewportSize({ width: 411, height: 914 })
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window)
    const cancelFrame = window.cancelAnimationFrame.bind(window)
    let nextId = 1
    const pending = new Map<number, { frame: number; timeout: number | null }>()
    window.requestAnimationFrame = callback => {
      const id = nextId++
      const frame = requestFrame(() => {
        const entry = pending.get(id)
        if (!entry) return
        entry.timeout = window.setTimeout(() => {
          pending.delete(id)
          callback(performance.now())
        }, 1200)
      })
      pending.set(id, { frame, timeout: null })
      return id
    }
    window.cancelAnimationFrame = id => {
      const entry = pending.get(id)
      if (!entry) return
      cancelFrame(entry.frame)
      if (entry.timeout !== null) window.clearTimeout(entry.timeout)
      pending.delete(id)
    }
  })
  await page.goto('/e2e/fixtures/reading-layout-transition.html')
  await page.locator('[data-reading-start]').click()
  const text = page.locator('.scene-mainline-text[data-scene-echo]')
  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(text.locator('[data-page-flip="running"]')).toHaveCount(1)
  await page.waitForTimeout(850)

  // This click arrives after the old 720ms-from-click timeout, while the
  // intentionally delayed animation has not reported its first frame yet.
  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-page-index', '1')
  await expect(text.locator('[data-page-flip="running"]')).toHaveCount(1)
  await expect(text.locator('[data-page-flip="settled"]')).toHaveCount(1, { timeout: 4000 })

  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(page.locator('.mainline-scene--map-only')).toHaveAttribute('data-fixture-page-index', '2')
})

test('overflowing observation completes typing before it advances to the next fitted page', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/e2e/fixtures/reading-layout-transition.html')
  await page.locator('[data-reading-type-overflow]').click()

  const root = page.locator('.mainline-scene--map-only')
  const text = page.locator('.scene-mainline-text[data-scene-echo]')
  await expect(text).toBeVisible()
  await expect.poll(async () => Number(await text.getAttribute('data-scene-segment-count'))).toBeGreaterThan(1)
  await expect(text).toHaveAttribute('data-scene-observation-typing', 'true')
  await expect(text).toHaveAttribute('data-scene-reading-page-index', '0')

  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(text).toHaveAttribute('data-scene-observation-typing', 'false')
  await expect(root).toHaveAttribute('data-fixture-page-index', '0')
  await expect(text).toHaveAttribute('data-scene-reading-page-index', '0')

  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(text).toHaveAttribute('data-scene-reading-page-index', '1')
  await expect(text.locator('[data-page-flip="settled"]')).toHaveCount(1, { timeout: 1500 })
})

test('explicit leave remains available while a page flip is running', async ({ page }) => {
  await page.setViewportSize({ width: 411, height: 914 })
  await page.goto('/e2e/fixtures/reading-layout-transition.html')
  await page.locator('[data-reading-start]').click()
  const text = page.locator('.scene-mainline-text[data-scene-echo]')
  await page.locator('[data-scene-dialogue-shield]').evaluate(element => (element as HTMLButtonElement).click())
  await expect(text.locator('[data-page-flip="running"]')).toHaveCount(1)
  await page.locator('[data-reading-leave]').click()
  await expect(text).toHaveClass(/is-leaving/)
})

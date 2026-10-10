import { expect, test } from '@playwright/test'

const scenes = ['jijia-ancestral-home', 'jijia-ancestral-interior', 'zhongshuyuan-office', 'commercial-street']
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`all registered frame types surround their characters at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    for (const scene of scenes) {
      await page.goto(`/?scene=${scene}`)
      await expect(page.locator('.mainline-scene-stage')).toBeVisible()
      await expect.poll(() => page.locator('.scene-focus-frame[data-focus-frame-phase="visible"]').count()).toBeGreaterThan(0)
      const measurements = await page.locator('.mainline-scene-stage').evaluate(stage => {
        return [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame[data-focus-frame-phase="visible"]')].map(frame => {
          const group = frame.dataset.focusFrameGroup
          const rects = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
            .filter(node => node.dataset.focusVisualGroup === group)
            .flatMap(node => { const range = document.createRange(); range.selectNodeContents(node); return [...range.getClientRects()] })
          if (!rects.length) throw new Error(`Frame ${group} has no character target`)
          const box = frame.getBoundingClientRect()
          const left = Math.min(...rects.map(rect => rect.left)), right = Math.max(...rects.map(rect => rect.right))
          const top = Math.min(...rects.map(rect => rect.top)), bottom = Math.max(...rects.map(rect => rect.bottom))
          return { group, gaps: [left - box.left, box.right - right, top - box.top, box.bottom - bottom], events: getComputedStyle(frame).pointerEvents }
        })
      })
      expect(measurements.length).toBeGreaterThan(0)
      for (const measured of measurements) {
        expect(measured.events).toBe('none')
        for (const gap of measured.gaps) expect(gap, `${scene}: ${measured.group} ${measured.gaps}`).toBeCloseTo(3, 0)
      }
      await info.attach(`${scene}-bounds`, { body: JSON.stringify(measurements), contentType: 'application/json' })
      await page.screenshot({ path: info.outputPath(`${scene}.png`) })
    }
  })
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`visual frames remeasure character length, font size and writing mode at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?scene=commercial-street')
    const group = await page.locator('.scene-focus-frame[data-focus-frame-phase="visible"]').first().getAttribute('data-focus-frame-group')
    for (const mode of ['horizontal-tb', 'vertical-rl']) {
      for (const text of ['窗', '公共汽车']) {
        await page.locator('[data-focus-visual-group]').evaluateAll((nodes, options) => {
          const node = nodes.find(node => (node as HTMLElement).dataset.focusVisualGroup === options.group) as HTMLElement
          node.textContent = options.text
          node.style.writingMode = options.mode
          node.style.fontSize = '22px'
        }, { group, text, mode })
        await expect.poll(() => page.locator('.mainline-scene-stage').evaluate((stage, group) => {
          const node = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')].find(node => node.dataset.focusVisualGroup === group)!
          const frame = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame')].find(node => node.dataset.focusFrameGroup === group)!
          const range = document.createRange(); range.selectNodeContents(node)
          const text = range.getBoundingClientRect(), box = frame.getBoundingClientRect()
          return Math.max(...[text.left - box.left, box.right - text.right, text.top - box.top, box.bottom - text.bottom].map(gap => Math.abs(gap - 3)))
        }, group)).toBeLessThan(.5)
      }
    }
  })
}

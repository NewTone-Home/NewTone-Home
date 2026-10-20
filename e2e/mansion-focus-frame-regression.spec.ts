import { expect, test } from '@playwright/test'

test('ancestral yard door and scaled old tree retain measured focus frames', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?scene=jijia-ancestral-home')
  await page.evaluate(() => document.fonts.ready)

  for (const group of ['door:jijia-main-door', 'interactive:jijia-old-tree']) {
    const frame = page.locator(`.scene-focus-frame[data-focus-frame-group="${group}"]`)
    await expect(frame).toHaveAttribute('data-focus-frame-phase', 'visible')
    await expect(frame).toHaveCSS('visibility', 'visible')
    await expect.poll(() => frame.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const path = element.querySelector('path')!
      return rect.width > 8 && rect.height > 8
        && Number.parseFloat(getComputedStyle(path).strokeDashoffset) === 0
        && path.getAttribute('d')?.trim().endsWith('Z') === true
    }), { timeout: 5000 }).toBe(true)
  }

  const evidence = await page.evaluate(() => ['door:jijia-main-door', 'interactive:jijia-old-tree'].map(group => {
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')!
    const frame = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame')]
      .find(element => element.dataset.focusFrameGroup === group)!
    const target = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
      .find(element => element.dataset.focusVisualGroup === group)!
    const range = document.createRange()
    range.selectNodeContents(target)
    const text = range.getBoundingClientRect()
    const box = frame.getBoundingClientRect()
    const path = frame.querySelector('path')!
    return {
      group,
      phase: frame.dataset.focusFramePhase,
      visibility: getComputedStyle(frame).visibility,
      transform: getComputedStyle(target).transform,
      fontSize: getComputedStyle(target).fontSize,
      text: { left: text.left, top: text.top, width: text.width, height: text.height },
      frame: { left: box.left, top: box.top, width: box.width, height: box.height },
      margins: { left: text.left - box.left, top: text.top - box.top, right: box.right - text.right, bottom: box.bottom - text.bottom },
      strokeDashOffset: getComputedStyle(path).strokeDashoffset,
      closedPath: path.getAttribute('d')?.trim().endsWith('Z'),
    }
  }))
  expect(evidence.find(item => item.group === 'interactive:jijia-old-tree')?.transform).toContain('1.12')
  await testInfo.attach('mansion-shared-focus-frame-measurements', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
  console.log('[mansion-focus-frame-regression]', JSON.stringify(evidence))
  await page.screenshot({ path: testInfo.outputPath('mansion-door-and-scaled-tree-frames.png') })
})

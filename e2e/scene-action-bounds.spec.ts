import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 550 }]) {
  for (const edge of ['top', 'bottom'] as const) {
    test(`two long options stay in the current room at the ${edge} edge (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/e2e/fixtures/scene-action-bounds.html')
      if (edge === 'bottom') await page.locator('[data-action-edge="bottom"]').click()
      const action = page.locator('[data-scene-action="fixture-two-long-options"]')
      await expect(action).toBeVisible()
      await expect(action.locator('[data-entry-id^="scene-action:fixture-two-long-options:"]')).toHaveCount(2)
      await expect(action).toHaveAttribute('data-scene-action-overflow-y', /^(true|false)$/)
      const box = await action.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const node = element as HTMLElement
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
          measuredHeight: Number(node.dataset.sceneActionMeasuredHeight), maxHeight: Number(node.dataset.sceneActionMaxHeight),
          renderedY: Number(node.dataset.sceneActionRenderedY), sourceY: Number(node.dataset.sceneActionPositionY),
          overflow: node.dataset.sceneActionOverflowY === 'true', scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }
      })
      expect(box.x).toBeGreaterThanOrEqual(-1)
      expect(box.y).toBeGreaterThanOrEqual(-1)
      expect(box.right).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1)
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
      expect(box.renderedY).not.toBe(box.sourceY)
      expect(box.measuredHeight).toBeGreaterThan(0)
      if (box.overflow) expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
    })
  }
}

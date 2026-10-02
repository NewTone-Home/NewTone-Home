import { expect, test } from '@playwright/test'

test('Commercial Street renders six non-interactive pedestrians with staggered movement', async ({ page }, testInfo) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const pedestrians = page.locator('[data-npc-role="pedestrian"]')
  await expect(pedestrians).toHaveCount(6)
  await expect(pedestrians).toHaveText(['人', '人', '人', '人', '人', '人'])

  const initial = await pedestrians.evaluateAll((nodes) => nodes.map((node) => ({
    tagName: node.tagName,
    pointerEvents: getComputedStyle(node).pointerEvents,
    interactionTarget: node.getAttribute('data-interaction-target-entity-id'),
  })))
  expect(initial.every((npc) => npc.tagName === 'SPAN' && npc.pointerEvents === 'none' && npc.interactionTarget === null)).toBe(true)
  await expect(pedestrians.first()).toHaveAttribute('data-npc-phase', 'moving')
  await expect(pedestrians.last()).not.toHaveAttribute('data-npc-phase', 'moving')
  await page.screenshot({ path: testInfo.outputPath('commercial-street-ambient-pedestrians.png') })
})

import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1280, height: 720 }, { width: 411, height: 914 }]) {
  test(`formal dialogue stage is speaker-side and local at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    await page.goto('/e2e/fixtures/dialogue-stage-trial.html')
    await expect(page.locator('[data-dialogue-line-id="fixture-first-line"]')).toBeVisible()
    const dialogue = page.locator('[data-scene-dialogue]')
    await expect(dialogue).toHaveAttribute('data-dialogue-speaker', '修杰')
    await expect(page.locator('.scene-mainline-speaker-anchor')).toHaveCount(0)
    await expect(page.locator('.scene-dialogue-dimmer')).toHaveCSS('opacity', '0')
    await expect(page.locator('.scene-mainline-dialogue-stage-object.is-stage-faded').first()).toBeVisible()
    const protagonist = page.locator('[data-actor-id="protagonist"]')
    await expect(protagonist).toHaveCSS('filter', 'brightness(1)')
    await expect(page.locator('[data-npc-id="lao-zhou"]')).toHaveCSS('filter', 'brightness(0.5)')
    const bounds = await dialogue.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: info.outputPath(`dialogue-stage-${viewport.width}.png`) })
    await page.locator('[data-scene-dialogue-shield="true"]').click({ force: true })
    await expect(dialogue).toHaveAttribute('data-scene-dialogue-ready', 'true')
    await page.locator('[data-fixture-fast-skip]').click()
    await expect(dialogue).toHaveAttribute('data-dialogue-stage-handoff', 'true')
    await expect(dialogue).toHaveCSS('transition-duration', '0.3s')
    await page.screenshot({ path: info.outputPath(`dialogue-stage-handoff-${viewport.width}.png`) })
    await expect(page.locator('[data-dialogue-line-id="fixture-second-line"]')).toBeVisible({ timeout: 3_000 })
  })
}

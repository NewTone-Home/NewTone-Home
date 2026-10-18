import { expect, test } from '@playwright/test'

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile-390x844', width: 390, height: 844 },
]) {
  test(`production Preview boots the commercial street at ${viewport.name}`, async ({ page }, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.addInitScript(() => {
      localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
      localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'zh', hasInitializedLanguage: true }))
      localStorage.setItem('newtone-player-save-v1', JSON.stringify({
        _version: 1,
        currentSceneId: 'commercial-street',
        currentPosition: { x: 34, y: 50 },
        scenePositions: { 'commercial-street': { x: 34, y: 50 } },
        phoneDevice: 'surface',
        storyClock: { stage: 'commercial-street' },
        sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } },
        phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
      }))
    })
    await page.goto('/?scene=commercial-street')
    const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
    await expect(street).toBeVisible()
    await expect(street.locator('.mainline-scene-stage')).toBeVisible()
    await expect(street.locator('.scene-mainline-world')).toBeVisible()
    await expect(street.locator('[data-actor-id="protagonist"]')).toBeVisible()
    expect(pageErrors).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`commercial-preview-${viewport.name}.png`) })
  })
}

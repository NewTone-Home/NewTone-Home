import { expect, test } from '@playwright/test'
import { commercialStreetShopEntry, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'

const cafe = commercialStreetShops.find((shop) => shop.kind === 'cafe')!
const cafeEntry = commercialStreetShopEntry(cafe)
const middleTableId = 'commercial-cafe-right-inner-middle-group-table'

test('Cafe window, blackboard, and moving server text keep clear bounds', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1180, height: 757 })
  await page.addInitScript(({ startPoint }) => {
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'zh', hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-street',
      currentPosition: startPoint,
      scenePositions: { 'commercial-street': startPoint },
      phoneDevice: 'surface',
      storyClock: { stage: 'commercial-street' },
      sceneState: { 'commercial-street': { commercialStreetQuestionNarrativeCompleted: true } },
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
    }))
  }, { startPoint: cafeEntry.streetApproach })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  await expect(street).toBeVisible()
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior', { timeout: 30_000 })

  const windowCells = page.locator('[data-wall-id^="commercial-cafe-glass-front-"]')
  await expect(windowCells.first()).toBeVisible()
  const windowBoxes = await windowCells.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { text: node.textContent?.trim(), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
  }))
  expect(windowBoxes.length).toBeGreaterThan(8)
  expect(windowBoxes.every((box) => box.text === '窗')).toBe(true)

  const topWallBoxes = await page.locator('[data-wall-id^="commercial-cafe-room-top"]')
    .evaluateAll((nodes) => nodes.filter((node) => node.textContent?.trim() === '墙').map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
    }))
  for (const window of windowBoxes) for (const wall of topWallBoxes) {
    const overlapX = Math.min(window.right, wall.right) - Math.max(window.x, wall.x)
    const overlapY = Math.min(window.bottom, wall.bottom) - Math.max(window.y, wall.y)
    expect(overlapX <= 1 || overlapY <= 1, 'window glyph intersects top-wall glyph').toBe(true)
  }

  const blackboard = page.locator('[data-focus-target-group="interactive:commercial-cafe-blackboard-feature"]')
  await expect(blackboard).toBeVisible()
  const blackboardBox = await blackboard.boundingBox()
  expect(blackboardBox).not.toBeNull()
  for (const window of windowBoxes) {
    const overlapX = Math.min(window.right, blackboardBox!.x + blackboardBox!.width) - Math.max(window.x, blackboardBox!.x)
    const overlapY = Math.min(window.bottom, blackboardBox!.y + blackboardBox!.height) - Math.max(window.y, blackboardBox!.y)
    expect(overlapX <= 1 || overlapY <= 1, 'window glyph intersects blackboard').toBe(true)
  }

  const server = page.locator('[data-npc-id="cafe-floor-server"]')
  const serverText = server.locator(':scope > span')
  await expect(server).toBeVisible()
  await expect(server).toHaveAttribute('data-npc-target-id', middleTableId, { timeout: 30_000 })
  const tableLabels = page.locator(`[data-object-id^="commercial-cafe-right-inner-middle-group-"] .scene-mainline-object__label`)
  await expect(tableLabels.first()).toBeVisible()
  const sampledPositions = new Set<string>()
  let middleTableServiceSamples = 0
  for (let index = 0; index < 180; index++) {
    const serverBox = await serverText.boundingBox()
    expect(serverBox).not.toBeNull()
    const labelBoxes = await tableLabels.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
    }))
    for (const label of labelBoxes) {
      const gapX = Math.max(0, label.x - (serverBox!.x + serverBox!.width), serverBox!.x - label.right)
      const gapY = Math.max(0, label.y - (serverBox!.y + serverBox!.height), serverBox!.y - label.bottom)
      expect(gapX >= 8 || gapY >= 8, 'moving service text needs a readable gap from every table/chair label').toBe(true)
    }
    if (await server.getAttribute('data-npc-target-id') === middleTableId) middleTableServiceSamples += 1
    sampledPositions.add(`${Math.round(serverBox!.x)},${Math.round(serverBox!.y)}`)
    await page.waitForTimeout(150)
  }
  expect(sampledPositions.size).toBeGreaterThan(2)
  expect(middleTableServiceSamples).toBeGreaterThan(1)
  await page.screenshot({ path: testInfo.outputPath('commercial-cafe-1180x757.png') })
})

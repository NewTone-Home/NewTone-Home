import { expect, test } from '@playwright/test'
import { commercialStreetShopEntry, commercialStreetShops } from '../src/center/runtime/commercialStreetWorldLayout'

const cafe = commercialStreetShops.find((shop) => shop.kind === 'cafe')!
const cafeEntry = commercialStreetShopEntry(cafe)
const middleTableId = 'commercial-cafe-right-inner-middle-group-table'
const lowerTableId = 'commercial-cafe-right-window-lower-group-table'

function minimumTextGap(first: { x: number; y: number; right: number; bottom: number }, second: { x: number; y: number; right: number; bottom: number }) {
  const gapX = Math.max(0, second.x - first.right, first.x - second.right)
  const gapY = Math.max(0, second.y - first.bottom, first.y - second.bottom)
  return Math.max(gapX, gapY)
}

test('Cafe window, blackboard, and moving server text keep clear bounds', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1180, height: 757 })
  await page.addInitScript(({ startPoint }) => {
    if (sessionStorage.getItem('commercial-cafe-e2e-save-seeded') === 'true') return
    sessionStorage.setItem('commercial-cafe-e2e-save-seeded', 'true')
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
  const tableLabels = page.locator('[data-object-id^="commercial-cafe-right-"][data-object-id*="-group-"] .scene-mainline-object__label')
  const expectCurrentServiceSpacing = async () => {
    const serverBox = await serverText.boundingBox()
    expect(serverBox).not.toBeNull()
    const labelBoxes = await tableLabels.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
    }))
    expect(Math.min(...labelBoxes.map((label) => minimumTextGap({
      x: serverBox!.x,
      y: serverBox!.y,
      right: serverBox!.x + serverBox!.width,
      bottom: serverBox!.y + serverBox!.height,
    }, label)))).toBeGreaterThanOrEqual(12)
  }
  await expect(server).toBeVisible()
  await expect(tableLabels.first()).toBeVisible()
  await expectCurrentServiceSpacing()

  const sampledPositions = new Set<string>()
  const visitedTargets = new Set<string>()
  let startingTarget: string | null = null
  let completedRoundTrip = false
  for (let index = 0; index < 600; index++) {
    const serverBox = await serverText.boundingBox()
    expect(serverBox).not.toBeNull()
    const targetId = await server.getAttribute('data-npc-target-id')
    const labelBoxes = await tableLabels.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { text: node.textContent?.trim(), objectId: node.closest('[data-object-id]')?.getAttribute('data-object-id'), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
    }))
    for (const label of labelBoxes) {
      expect(minimumTextGap({
        x: serverBox!.x,
        y: serverBox!.y,
        right: serverBox!.x + serverBox!.width,
        bottom: serverBox!.y + serverBox!.height,
      }, label), `Cafe server target ${targetId}; nearby label ${label.text} (${label.objectId})`).toBeGreaterThanOrEqual(12)
    }
    if (targetId) {
      if (startingTarget === null) startingTarget = targetId
      visitedTargets.add(targetId)
      if (targetId === startingTarget && visitedTargets.has(middleTableId) && visitedTargets.has(lowerTableId) && index > 10) {
        completedRoundTrip = true
        break
      }
    }
    sampledPositions.add(`${Math.round(serverBox!.x)},${Math.round(serverBox!.y)}`)
    await page.waitForTimeout(150)
  }
  expect(sampledPositions.size).toBeGreaterThan(2)
  expect(visitedTargets.has(middleTableId)).toBe(true)
  expect(visitedTargets.has(lowerTableId)).toBe(true)
  expect(completedRoundTrip).toBe(true)

  const savedCafeStory = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-street'] ?? {}
  })
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(street).not.toHaveAttribute('data-active-display-region', 'commercial-cafe-interior', { timeout: 30_000 })
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior', { timeout: 30_000 })
  await expect(server).toBeVisible()
  await expectCurrentServiceSpacing()
  await expect.poll(() => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}')
    return save.sceneState?.['commercial-street'] ?? {}
  })).toEqual(savedCafeStory)

  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-street-east', { timeout: 30_000 })
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior', { timeout: 30_000 })
  await expect(server).toBeVisible()
  await expectCurrentServiceSpacing()
  await page.screenshot({ path: testInfo.outputPath('commercial-cafe-1180x757.png') })
})

test('Cafe floor server restores safely from an older save already inside the continuous world', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 757 })
  await page.addInitScript(() => {
    const resumePoint = { x: 166.5, y: 22 }
    localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
    localStorage.setItem('newtone-progress-v4', JSON.stringify({ _version: 4, language: 'zh', hasInitializedLanguage: true }))
    localStorage.setItem('newtone-player-save-v1', JSON.stringify({
      _version: 1,
      currentSceneId: 'commercial-street',
      currentPosition: resumePoint,
      scenePositions: { 'commercial-street': resumePoint },
      phoneDevice: 'surface',
      storyClock: { stage: 'commercial-street' },
      sceneState: {
        'commercial-street': {
          commercialStreetQuestionNarrativeCompleted: true,
          commercialCafeStoryStatus: 'available',
          commercialCafeNarrativeCursor: 4,
          commercialCafeCoffeeStatus: 'delivered',
          commercialCafeNarrativePhase: 'dialogue',
          commercialCafeLaoZhouDeparture: 'seated',
          commercialCafeCompletedAt: null,
        },
      },
      phoneNotifications: [], phoneNotes: [], phoneContactNotes: {}, phoneCallHistory: [], updatedAt: Date.now(),
    }))
  })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const street = page.locator('.scene-shell[data-mainline-scene="commercial-street"]')
  const server = page.locator('[data-npc-id="cafe-floor-server"]')
  const serverText = server.locator(':scope > span')
  const tableLabels = page.locator('[data-object-id^="commercial-cafe-right-"][data-object-id*="-group-"] .scene-mainline-object__label')
  await expect(street).toHaveAttribute('data-active-display-region', 'commercial-cafe-interior')
  await expect(server).toBeVisible()
  await expect(tableLabels.first()).toBeVisible()
  const serverBox = await serverText.boundingBox()
  expect(serverBox).not.toBeNull()
  const labelBoxes = await tableLabels.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
  }))
  expect(Math.min(...labelBoxes.map((label) => minimumTextGap({
    x: serverBox!.x,
    y: serverBox!.y,
    right: serverBox!.x + serverBox!.width,
    bottom: serverBox!.y + serverBox!.height,
  }, label)))).toBeGreaterThanOrEqual(12)
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('newtone-player-save-v1') ?? '{}').sceneState?.['commercial-street'] ?? {}
    return [state.commercialCafeStoryStatus, state.commercialCafeNarrativeCursor, state.commercialCafeCoffeeStatus, state.commercialCafeNarrativePhase]
  })).toEqual(['available', 4, 'delivered', 'dialogue'])
})

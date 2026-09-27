import { expect, test, type Page } from '@playwright/test'

const playerSaveKey = 'newtone-player-save-v1'

async function openWithSceneState(page: Page, sceneId: string, sceneState: Record<string, Record<string, boolean | number>>) {
  await page.goto(`/?scene=${sceneId}`)
  await page.evaluate(({ sceneId, sceneState, playerSaveKey }) => {
    localStorage.setItem(playerSaveKey, JSON.stringify({
      _version: 1,
      currentSceneId: sceneId,
      currentPosition: null,
      scenePositions: {},
      phoneDevice: 'surface',
      sceneState,
      updatedAt: 1,
    }))
  }, { sceneId, sceneState, playerSaveKey })
  await page.reload()
}

test('floor objects use their own persistent interaction state without exploration frames', async ({ page }) => {
  await page.goto('/?scene=jijia-ancestral-home')
  const tree = page.locator('[data-object-id="jijia-old-tree"]')

  await expect(tree).toHaveClass(/scene-mainline-interaction--tutorial-unexplored/)
  await expect(tree.locator('.scene-focus-frame')).toHaveCount(0)

  await tree.click()
  await expect(tree).toHaveClass(/scene-mainline-interaction--active/)

  await openWithSceneState(page, 'jijia-ancestral-home', {
    'jijia-ancestral-home': { 'interactionExplored:jijia-old-tree': true },
    'commercial-street': { interactionTutorialCompleted: true },
  })
  await expect(page.locator('[data-object-id="jijia-old-tree"]')).toHaveClass(/scene-mainline-interaction--explored/)
})

test('wall features retain their focus frame while sharing active and explored visual states', async ({ page }) => {
  await openWithSceneState(page, 'jijia-ancestral-interior', {
    'jijia-ancestral-interior': { 'interactionExplored:jijia-portrait-top-1': true },
    'commercial-street': { interactionTutorialCompleted: true },
  })

  const portrait = page.locator('[data-focus-target-group="interactive:jijia-portrait-top-1"]').first()
  await expect(portrait).toHaveClass(/scene-mainline-interaction--explored/)
  await expect(portrait.locator('.scene-focus-frame')).toHaveCount(1)

  await portrait.click()
  await expect(portrait).toHaveClass(/scene-mainline-interaction--active/)
  await expect(portrait.locator('.scene-focus-frame')).toHaveCount(1)
})

test('feedback-only objects settle into explored soft state instead of remaining active', async ({ page }) => {
  await openWithSceneState(page, 'commercial-cafe', {
    'commercial-street': { interactionTutorialCompleted: true },
  })

  const table = page.locator('[data-object-id="commercial-cafe-right-inner-middle-group-table"]')
  await table.click()
  await expect(table).toHaveClass(/scene-mainline-interaction--explored/, { timeout: 10_000 })
  await expect(table).not.toHaveClass(/scene-mainline-interaction--active/)
  await expect(table.locator('.scene-focus-frame')).toHaveCount(0)

  await table.click()
  await expect(table).toHaveClass(/scene-mainline-interaction--explored/, { timeout: 10_000 })

  const menu = page.getByRole('button', { name: '菜单' })
  await menu.click()
  await expect(menu).toHaveClass(/scene-mainline-interaction--explored/, { timeout: 10_000 })
  await expect(menu.locator('.scene-focus-frame')).toHaveCount(1)
})

test('altar breathing stays narrow and burning incense remains above explored soft', async ({ page }) => {
  await openWithSceneState(page, 'jijia-ancestral-interior', {
    'jijia-ancestral-interior': { incenseLitAt: Date.now(), 'interactionExplored:jijia-incense-burner': true },
  })

  const incense = page.locator('[data-object-id="jijia-incense-burner"]')
  await expect(incense).toHaveClass(/scene-mainline-incense--burning/)
  await expect(incense).toHaveClass(/scene-mainline-interaction--explored/)
  const incenseColor = await incense.evaluate((element) => getComputedStyle(element).color)
  const offeringTable = page.locator('[data-object-id="jijia-offering-table-north"]')
  const samples = await offeringTable.locator('span').evaluate(async (element) => {
    const values: number[] = []
    for (let index = 0; index < 9; index += 1) {
      values.push(Number(getComputedStyle(element).opacity))
      for (let frame = 0; frame < 21; frame += 1) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      }
    }
    return values
  })
  expect(Math.min(...samples)).toBeGreaterThanOrEqual(.85)
  expect(Math.max(...samples)).toBeLessThanOrEqual(1)

  await openWithSceneState(page, 'jijia-ancestral-interior', {
    'jijia-ancestral-interior': { 'interactionExplored:jijia-incense-burner': true },
  })
  const exploredColor = await page.locator('[data-object-id="jijia-incense-burner"]').evaluate((element) => getComputedStyle(element).color)
  expect(incenseColor).not.toBe(exploredColor)
})

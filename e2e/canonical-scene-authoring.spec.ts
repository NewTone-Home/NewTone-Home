import { expect, test } from '@playwright/test'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

function captureConsole(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('the portal-owned yard gate retains its split label while the old tree remains interactive', async ({ page }) => {
  const errors = captureConsole(page)
  await page.goto('/?scene=jijia-ancestral-home')
  const gateCells = page.getByRole('button', { name: /^院门，点击门后目标会在接近时自动开门并穿过/ })
  await expect(gateCells).toHaveCount(2)
  expect((await gateCells.allInnerTexts()).sort()).toEqual(['院', '门'].sort())

  await page.locator('[data-object-id="jijia-old-tree"]').click()
  await expect(page.locator('[data-scene-echo="jijia-old-tree"]')).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('the office secret door retains one passage identity in both directions', async ({ page }) => {
  const errors = captureConsole(page)
  const secretDoor = mainlineScenes['zhongshuyuan-passage'].passages.find((passage) => passage.targetSceneId === 'zhongshuyuan-office')!
  await page.goto(`/?scene=zhongshuyuan-passage&entryX=${secretDoor.thresholds[0].x}&entryY=${secretDoor.thresholds[0].y}`)

  const passageDoor = page.locator('[data-focus-target-group="door:zhongshuyuan-office-secret-door"]').first()
  await expect(passageDoor).toBeVisible()
  await passageDoor.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-office"]')).toBeVisible({ timeout: 15_000 })

  const officeDoor = page.locator('[data-focus-target-group="door:zhongshuyuan-office-secret-door"]').first()
  await expect(officeDoor).toBeVisible()
  await officeDoor.click()
  await expect(page.locator('.scene-shell[data-mainline-scene="zhongshuyuan-passage"]')).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

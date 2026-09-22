import { expect, test } from '@playwright/test'

async function advanceDialogue(page: import('@playwright/test').Page, maximumAdvances: number) {
  const dialogue = page.locator('[data-scene-dialogue]').first()
  for (let index = 0; index < maximumAdvances; index += 1) {
    if (await dialogue.count() === 0) return
    await dialogue.click({ force: true })
  }
  await expect(dialogue).toHaveCount(0)
}

test('isolated café fixture keeps stage in memory and proves presentation lifecycle', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1')
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(0)
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
  await expect(page.getByLabel('修杰，已坐下')).toBeVisible()
  await page.screenshot({ path: 'test-results/cafe-coffee-delivered.png', fullPage: true })
})

test('fresh isolated cafe orders coffee through a physical counter segment and persists the stage only after choice', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  const orderChoice = page.getByRole('button', { name: '点一杯咖啡' })
  await expect(orderChoice).toBeVisible({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await orderChoice.click()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
})

test('an isolated real save retains coffee order after browser reload without touching a user profile', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'entered')
  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await page.getByRole('button', { name: '点一杯咖啡' }).click({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
  await page.reload()
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')
})

test('server begins an ambient semantic duty without a debug control and settles before story delivery', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.prepare')
  await expect(scene).toHaveAttribute('data-commercial-cafe-server-behavior', 'ambient-waiting', { timeout: 30_000 })
  await expect(server).toHaveAttribute('data-npc-phase', 'idle')
})

test('fresh isolated player completes the authored cafe story through dialogue, delivery, props, and resolution', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const scene = page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()

  await page.locator('[data-object-id="commercial-cafe-counter"]').click()
  await page.getByRole('button', { name: '点一杯咖啡' }).click({ timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-ordered')

  await page.locator('[data-npc-id="lao-zhou"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-lao-zhou-seat-guide', { timeout: 30_000 })
  await advanceDialogue(page, 4)

  await page.locator('[data-object-id="commercial-cafe-right-window-upper-group-chair-bottom"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-lao-zhou-first-xiujie', { timeout: 30_000 })
  await advanceDialogue(page, 8)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'met-lao-zhou')

  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await page.locator('[data-attached-prop-id="commercial-cafe-coffee"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-coffee-xiujie')
  await advanceDialogue(page, 40)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'intel-received')

  await page.locator('[data-npc-id="lao-zhou"]').click()
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-resolution-xiujie')
  await advanceDialogue(page, 12)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(1)
})

test('ready-to-leave café exits through the authored passage rather than completing on dialogue alone', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=ready-to-leave')
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-street"]').first()).toBeVisible({ timeout: 30_000 })
})

test('debug stage never uses the player save and resolves old prototype information in the shared dialogue surface', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1')
  await page.locator('[data-attached-prop-id="commercial-cafe-coffee"]').click()
  await expect(page.getByText('你还是不爱喝咖啡')).toBeVisible()
  await advanceDialogue(page, 40)
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'intel-received')
  await page.locator('[data-npc-id="lao-zhou"]').click({ force: true })
  await expect(page.locator('[data-scene-dialogue]')).toHaveAttribute('data-dialogue-line-id', 'commercial-cafe-resolution-xiujie')
  await advanceDialogue(page, 12)
  await expect(page.locator('[data-mainline-scene="commercial-cafe"]').first()).toHaveAttribute('data-commercial-cafe-stage', 'ready-to-leave')
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(0)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-empty-cup"]')).toHaveCount(1)
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-banknote"]')).toHaveCount(1)
})

test('met Lao Zhou starts one real server delivery, reveals coffee on arrival, then returns through shared movement', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/?scene=commercial-cafe&debugCafeStage=met-lao-zhou&debugCafeFixture=1')
  await page.bringToFront()
  const scene = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const server = page.locator('[data-npc-id="server"]')
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.deliver-coffee')
  const serverAdvanced = await page.evaluate(async () => {
    const server = document.querySelector('[data-npc-id="server"]')
    const before = server?.getAttribute('style')
    await new Promise<void>((resolve) => {
      let frames = 0
      const next = () => {
        frames += 1
        if (frames >= 12) resolve()
        else requestAnimationFrame(next)
      }
      requestAnimationFrame(next)
    })
    return { before, after: server?.getAttribute('style') }
  })
  expect(pageErrors).toEqual([])
  expect(serverAdvanced.after).not.toBe(serverAdvanced.before)
  await expect(scene).toHaveAttribute('data-commercial-cafe-stage', 'coffee-delivered', { timeout: 30_000 })
  await expect(page.locator('[data-attached-prop-id="commercial-cafe-coffee"]')).toHaveCount(1)
  await expect(server).toHaveAttribute('data-npc-duty-id', 'server.return-to-counter', { timeout: 30_000 })
  await expect(scene).toHaveAttribute('data-commercial-cafe-server-behavior', 'complete', { timeout: 30_000 })
  await expect(server).toHaveAttribute('data-npc-phase', 'idle')
})

test('isolated browser executes animation frames used by shared actor locomotion', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=entered')
  const frameTime = await page.evaluate(() => new Promise<number>((resolve) => requestAnimationFrame(resolve)))
  expect(frameTime).toBeGreaterThan(0)
})

test('debug harness click stays inside its control and cannot bubble into scene walking', async ({ page }) => {
  await page.goto('/?scene=commercial-cafe&debugCafeStage=coffee-delivered&debugCafeFixture=1&debugNpcMovement=1')
  const seatedProtagonist = page.getByLabel('修杰，已坐下')
  await expect(seatedProtagonist).toHaveCount(1)
  await page.getByRole('button', { name: '演示店员移动' }).dispatchEvent('click')
  await expect(seatedProtagonist).toHaveCount(1)
  await expect(page.locator('.scene-protagonist__dot')).toHaveCount(0)
})

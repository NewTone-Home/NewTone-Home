import { expect, test } from '@playwright/test'

test.use({ hasTouch: true })

type RuntimePoint = { x: string | null; y: string | null }

async function runtimePosition(locator: import('@playwright/test').Locator): Promise<RuntimePoint> {
  return {
    x: await locator.getAttribute('data-runtime-x'),
    y: await locator.getAttribute('data-runtime-y'),
  }
}

async function waitForFrames(page: import('@playwright/test').Page, count = 3) {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
  }, count)
}

test('voluntary Feedback owns mouse, pointer, and touch input until it closes', async ({ page }, testInfo) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const stage = page.locator('.mainline-scene-stage').first()
  const beforeFeedback = await runtimePosition(protagonist)

  await page.getByLabel('打开手机').click()
  await page.getByRole('button', { name: '反馈' }).click()
  const form = page.locator('form.world-phone__feedback')
  const textarea = page.getByLabel('自定义反馈')
  const submit = page.getByRole('button', { name: '提交反馈' })
  await expect(form).toBeVisible()
  await expect(submit).toBeEnabled()

  const formBox = await form.boundingBox()
  const textareaBox = await textarea.boundingBox()
  expect(formBox).not.toBeNull()
  expect(textareaBox).not.toBeNull()
  await page.mouse.click(formBox!.x + 3, formBox!.y + 3)
  await page.touchscreen.tap(textareaBox!.x + textareaBox!.width / 2, textareaBox!.y + textareaBox!.height / 2)
  await textarea.fill('输入仍属于反馈界面。')
  await waitForFrames(page)
  expect(await runtimePosition(protagonist)).toEqual(beforeFeedback)
  await page.screenshot({ path: testInfo.outputPath('feedback-overlay-input-guard.png') })

  await page.getByLabel('收起手机').click()
  const stageBox = await stage.boundingBox()
  expect(stageBox).not.toBeNull()
  await page.mouse.click(stageBox!.x + stageBox!.width * .62, stageBox!.y + stageBox!.height * .5)
  await waitForFrames(page, 36)
  expect(await runtimePosition(protagonist)).not.toEqual(beforeFeedback)
})

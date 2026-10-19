import { expect, test } from '@playwright/test'

test('real stage clicks keep west-to-east movement reachable at 1180x757', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 757 })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const actor = page.locator('[data-actor-id="protagonist"]')
  await expect(stage).toBeVisible()
  await expect(actor).toBeVisible()

  const diagnostics: Array<Record<string, unknown>> = []
  for (const click of [{ x: 400, y: 378 }, { x: 650, y: 378 }, { x: 500, y: 325 }]) {
    const before = await actor.evaluate(element => ({
      x: Number((element as HTMLElement).dataset.runtimeX),
      y: Number((element as HTMLElement).dataset.runtimeY),
    }))
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y)
      const stageElement = document.querySelector<HTMLElement>('.mainline-scene-stage')!
      const rect = stageElement.getBoundingClientRect()
      const cameraX = Number(stageElement.dataset.cameraOffsetX ?? 0)
      const cameraY = Number(stageElement.dataset.cameraOffsetY ?? 0)
      return {
        hit: element?.tagName.toLowerCase(),
        stage: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        mapped: { x: ((x - rect.left) / rect.width) * 100 - cameraX, y: ((y - rect.top) / rect.height) * 100 - cameraY },
      }
    }, click)
    await page.mouse.click(click.x, click.y)
    if (diagnostics.length > 0) await expect(actor).toHaveClass(/is-moving/, { timeout: 5_000 })
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 20_000 })
    const after = await actor.evaluate(element => ({
      x: Number((element as HTMLElement).dataset.runtimeX),
      y: Number((element as HTMLElement).dataset.runtimeY),
    }))
    diagnostics.push({ click, before, ...hit, after })
  }

  await test.info().attach('1180x757-click-diagnostics', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  })
  console.log('1180x757 click diagnostics', JSON.stringify(diagnostics))
  expect(diagnostics[1]!.after).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
  expect((diagnostics[1]!.after as { x: number }).x).toBeGreaterThan((diagnostics[0]!.after as { x: number }).x + 5)
  expect((diagnostics[1]!.after as { x: number }).x).toBeGreaterThan(45)
  expect((diagnostics[2]!.after as { y: number }).y).toBeLessThan((diagnostics[1]!.after as { y: number }).y - 1)
})

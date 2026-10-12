import { expect, test, type Page, type TestInfo } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1280, height: 720, expectedScale: 1 },
  { name: 'tablet', width: 834, height: 1194, expectedScale: 1 },
  { name: 'phone-390x844', width: 390, height: 844, expectedScale: 0.8 },
] as const

const scenes = [
  { id: 'zhongshuyuan-office', query: '' },
  { id: 'commercial-cafe', query: '' },
] as const

async function openScene(page: Page, sceneId: string, query: string, debugInput = false) {
  const debug = `&debugRuntimeEvidence=1${debugInput ? '&debugInput=1' : ''}`
  await page.goto(`/?scene=${sceneId}${query}${debug}`)
  const stage = page.locator(`.mainline-scene-stage[data-mainline-scene="${sceneId}"]`)
  await expect(stage).toBeVisible()
  await expect(stage.locator('[data-actor-id="protagonist"]')).toBeVisible()
  return stage
}

test('office and cafe keep the designed world stable across desktop, tablet, and phone viewports', async ({ page }, testInfo: TestInfo) => {
  const screenshotEvidence: Array<Record<string, unknown>> = []
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const scene of scenes) {
      const stage = await openScene(page, scene.id, scene.query)
      await expect(stage).toHaveAttribute('data-camera-scale', String(viewport.expectedScale))
      await expect(stage.locator('xpath=..')).not.toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
      await expect(stage.locator('.scene-protagonist__dot')).toBeVisible()
      const screenshotPath = testInfo.outputPath(`viewport-${viewport.name}-${scene.id}.png`)
      await page.screenshot({ path: screenshotPath, animations: 'disabled' })
      await testInfo.attach(`${viewport.name}-${scene.id}`, { path: screenshotPath, contentType: 'image/png' })
      screenshotEvidence.push(await stage.evaluate((element, label) => {
        const actor = element.querySelector<HTMLElement>('[data-actor-id="protagonist"]')!
        const actorRect = actor.getBoundingClientRect()
        const stageRect = element.getBoundingClientRect()
        const style = getComputedStyle(actor)
        return {
          label,
          runtimePosition: { x: Number(actor.dataset.runtimeX), y: Number(actor.dataset.runtimeY) },
          renderedPosition: { x: Number(actor.dataset.renderedX), y: Number(actor.dataset.renderedY) },
          actorRect: { left: actorRect.left, top: actorRect.top, width: actorRect.width, height: actorRect.height },
          stageRect: { left: stageRect.left, top: stageRect.top, width: stageRect.width, height: stageRect.height },
          actorVisible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && actorRect.right > stageRect.left && actorRect.left < stageRect.right && actorRect.bottom > stageRect.top && actorRect.top < stageRect.bottom,
          camera: { scale: Number(element.dataset.cameraScale), offsetX: Number(element.dataset.cameraOffsetX), offsetY: Number(element.dataset.cameraOffsetY) },
        }
      }, `${viewport.name}/${scene.id}`))

      if (viewport.name !== 'phone-390x844') continue
      await openScene(page, scene.id, scene.query, true)
      const bounds = await stage.boundingBox()
      expect(bounds).not.toBeNull()
      const clickPoint = await stage.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const candidates = [[.75, .63], [.78, .52], [.68, .63], [.82, .4], [.6, .7]]
        for (const [x, y] of candidates) {
          const clientX = bounds.left + bounds.width * x
          const clientY = bounds.top + bounds.height * y
          const hit = document.elementFromPoint(clientX, clientY)
          if (hit?.closest('.scene-mainline-world') && !hit.closest('button')) return { x: clientX, y: clientY }
        }
        return null
      })
      expect(clickPoint, 'expected an open floor point for real walking input').not.toBeNull()
      const actor = stage.locator('.scene-protagonist')
      await expect(actor.locator('.scene-protagonist__dot')).toBeVisible()
      const before = await actor.evaluate((element) => ({
        x: Number(element.getAttribute('data-runtime-x')),
        y: Number(element.getAttribute('data-runtime-y')),
        cameraX: Number(element.closest('.mainline-scene-stage')?.getAttribute('data-camera-offset-x')),
      }))
      const expected = await stage.evaluate((element, point) => {
        const world = element.querySelector<HTMLElement>('.scene-mainline-world')!
        const rect = element.getBoundingClientRect()
        const scale = Number(element.dataset.cameraScale)
        const offsetX = Number(element.dataset.cameraOffsetX)
        const offsetY = Number(element.dataset.cameraOffsetY)
        const width = Number.parseFloat(world.style.width)
        const height = Number.parseFloat(world.style.height)
        return {
          x: ((point.x - rect.left) / width * 100 - offsetX) / scale,
          y: ((point.y - rect.top) / height * 100 - offsetY) / scale,
        }
      }, clickPoint!)
      await page.mouse.click(clickPoint!.x, clickPoint!.y)
      await expect.poll(() => stage.getAttribute('data-input-mapped-x')).not.toBeNull()
      expect(Math.abs(Number(await stage.getAttribute('data-input-mapped-x')) - expected.x)).toBeLessThan(0.25)
      expect(Math.abs(Number(await stage.getAttribute('data-input-mapped-y')) - expected.y)).toBeLessThan(0.25)
      await expect(stage.locator('.scene-mainline-world')).toHaveCSS('transform', /matrix\(0\.8/)
      await expect.poll(async () => actor.evaluate((element) => ({
        x: Number(element.getAttribute('data-runtime-x')),
        y: Number(element.getAttribute('data-runtime-y')),
      })), { timeout: 20_000 }).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
      await expect.poll(async () => actor.evaluate((element, start) => {
        const dx = Number(element.getAttribute('data-runtime-x')) - start.x
        const dy = Number(element.getAttribute('data-runtime-y')) - start.y
        return Math.hypot(dx, dy)
      }, before), { timeout: 20_000 }).toBeGreaterThan(0.5)
      await expect.poll(async () => Number(await stage.getAttribute('data-camera-offset-x')), { timeout: 20_000 }).not.toBe(before.cameraX)
      await expect(actor.locator('.scene-protagonist__dot')).toBeVisible()
      await expect(actor).toBeInViewport()
      const movedEvidence = await stage.evaluate((element) => {
        const actor = element.querySelector<HTMLElement>('.scene-protagonist')!
        const rect = actor.getBoundingClientRect()
        const stageRect = element.getBoundingClientRect()
        return {
          position: { x: Number(actor.dataset.runtimeX), y: Number(actor.dataset.runtimeY) },
          actorScreenRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          stageRect: { width: stageRect.width, height: stageRect.height },
          camera: { scale: Number(element.dataset.cameraScale), offsetX: Number(element.dataset.cameraOffsetX), offsetY: Number(element.dataset.cameraOffsetY) },
        }
      })
      console.log(`real phone movement evidence ${scene.id}: ${JSON.stringify({ before, mappedClick: expected, after: movedEvidence })}`)
      await testInfo.attach('cafe-phone-real-movement.json', { body: JSON.stringify({ before, mappedClick: expected, after: movedEvidence }, null, 2), contentType: 'application/json' })
      const playableScreenshot = testInfo.outputPath('viewport-phone-390x844-commercial-cafe-playable.png')
      await page.screenshot({ path: playableScreenshot, animations: 'disabled' })
      await testInfo.attach('phone-390x844-commercial-cafe-playable', { path: playableScreenshot, contentType: 'image/png' })
      await page.setViewportSize({ width: 844, height: 390 })
      await expect(stage).toHaveAttribute('data-camera-scale', '1')
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(stage).toHaveAttribute('data-camera-scale', '0.8')
    }
  }
  console.log(`initial player viewport evidence: ${JSON.stringify(screenshotEvidence)}`)
  await testInfo.attach('initial-player-viewport-evidence.json', { body: JSON.stringify(screenshotEvidence, null, 2), contentType: 'application/json' })
})

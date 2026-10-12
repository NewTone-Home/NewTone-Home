import { expect, test, type Page, type TestInfo } from '@playwright/test'

const viewports = [
  { name: 'desktop', width: 1280, height: 720, expectedScale: 1 },
  { name: 'tablet', width: 834, height: 1194, expectedScale: 1 },
  { name: 'phone-390x844', width: 390, height: 844, expectedScale: 0.8 },
] as const

const scenes = [
  { id: 'zhongshuyuan-office', query: '' },
  { id: 'commercial-cafe', query: '&debugCafeFixture=1' },
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
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const scene of scenes) {
      const stage = await openScene(page, scene.id, scene.query)
      await expect(stage).toHaveAttribute('data-camera-scale', String(viewport.expectedScale))
      await expect(stage.locator('xpath=..')).not.toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
      const screenshotPath = testInfo.outputPath(`viewport-${viewport.name}-${scene.id}.png`)
      await page.screenshot({ path: screenshotPath, animations: 'disabled' })
      await testInfo.attach(`${viewport.name}-${scene.id}`, { path: screenshotPath, contentType: 'image/png' })

      if (viewport.name !== 'phone-390x844') continue
      await openScene(page, scene.id, scene.query, true)
      const bounds = await stage.boundingBox()
      expect(bounds).not.toBeNull()
      const clientX = bounds!.x + bounds!.width * 0.72
      const clientY = bounds!.y + bounds!.height * 0.35
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
      }, { x: clientX, y: clientY })
      await page.mouse.click(clientX, clientY)
      await expect.poll(() => stage.getAttribute('data-input-mapped-x')).not.toBeNull()
      expect(Math.abs(Number(await stage.getAttribute('data-input-mapped-x')) - expected.x)).toBeLessThan(0.1)
      expect(Math.abs(Number(await stage.getAttribute('data-input-mapped-y')) - expected.y)).toBeLessThan(0.1)
      await expect(stage.locator('.scene-mainline-world')).toHaveCSS('transform', /matrix\(0\.8/)
      await page.setViewportSize({ width: 844, height: 390 })
      await expect(stage).toHaveAttribute('data-camera-scale', '1')
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(stage).toHaveAttribute('data-camera-scale', '0.8')
    }
  }
})

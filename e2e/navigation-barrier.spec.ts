import { expect, test } from '@playwright/test'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineNavigationBarriers } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

type RuntimePoint = { x: number; y: number }

function pointFromActor(locator: import('@playwright/test').Locator): Promise<RuntimePoint> {
  return locator.evaluate((node) => ({
    x: Number(node.getAttribute('data-runtime-x')),
    y: Number(node.getAttribute('data-runtime-y')),
  }))
}

test('relation barrier blocks a real protagonist gap crossing without creating an occupied gap', async ({ page }, testInfo) => {
  const cafe = mainlineScenes['commercial-cafe']
  const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
  const table = snapshot.objects.get('commercial-cafe-right-window-upper-group-table')!
  const topChair = snapshot.objects.get('commercial-cafe-right-window-upper-group-chair-top')!
  const barrier = mainlineNavigationBarriers(cafe).find((candidate) => candidate.id === 'commercial-cafe-right-window-upper-group-chair-top-table-barrier')!
  const dot = mainlineProtagonistDotFootprint(cafe.initialPlayerPosition)
  const start = {
    x: table.position.x,
    y: (topChair.collision!.y + topChair.collision!.height + dot.height / 2 + barrier.start.y) / 2,
  }
  const destination = {
    x: table.position.x,
    y: (barrier.start.y + table.collision!.y - dot.height / 2) / 2,
  }
  await page.goto(`/?scene=commercial-cafe&debugCafeStage=entered&debugRuntimeEvidence=1&debugCafePlayerPosition=${start.x},${start.y}`)
  const stage = page.locator('[data-mainline-scene="commercial-cafe"]').first()
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  await expect(protagonist).toHaveAttribute('data-runtime-x', `${start.x}`)
  await expect(protagonist).toHaveAttribute('data-runtime-y', `${start.y}`)
  const bounds = await stage.boundingBox()
  expect(bounds).not.toBeNull()
  const camera = {
    x: Number(await stage.getAttribute('data-camera-offset-x')),
    y: Number(await stage.getAttribute('data-camera-offset-y')),
  }
  const route = page.evaluate(async () => {
    const positions: RuntimePoint[] = []
    for (let frame = 0; frame < 180; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      positions.push({ x: Number(actor?.dataset.runtimeX), y: Number(actor?.dataset.runtimeY) })
    }
    return positions
  })
  await stage.click({ position: {
    x: bounds!.width * ((destination.x + camera.x) / 100),
    y: bounds!.height * ((destination.y + camera.y) / 100),
  } })
  const positions = await route
  const finalPosition = await pointFromActor(protagonist)

  expect(finalPosition.y).toBeGreaterThan(barrier.start.y)
  expect(positions.some((point) => Math.abs(point.x - start.x) > dot.width / 4)).toBe(true)
  await testInfo.attach('navigation-barrier-route-evidence', {
    body: JSON.stringify({ camera, start, destination, barrier, finalPosition, positions }),
    contentType: 'application/json',
  })
  await page.screenshot({ path: testInfo.outputPath('commercial-cafe-navigation-barrier.png'), fullPage: true })
})

import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

test('commercial-street counter-scaled visuals stay centered on projected DOM anchors', async ({ page }) => {
  const stylesheet = await readFile(new URL('../src/center/runtime/scene.css', import.meta.url), 'utf8')
  await page.setViewportSize({ width: 390, height: 560 })
  await page.setContent(`<!doctype html>
    <html><head><style>${stylesheet}</style></head><body style="margin:0">
      <div id="stage" style="position:relative;width:390px;height:560px;overflow:hidden">
        <div class="scene-mainline-world" data-commercial-street-grid="equal-pitch"
          style="transform:translate(-127.66%, 0%) scaleX(2.553);transform-origin:50% 50%;--scene-horizontal-grid-counter-scale:.3917">
          <button class="scene-object scene-mainline-object" data-test="object"
            style="position:absolute;left:100%;top:50%;width:40px;height:20px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center">
            <span class="scene-mainline-object__grid-content"><span data-scene-characters="true">门</span></span>
          </button>
          <div class="scene-protagonist" data-test="actor" style="left:100%;top:50%">
            <span class="scene-protagonist__grid-content"><span class="scene-protagonist__dot"></span></span>
          </div>
        </div>
      </div>
    </body></html>`)

  const centers = await page.evaluate(() => {
    const stage = document.querySelector('#stage')!.getBoundingClientRect()
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return { centerX: rect.left + rect.width / 2, width: rect.width }
    }
    return {
      object: box('[data-test="object"]'),
      objectVisual: box('[data-test="object"] .scene-mainline-object__grid-content'),
      actor: box('[data-test="actor"]'),
      actorVisual: box('[data-test="actor"] .scene-protagonist__grid-content'),
      stageCenterX: stage.width / 2,
    }
  })

  expect(centers.object.centerX).toBeCloseTo(centers.stageCenterX, 1)
  expect(centers.objectVisual.centerX).toBeCloseTo(centers.stageCenterX, 1)
  expect(centers.actor.centerX).toBeCloseTo(centers.stageCenterX, 1)
  expect(centers.actorVisual.centerX).toBeCloseTo(centers.stageCenterX, 1)
  expect(centers.objectVisual.width).toBeLessThan(centers.object.width)
})

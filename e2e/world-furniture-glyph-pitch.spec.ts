import { expect, test } from '@playwright/test'

const scenes = [
  { id: 'jijia-ancestral-interior', required: ['jijia-offering-table-north', 'jijia-offering-table-east', 'jijia-incense-burner'] },
  { id: 'zhongshuyuan-office', required: ['zhongshuyuan-office-desk', 'zhongshuyuan-office-chair', 'zhongshuyuan-office-rack'] },
  { id: 'commercial-cafe', required: [] }, // Explicitly the compatibility definition, not continuous Cafe QA.
]

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const scene of scenes) {
    test(`${scene.id} furniture has 16-unit DOM glyph pitch at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
      await page.setViewportSize(viewport)
      // Isolated fixture only. No user browser profile or persisted save is accessed.
      await page.addInitScript(id => {
        localStorage.setItem('newtone-public-release-cutover-v1', 'center-v1')
        localStorage.setItem('newtone-player-save-v1', JSON.stringify({
          _version: 2, currentSceneId: id, currentPosition: null,
          scenePositions: {}, phoneDevice: 'inner', sceneState: {},
        }))
      }, scene.id)
      await page.goto(`/?scene=${scene.id}`)
      await expect(page.locator(`.mainline-scene-stage[data-mainline-scene="${scene.id}"]`)).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const measurements = await page.evaluate(() => {
        const world = document.querySelector<HTMLElement>('.scene-mainline-world')!
        const scale = world.getBoundingClientRect().width / world.offsetWidth
        return [...world.querySelectorAll<HTMLElement>([
          '.scene-mainline-object--fixture .scene-mainline-object__label',
          '.scene-mainline-object--table .scene-mainline-object__label',
          '.scene-mainline-object--seat .scene-mainline-object__label',
        ].join(','))].flatMap(label => {
          const centers: { x: number; y: number }[] = []
          const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
          let node: Node | null
          while ((node = walker.nextNode())) {
            const text = node.textContent ?? ''
            for (let index = 0; index < text.length; index++) {
              if (!/\p{Script=Han}/u.test(text[index])) continue
              const range = document.createRange()
              range.setStart(node, index)
              range.setEnd(node, index + 1)
              const rect = range.getBoundingClientRect()
              centers.push({ x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 })
            }
          }
          if (centers.length < 2) return []
          return [{
            id: label.closest<HTMLElement>('[data-object-id]')!.dataset.objectId!,
            text: label.textContent, font: getComputedStyle(label).fontSize, scale,
            gaps: centers.slice(1).map((point, i) => ({
              dx: Math.abs(point.x - centers[i].x) / scale,
              dy: Math.abs(point.y - centers[i].y) / scale,
            })),
          }]
        })
      })
      await info.attach('actual-range-centers.json', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
      expect(measurements.length).toBeGreaterThan(0)
      for (const id of scene.required) expect(measurements.map(item => item.id)).toContain(id)
      // Compatibility Cafe currently has only horizontal multi-character labels.
      // The interior offerings and office desk/chair require real vertical runs.
      if (scene.id !== 'commercial-cafe') {
        expect(measurements.some(item => item.gaps.some(gap => gap.dy > gap.dx))).toBe(true)
      }
      expect(measurements.some(item => item.gaps.some(gap => gap.dx > gap.dy))).toBe(true)
      for (const item of measurements) {
        expect(item.font, item.id).toBe('16px')
        for (const gap of item.gaps) {
          expect(Math.max(gap.dx, gap.dy), `${item.id}: ${JSON.stringify(gap)}`).toBeCloseTo(16, 1)
          expect(Math.min(gap.dx, gap.dy), item.id).toBeLessThan(.05)
        }
      }
      await page.screenshot({ path: info.outputPath('furniture.png') })
    })
  }
}

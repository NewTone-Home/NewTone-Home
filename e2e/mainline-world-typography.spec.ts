import { expect, test } from '@playwright/test'

const cases = [
  { viewport: { width: 1280, height: 720 }, mode: 'current' },
  { viewport: { width: 500, height: 844 }, mode: 'current' },
  { viewport: { width: 1280, height: 720 }, mode: 'C' },
  { viewport: { width: 500, height: 844 }, mode: 'C' },
] as const

for (const { viewport, mode } of cases) {
  test(`shared scene typography survives ${mode} camera at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const query = mode === 'C' ? '&viewportScale=C' : ''
    await page.goto(`/?scene=commercial-street&debugRuntimeEvidence=1${query}`)
    await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-camera-scale-mode', mode)

    const street = await page.evaluate(() => {
      const wall = document.querySelector<HTMLElement>(
        '.scene-mainline-wall-labels .scene-mainline-wall:not(.scene-mainline-wall-door):not(.scene-mainline-storefront)',
      )
      const glass = [...document.querySelectorAll<HTMLElement>('.scene-mainline-storefront--glass')]
      const doors = [...document.querySelectorAll<HTMLElement>(
        '.scene-mainline-wall-door .scene-door__surface',
      )]
      const signs = [...document.querySelectorAll<HTMLElement>(
        '.scene-mainline-focus-group.scene-mainline-storefront--sign',
      )]
      const world = document.querySelector<HTMLElement>('.scene-mainline-world')
      if (!wall || !world) throw new Error('Expected the shared wall label and projected world')
      const worldScale = new DOMMatrixReadOnly(getComputedStyle(world).transform).a
      return {
        wallFont: parseFloat(getComputedStyle(wall).fontSize),
        worldScale,
        glassFonts: glass.map(element => parseFloat(getComputedStyle(element).fontSize)),
        doorFonts: doors.map(element => parseFloat(getComputedStyle(element).fontSize)),
        signFonts: signs.map(element => ({
          computed: parseFloat(getComputedStyle(element).fontSize),
          inline: parseFloat(element.style.fontSize),
        })),
      }
    })
    expect(street.glassFonts).toHaveLength(64)
    expect(street.doorFonts.length).toBeGreaterThan(0)
    for (const font of [...street.glassFonts, ...street.doorFonts]) {
      expect(font).toBeCloseTo(street.wallFont, 2)
      expect(font * street.worldScale).toBeCloseTo(street.wallFont * street.worldScale, 2)
    }
    expect(street.signFonts).toHaveLength(16)
    for (const sign of street.signFonts) {
      expect(sign.inline).toBeGreaterThan(12)
      expect(sign.computed).toBeCloseTo(sign.inline, 2)
    }

    await page.goto(`/?scene=commercial-cafe&debugRuntimeEvidence=1${query}`)
    await expect(page.locator('.mainline-scene-stage')).toHaveAttribute('data-camera-scale-mode', mode)
    const cafe = await page.evaluate(() => {
      const wall = document.querySelector<HTMLElement>(
        '.scene-mainline-wall-labels .scene-mainline-wall:not(.scene-mainline-wall-door)',
      )
      const doors = [...document.querySelectorAll<HTMLElement>(
        '.scene-mainline-wall-door .scene-door__surface',
      )]
      const namedObjects = ['commercial-cafe-menu', 'commercial-cafe-blackboard']
        .map(id => document.querySelector<HTMLElement>(`[data-object-id="${id}"]`))
      if (!wall || namedObjects.some(element => !element)) throw new Error('Expected cafe wall, menu, and blackboard')
      return {
        wallFont: parseFloat(getComputedStyle(wall).fontSize),
        doorFonts: doors.map(element => parseFloat(getComputedStyle(element).fontSize)),
        objectFonts: namedObjects.map(element => parseFloat(getComputedStyle(element!).fontSize)),
      }
    })
    expect(cafe.doorFonts).toHaveLength(2)
    for (const font of [...cafe.doorFonts, ...cafe.objectFonts]) expect(font).toBeCloseTo(cafe.wallFont, 2)
  })
}

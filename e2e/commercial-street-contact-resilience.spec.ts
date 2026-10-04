import { expect, test } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates, mainlineScenes } from '../src/center/runtime/mainlineScenes'

test.use({ viewport: { width: 1280, height: 720 } })

const street = mainlineScenes['commercial-street']
const northClothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
const [centredContact] = mainlineStorefrontInteractionCandidates(street, northClothing)

test('an ambient pedestrian occupying the centred storefront contact leaves a real fallback for the protagonist', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const protagonist = page.locator('[data-actor-id="protagonist"]')
  const pedestrian = page.locator('[data-npc-id="commercial-street-pedestrian-west-north"]')
  const echo = page.locator('[data-scene-echo="commercial-north-slot-2"]')
  await page.waitForFunction((contactX) => {
    const actor = document.querySelector<HTMLElement>('[data-npc-id="commercial-street-pedestrian-west-north"]')
    return Boolean(actor && Math.abs(Number(actor.dataset.runtimeX) - contactX) < .75)
  }, centredContact.x, { timeout: 30_000 })

  const beforeClick = {
    x: Number(await protagonist.getAttribute('data-runtime-x')),
    y: Number(await protagonist.getAttribute('data-runtime-y')),
  }
  const runtimeCandidates = mainlineStorefrontInteractionCandidates(street, northClothing, beforeClick)
  await page.getByRole('button', { name: '服装店', exact: true }).first().click()
  await expect(echo).toBeVisible({ timeout: 15_000 })
  const arrived = {
    x: Number(await protagonist.getAttribute('data-runtime-x')),
    y: Number(await protagonist.getAttribute('data-runtime-y')),
  }
  expect(runtimeCandidates.some((candidate) => Math.hypot(candidate.x - arrived.x, candidate.y - arrived.y) < .35)).toBe(true)
  expect(Math.hypot(centredContact.x - arrived.x, centredContact.y - arrived.y)).toBeGreaterThan(.75)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-fallback-contact.png') })
  expect(consoleErrors).toEqual([])
})

test('Commercial Street storefront names remain complete and legible at desktop and narrow viewports', async ({ page }, testInfo) => {
  const storefront = street.storefronts.find((candidate) => candidate.id === 'commercial-north-slot-2')!
  const approach = mainlineStorefrontApproach(street, storefront)
  for (const viewport of [
    { name: 'desktop-1280x720', width: 1280, height: 720 },
    { name: 'mobile-412x915', width: 412, height: 915 },
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'mobile-360x800', width: 360, height: 800 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
    const stage = page.locator('.mainline-scene-stage')
    const approachScreenPoint = await stage.evaluate((element, target) => {
      const rect = element.getBoundingClientRect()
      const cameraX = Number(element.getAttribute('data-camera-offset-x') ?? 0)
      const cameraY = Number(element.getAttribute('data-camera-offset-y') ?? 0)
      return { x: ((target.x + cameraX) / 100) * rect.width, y: ((target.y + cameraY) / 100) * rect.height }
    }, approach)
    await stage.click({ position: approachScreenPoint })
    await page.waitForFunction(({ x, y }) => {
      const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
      return Boolean(actor && Math.hypot(Number(actor.dataset.runtimeX) - x, Number(actor.dataset.runtimeY) - y) < .6)
    }, approach, { timeout: 30_000 })
    const labelSlot = page.locator(`[data-storefront-label-slot="true"][data-storefront-id="${storefront.id}"]`)
    const signNodes = await page.locator(`[data-storefront-cell-id^="${storefront.id}-cell-"], [data-focus-target-group^="storefront:${storefront.id}"]`).evaluateAll((elements) => elements.map((element) => ({
      tag: element.tagName,
      id: element.getAttribute('data-storefront-cell-id'),
      group: element.getAttribute('data-focus-target-group'),
      text: element.textContent?.trim(),
      className: element.className,
    })))
    await expect(labelSlot, JSON.stringify(signNodes)).toBeVisible()
    const labels = await labelSlot.evaluate((slot, storefrontId) => {
      const track = slot.querySelector<HTMLElement>('.scene-mainline-storefront__label-track')
      if (!track) throw new Error('Expected a rendered storefront label track')
      const range = document.createRange()
      range.selectNodeContents(track)
      const text = range.getBoundingClientRect()
      const box = slot.getBoundingClientRect()
      const trackStyle = getComputedStyle(track)
      return {
        text: track.textContent?.trim() ?? '',
        textBox: { left: text.left, top: text.top, right: text.right, bottom: text.bottom },
        slotBox: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        writingMode: trackStyle.writingMode,
        opacity: Number(trackStyle.opacity),
        trackClient: { width: track.clientWidth, height: track.clientHeight },
        trackScroll: { width: track.scrollWidth, height: track.scrollHeight },
        glassBoxes: [...document.querySelectorAll<HTMLElement>(`[data-storefront-cell-id^="${storefrontId}-cell-"]`)]
          .filter((cell) => cell.classList.contains('scene-mainline-storefront--glass'))
          .map((cell) => {
            const rect = cell.getBoundingClientRect()
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
          }),
      }
    }, storefront.id)
    expect(labels.text).toBe(storefront.label)
    expect(labels.opacity, `${viewport.name} label must be legibly visible`).toBeGreaterThan(0.5)
    expect(labels.textBox.left, `${viewport.name} label left viewport clipping`).toBeGreaterThanOrEqual(0)
    expect(labels.textBox.right, `${viewport.name} label right viewport clipping`).toBeLessThanOrEqual(labels.viewport.width)
    expect(labels.textBox.top, `${viewport.name} label top viewport clipping`).toBeGreaterThanOrEqual(0)
    expect(labels.textBox.bottom, `${viewport.name} label bottom viewport clipping`).toBeLessThanOrEqual(labels.viewport.height)
    expect(labels.writingMode).toBe('horizontal-tb')
    expect(labels.glassBoxes.some((box) => labels.textBox.left < box.right && labels.textBox.right > box.left && labels.textBox.top < box.bottom && labels.textBox.bottom > box.top), `${viewport.name} label overlaps adjacent storefront glazing`).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-storefront-labels.png`) })
  }
})

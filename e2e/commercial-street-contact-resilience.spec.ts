import { expect, test } from '@playwright/test'
import { mainlineStorefrontApproach, mainlineStorefrontInteractionCandidates, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineStorefrontPlayerContact, resolveMainlineStorefrontInteraction } from '../src/center/runtime/mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'

test.use({ viewport: { width: 1280, height: 720 } })

const street = mainlineScenes['commercial-street']
const northClothing = street.storefronts.find((storefront) => storefront.id === 'commercial-north-slot-2')!
const [centredContact] = mainlineStorefrontInteractionCandidates(street, northClothing)

test('ambient storefront traffic leaves a legal close player contact without changing pedestrian visit geometry', async ({ page }, testInfo) => {
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
  const box = (await page.locator('.mainline-scene-stage').boundingBox())!
  const screenMetrics = { width: box.width, height: box.height, viewportWidth: 1280 }
  const options = { screenMetrics, geometrySnapshot: createMainlineSceneGeometrySnapshot(street, beforeClick, {}, screenMetrics) }
  const contact = mainlineStorefrontPlayerContact(street, northClothing, beforeClick, {}, options)!
  await page.getByRole('button', { name: '服装店', exact: true }).first().click()
  await expect(echo).toBeVisible({ timeout: 15_000 })
  const arrived = {
    x: Number(await protagonist.getAttribute('data-runtime-x')),
    y: Number(await protagonist.getAttribute('data-runtime-y')),
  }
  expect(contact.isClose(arrived)).toBe(true)
  expect(Math.hypot(centredContact.x - arrived.x, centredContact.y - arrived.y)).toBeGreaterThan(.75)
  await page.screenshot({ path: testInfo.outputPath('commercial-street-fallback-contact.png') })
  expect(consoleErrors).toEqual([])
})

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`ordinary storefront travels before interaction and leaves a tiny visual edge gap at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.setViewportSize(viewport)
    await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
    const actor = page.locator('[data-actor-id="protagonist"]')
    const echo = page.locator(`[data-scene-echo="${northClothing.id}"]`)
    await expect(echo).toHaveCount(0)
    await page.getByRole('button', { name: northClothing.label, exact: true }).first().click()
    await expect(actor).toHaveClass(/is-moving/)
    await expect(echo).toHaveCount(0)
    await expect(echo).toBeVisible({ timeout: 30000 })
    await expect(actor).not.toHaveClass(/is-moving/)
    const measurements = await page.evaluate(storefrontId => {
      const actor = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')!
      const dot = actor.querySelector('.scene-protagonist__dot')!.getBoundingClientRect()
      const sign = document.querySelector(`[data-storefront-label-slot][data-storefront-id="${storefrontId}"]`)!.getBoundingClientRect()
      const stage = document.querySelector('.mainline-scene-stage')!.getBoundingClientRect()
      const overlapsNpc = [...document.querySelectorAll<HTMLElement>('[data-npc-role="pedestrian"]')].some(npc => {
        const body = npc.getBoundingClientRect()
        return dot.left < body.right && dot.right > body.left && dot.top < body.bottom && dot.bottom > body.top
      })
      return { gap: dot.top - sign.bottom, actorWidth: dot.width, overlapsNpc, position: { x: Number(actor.dataset.runtimeX), y: Number(actor.dataset.runtimeY) }, metrics: { width: stage.width, height: stage.height, viewportWidth: innerWidth } }
    }, northClothing.id)
    expect(measurements.gap).toBeGreaterThan(0)
    expect(measurements.gap / measurements.actorWidth).toBeGreaterThanOrEqual(.2)
    expect(measurements.gap / measurements.actorWidth).toBeLessThanOrEqual(.35)
    expect(measurements.overlapsNpc).toBe(false)
    const options = { screenMetrics: measurements.metrics, geometrySnapshot: createMainlineSceneGeometrySnapshot(street, measurements.position, {}, measurements.metrics) }
    expect(resolveMainlineStorefrontInteraction(street, northClothing, measurements.position, {}, options).inRange).toBe(true)
    await testInfo.attach('contact-measurements', { body: JSON.stringify(measurements), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath(`bug1b-near-contact-${viewport.width}.png`) })
    expect(errors).toEqual([])
  })
}

test('walking manually to the geometry-derived entrance permits interaction without another move', async ({ page }) => {
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const stage = page.locator('.mainline-scene-stage')
  const box = (await stage.boundingBox())!
  const screenMetrics = { width: box.width, height: box.height, viewportWidth: 1280 }
  const options = { screenMetrics, geometrySnapshot: createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, screenMetrics) }
  const contact = mainlineStorefrontPlayerContact(street, northClothing, street.initialPlayerPosition, {}, options)!
  // Use an interior manual stance: browser mouse coordinates are integer
  // pixels, so clicking a span's exact inset endpoint may round outside it.
  const target = { ...resolveMainlineStorefrontInteraction(street, northClothing, street.initialPlayerPosition, {}, options).target, x: contact.geometry.center.x }
  const screenPoint = await stage.evaluate((element, point) => {
    const rect = element.getBoundingClientRect()
    return { x: (point.x + Number(element.getAttribute('data-camera-offset-x'))) / 100 * rect.width, y: (point.y + Number(element.getAttribute('data-camera-offset-y'))) / 100 * rect.height }
  }, target)
  await stage.click({ position: screenPoint })
  const actor = page.locator('[data-actor-id="protagonist"]')
  await expect(actor).toHaveClass(/is-moving/)
  await expect(actor).not.toHaveClass(/is-moving/, { timeout: 30000 })
  const before = { x: Number(await actor.getAttribute('data-runtime-x')), y: Number(await actor.getAttribute('data-runtime-y')) }
  expect(resolveMainlineStorefrontInteraction(street, northClothing, before, {}, options).inRange).toBe(true)
  await page.getByRole('button', { name: northClothing.label, exact: true }).first().click()
  await expect(page.locator(`[data-scene-echo="${northClothing.id}"]`)).toBeVisible()
  await expect(actor).not.toHaveClass(/is-moving/)
  expect({ x: Number(await actor.getAttribute('data-runtime-x')), y: Number(await actor.getAttribute('data-runtime-y')) }).toEqual(before)
})

test('Café keeps its reveal and portal traversal after ordinary storefront contact changes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/?scene=commercial-street&debugRuntimeEvidence=1')
  const cafe = street.storefronts.find(store => store.id === 'commercial-cafe-slot')!
  const approach = mainlineStorefrontApproach(street, cafe)
  const actor = page.locator('[data-actor-id="protagonist"]')
  const stage = page.locator('.mainline-scene-stage')
  // Walk through visible portions of the scrolling street using real input.
  const step = street.walkBounds.width / 8
  for (let index = 0; index < 16; index += 1) {
    // The authored question narrative interrupts street travel. Complete its
    // real reading interaction before issuing the next movement request.
    for (let line = 0; line < 25; line += 1) {
      const shield = page.locator('[data-scene-dialogue-shield="true"]')
      if (!await shield.count()) break
      await expect(page.locator('[data-scene-observation-typing="true"]')).toHaveCount(0, { timeout: 15000 })
      await shield.click({ force: true })
      await expect(page.locator('[data-scene-echo-phase="leaving"]')).toHaveCount(0)
    }
    const x = Number(await actor.getAttribute('data-runtime-x'))
    if (Math.abs(x - approach.x) < .01) break
    const target = { x: Math.min(approach.x, x + step), y: street.initialPlayerPosition.y }
    const pixels = await stage.evaluate((element, target) => {
      const rect = element.getBoundingClientRect()
      return { x: (target.x + Number(element.getAttribute('data-camera-offset-x'))) / 100 * rect.width, y: (target.y + Number(element.getAttribute('data-camera-offset-y'))) / 100 * rect.height }
    }, target)
    await stage.click({ position: pixels })
    await expect(actor).toHaveClass(/is-moving/)
    await expect(actor).not.toHaveClass(/is-moving/, { timeout: 15000 })
    if (Math.abs(Number(await actor.getAttribute('data-runtime-x')) - approach.x) < step / 100) break
  }
  await expect(page.locator(`[data-storefront-id="${cafe.id}"] .scene-mainline-storefront__label-track`)).toHaveAttribute('data-storefront-label-phase', 'revealed')
  await expect(page.locator(`[data-scene-echo="${cafe.id}"]`)).toHaveCount(0)
  await page.locator('[data-focus-target-group="door:street-cafe-entry"]').first().click()
  await expect(page.locator('.scene-shell[data-mainline-scene="commercial-cafe"]')).toBeVisible({ timeout: 15000 })
  expect(errors).toEqual([])
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

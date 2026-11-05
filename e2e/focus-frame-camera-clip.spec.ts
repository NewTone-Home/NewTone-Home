import { expect, test } from '@playwright/test'

test('commercial-street storefront frames keep their local geometry as the camera clips glyphs', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2047, height: 1117 })
  await page.goto('/?scene=commercial-street')
  await expect(page.locator('.mainline-scene-stage')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.locator('.scene-focus-frame[data-focus-frame-phase="visible"]').count()).toBeGreaterThan(0)
  const initialStorefrontFrames = await page.locator('.scene-focus-frame[data-focus-frame-group^="storefront:commercial-"]').evaluateAll(frames => frames.map(frame => {
    const rect = frame.getBoundingClientRect()
    return {
      group: (frame as HTMLElement).dataset.focusFrameGroup,
      phase: (frame as HTMLElement).dataset.focusFramePhase,
      visibility: getComputedStyle(frame).visibility,
      width: rect.width,
      height: rect.height,
    }
  }))
  expect(initialStorefrontFrames.length).toBeGreaterThanOrEqual(14)
  expect(initialStorefrontFrames.every(frame => frame.phase === 'visible' && frame.visibility === 'visible' && frame.width > 0 && frame.height > 0)).toBe(true)
  const targetGroup = 'storefront:commercial-south-slot-7:baseline'
  const targetFrame = page.locator(`.scene-focus-frame[data-focus-frame-group="${targetGroup}"]`)
  await expect(targetFrame).toHaveAttribute('data-focus-frame-phase', 'visible')
  await expect(targetFrame).toHaveCSS('visibility', 'visible')
  await expect.poll(() => targetFrame.evaluate(frame => frame.getBoundingClientRect().width)).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.scene-focus-frame[data-focus-frame-phase="visible"] path').evaluateAll(paths => paths.every(path => {
    const frame = path.closest<HTMLElement>('.scene-focus-frame')
    return frame?.dataset.focusFramePhase !== 'visible'
      || (path.getAttribute('d')?.trim().endsWith('Z') && Number.parseFloat(getComputedStyle(path).strokeDashoffset) === 0)
  })), { timeout: 5000 }).toBe(true)

  const initial = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')!
    const world = stage.querySelector<HTMLElement>('.scene-mainline-world')!
    const group = 'storefront:commercial-south-slot-7:baseline'
    const frame = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame')]
      .find(node => node.dataset.focusFrameGroup === group)!
    const glyphs = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
      .filter(node => node.dataset.focusVisualGroup === group && node.closest('.scene-character-switch'))
    const target = { frame, group, glyphs }
    if (!frame || !glyphs.length) throw new Error('The south jewellery storefront sign frame or glyphs are missing')
    const box = target.frame.getBoundingClientRect()
    const glyphRects = target.glyphs.flatMap(node => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return [...range.getClientRects()]
    })
    const left = Math.min(...glyphRects.map(rect => rect.left))
    const right = Math.max(...glyphRects.map(rect => rect.right))
    const stageBox = stage.getBoundingClientRect()
    const path = target.frame.querySelector('path')!
    return {
      group: target.group,
      stage: { left: stageBox.left, right: stageBox.right },
      worldTranslate: world.style.translate,
      frame: { left: target.frame.style.left, top: target.frame.style.top, width: target.frame.style.width, height: target.frame.style.height },
      frameBox: { left: box.left, top: box.top, width: box.width, height: box.height },
      glyphRange: { left, right, width: right - left },
      pathDashOffset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      target: target.glyphs[0],
    }
  })
  expect(initial.pathDashOffset).toBe(0)
  await page.screenshot({ path: testInfo.outputPath('storefront-frame-visible-stable.png') })

  const remeasure = async (translate: string) => page.evaluate(async ({ group, translate }) => {
    const stage = document.querySelector<HTMLElement>('.mainline-scene-stage')!
    const world = stage.querySelector<HTMLElement>('.scene-mainline-world')!
    const frame = [...stage.querySelectorAll<HTMLElement>('.scene-focus-frame')]
      .find(node => node.dataset.focusFrameGroup === group)!
    const target = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
      .find(node => node.dataset.focusVisualGroup === group && node.closest('.scene-character-switch'))!
    const targetRects = () => {
      const range = document.createRange()
      range.selectNodeContents(target)
      return [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }))
    }
    world.style.translate = translate
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const rects = targetRects()
    const spanLeft = Math.min(...rects.map(rect => rect.left))
    const spanRight = Math.max(...rects.map(rect => rect.right))
    const stageBox = stage.getBoundingClientRect()
    const stageClipped = spanLeft < stageBox.left || spanRight > stageBox.right
    let measurementMs = -1
    const observer = new MutationObserver(() => {
      measurementMs = performance.now() - startedAt
      observer.disconnect()
    })
    observer.observe(target, { attributes: true, attributeFilter: ['class'] })
    const startedAt = performance.now()
    target.classList.toggle('focus-measure-camera-probe')
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const path = frame.querySelector('path')!
    return {
      localFrame: { left: frame.style.left, top: frame.style.top, width: frame.style.width, height: frame.style.height },
      framePhase: frame.dataset.focusFramePhase,
      dashOffset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      stageClipped,
      glyphRects: targetRects(),
      measurementMs,
      measuredFrameCount: stage.querySelectorAll('.scene-focus-frame').length,
    }
  }, { group: initial.group, translate })

  const stageCenter = (initial.stage.left + initial.stage.right) / 2
  const panToShop = `${stageCenter - (initial.glyphRange.left + initial.glyphRange.right) / 2}px 0px`
  const entered = await remeasure(panToShop)
  expect(entered.stageClipped).toBe(false)
  expect(entered.framePhase).toBe('visible')
  expect(entered.dashOffset).toBe(0)
  expect(entered.localFrame, 'panning into the shop without touching its door must retain the sign frame').toEqual(initial.frame)
  await page.screenshot({ path: testInfo.outputPath('storefront-frame-shop-in-view.png') })

  const enteredLeft = Math.min(...entered.glyphRects.map(rect => rect.left))
  const enteredRight = Math.max(...entered.glyphRects.map(rect => rect.right))
  const partialTranslate = `${initial.stage.left - enteredLeft - (enteredRight - enteredLeft) * .65}px 0px`
  const outside = await remeasure(partialTranslate)
  expect(outside.stageClipped).toBe(true)
  expect(outside.framePhase).toBe('visible')
  expect(outside.dashOffset).toBe(0)
  expect(outside.localFrame, 'partial camera clipping must not change frame-local geometry').toEqual(initial.frame)
  await page.screenshot({ path: testInfo.outputPath('storefront-frame-partially-outside.png') })

  const returned = await remeasure('')
  expect(returned.stageClipped).toBe(true)
  expect(returned.framePhase).toBe('visible')
  expect(returned.dashOffset).toBe(0)
  expect(returned.localFrame, 'returning the camera must preserve the same frame-local geometry').toEqual(initial.frame)
  expect([entered, outside, returned].every(result => result.measurementMs >= 0 && result.measuredFrameCount > 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('storefront-frame-returned.png') })
  const evidence = { viewport: [2047, 1117], deviceScaleFactor: 1, group: initial.group, initial, entered, outside, returned }
  console.log('[focus-frame-camera-clip]', JSON.stringify(evidence))
  await testInfo.attach('camera-clip-frame-measurement', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
})

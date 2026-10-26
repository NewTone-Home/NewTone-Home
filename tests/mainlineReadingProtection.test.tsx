import { describe, expect, it } from 'vitest'
import { currentMainlineReadingTargetIds, mainlineFitReadingText, mainlinePlaceReadingAction, mainlinePlaceReadingBox, mainlineReadingActionLayerPosition, mainlineReadingMaskRects, mainlineReadingOverflowPageForSession, mainlineReadingOverflowPageIndex } from '../src/center/runtime/mainlineReadingProtection'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineReadingBounds, mainlineInteractionRoom } from '../src/center/runtime/mainlineTextReading'
import { projectCommercialStreetX } from '../src/center/runtime/commercialStreetGridProjection'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { activeStorefrontInteriorOwner } from '../src/center/runtime/storefrontPresentation'
import { mainlineDisplaySourceText } from '../src/center/runtime/mainlineTextSegments'
import { mainlineReadingAnchorContextKey, mainlineReadingAnchorForSession } from '../src/center/runtime/mainlineReadingPresentation'
import { mainlineAvailableReadingWidthPx } from '../src/center/runtime/mainlineTextReading'
import { mainlineEchoLayout } from '../src/center/runtime/mainlineEchoLayout'

describe('reading target protection', () => {
  it('converts a saved action anchor into the current world-layer camera without applying pan twice', () => {
    const anchor = { x: 34.5, y: 22.25 }
    const saved = { x: 15.5, y: 27.75 }
    const sameCamera = mainlineReadingActionLayerPosition(anchor, saved, saved)
    expect(sameCamera).toEqual(anchor)
    expect({ x: sameCamera.x + saved.x, y: sameCamera.y + saved.y }).toEqual({ x: 50, y: 50 })

    const changingCamera = mainlineReadingActionLayerPosition(anchor, saved, { x: 22, y: 19 })
    expect(changingCamera).toEqual({ x: 28, y: 31 })
    expect({ x: changingCamera.x + 22, y: changingCamera.y + 19 }).toEqual({ x: 50, y: 50 })

    const zeroCamera = mainlineReadingActionLayerPosition(anchor, { x: 0, y: 0 }, { x: 0, y: 0 })
    expect(zeroCamera).toEqual(anchor)

    // During a reading-exit camera handoff, the rendered world offset changes
    // each frame while the choice stays at the reading's saved screen anchor.
    const handoffFrames = [
      { x: 15.5, y: 27.75 },
      { x: 19, y: 24 },
      { x: 26, y: 18 },
      { x: 31, y: 10 },
    ]
    for (const current of handoffFrames) {
      const local = mainlineReadingActionLayerPosition(anchor, saved, current)
      expect({ x: local.x + current.x, y: local.y + current.y }).toEqual({ x: 50, y: 50 })
    }
  })

  it('moves protection to the current reading source and removes it when reading ends', () => {
    expect(currentMainlineReadingTargetIds({ readingMode: true, activeObjectId: 'old-target', sceneEchoEntityId: 'new-target' })).toEqual(new Set(['new-target']))
    expect(currentMainlineReadingTargetIds({ readingMode: true, activeObjectId: 'old-target' })).toEqual(new Set(['old-target']))
    expect(currentMainlineReadingTargetIds({ readingMode: false, activeObjectId: 'old-target', sceneEchoEntityId: 'new-target' })).toEqual(new Set())
  })

  it('clears locally fitted pages when reading is interrupted and reopened on the same target', () => {
    const firstSession = 'commercial-street:observation:echo:88:commercial-cafe-menu'
    const page = { sessionKey: firstSession, key: `${firstSession}:echo:0:long line`, index: 1 }
    expect(mainlineReadingOverflowPageIndex(page, firstSession, page.key)).toBe(1)
    const afterInterrupt = mainlineReadingOverflowPageForSession(page, null)
    expect(afterInterrupt).toBeNull()
    expect(mainlineReadingOverflowPageIndex(afterInterrupt, firstSession, page.key)).toBe(0)
    expect(mainlineReadingOverflowPageForSession(afterInterrupt, firstSession)).toBeNull()
  })

  it('repositions a narrow-screen reading box inside the current Cafe room, clear of the target', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const source = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    const metrics = { width: 390, height: 844, viewportWidth: 390 }
    const scale = .65
    const cameraOffset = { x: 50 - source.x, y: 50 - source.y }
    const protectedBox = { x: source.x - .5, y: source.y - .75, width: 1, height: 1.5 }
    const size = { width: 120, height: 36 }
    const placed = mainlinePlaceReadingBox(scene, source, size, [protectedBox], metrics, scale, cameraOffset)

    expect(placed).not.toBeNull()
    const bounds = mainlineReadingBounds(scene, source, metrics, scale, cameraOffset)
    const projectedX = (x: number) => projectCommercialStreetX(x, metrics)
    const centerX = projectedX(placed!.x)
    const halfWidth = size.width / (1920 * scale) * 50
    const halfHeight = size.height / (1080 * scale) * 50
    expect(centerX - halfWidth).toBeGreaterThanOrEqual(bounds.x - 1e-5)
    expect(centerX + halfWidth).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-5)
    expect(placed!.y - halfHeight).toBeGreaterThanOrEqual(bounds.y - 1e-5)
    expect(placed!.y + halfHeight).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-5)
    expect(Math.hypot(projectedX(placed!.x) - projectedX(source.x), placed!.y - source.y)).toBeGreaterThan(0)
    expect(mainlineInteractionRoom(scene, placed!)?.id).toBe(room.id)
    const targetLeft = projectedX(protectedBox.x)
    const targetRight = projectedX(protectedBox.x + protectedBox.width)
    const targetTop = protectedBox.y
    const targetBottom = protectedBox.y + protectedBox.height
    const textLeft = centerX - halfWidth
    const textRight = centerX + halfWidth
    const textTop = placed!.y - halfHeight
    const textBottom = placed!.y + halfHeight
    const gapX = 4 / (1920 * scale) * 100
    const gapY = 4 / (1080 * scale) * 100
    const overlapsProtectedTarget = textLeft < targetRight + gapX
      && textRight + gapX > targetLeft
      && textTop < targetBottom + gapY
      && textBottom + gapY > targetTop
    expect(overlapsProtectedTarget).toBe(false)
  })

  it('finds legal narrow-screen reading positions at all four Cafe room corners around the player and target', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const metrics = { width: 360, height: 550, viewportWidth: 360 }
    const scale = .65
    const insetX = 2 / 19.2 * 100
    const insetY = 2 / 10.8 * 100
    const corners = [
      { x: room.bounds.x + insetX, y: room.bounds.y + insetY },
      { x: room.bounds.x + room.bounds.width - insetX, y: room.bounds.y + insetY },
      { x: room.bounds.x + insetX, y: room.bounds.y + room.bounds.height - insetY },
      { x: room.bounds.x + room.bounds.width - insetX, y: room.bounds.y + room.bounds.height - insetY },
    ]
    for (const source of corners) {
      const cameraOffset = { x: 50 - source.x, y: 50 - source.y }
      const obstacles = [
        { x: source.x - .35, y: source.y - .7, width: .7, height: 1.4 },
        { x: source.x + 1.5, y: source.y + 1, width: .8, height: 1.4 },
      ]
      const placed = mainlinePlaceReadingBox(scene, source, { width: 88, height: 28 }, obstacles, metrics, scale, cameraOffset)
      expect(placed, `corner ${source.x},${source.y}`).not.toBeNull()
      expect(mainlineInteractionRoom(scene, placed!)?.id).toBe(room.id)
    }
  })

  it('shortens a real narrow-screen Cafe reading page around the player without shrinking the font or losing text', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const metrics = { width: 360, height: 550, viewportWidth: 360 }
    const scale = .65
    const source = { x: room.bounds.x + .7, y: room.bounds.y + .8 }
    const cameraOffset = { x: 50 - source.x, y: 50 - source.y }
    const text = '老周把咖啡放到桌上。你可以先看看店里的菜单，再决定要不要继续聊下去。'
    const player = { x: source.x - .4, y: source.y - .65, width: .8, height: 1.3 }
    const result = mainlineFitReadingText(scene, source, text, undefined, 180, [player], metrics, scale, cameraOffset)

    expect(result.fits).toBe(true)
    expect(result.segments.length).toBeGreaterThan(1)
    expect(result.segments.join('')).toBe(mainlineDisplaySourceText(text))
    expect(result.layout.fontSizePx).toBe(12)
    expect(mainlineInteractionRoom(scene, result.position)?.id).toBe(room.id)
    const bounds = mainlineReadingBounds(scene, source, metrics, scale, cameraOffset)
    const halfWidth = result.layout.widthPx / (1920 * scale) * 50
    const halfHeight = result.layout.heightPx / (1080 * scale) * 50
    expect(result.position.x - halfWidth).toBeGreaterThanOrEqual(bounds.x - 1e-5)
    expect(result.position.x + halfWidth).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-5)
    expect(result.position.y - halfHeight).toBeGreaterThanOrEqual(bounds.y - 1e-5)
    expect(result.position.y + halfHeight).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-5)
    expect(result.position).not.toEqual(source)
  })

  it('fits every page against one stable maximum envelope so a later longer page keeps the same legal anchor', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const metrics = { width: 390, height: 844, viewportWidth: 390 }
    const scale = .65
    const source = { x: room.bounds.x + .7, y: room.bounds.y + .8 }
    const cameraOffset = { x: 50 - source.x, y: 50 - source.y }
    const protectedVisuals = [{ x: source.x - .4, y: source.y - .65, width: .8, height: 1.3 }]
    const envelope = ['短句', '这里是原柜台的点单接触位置']
    const firstPage = mainlineFitReadingText(scene, source, envelope[0]!, undefined, 210, protectedVisuals, metrics, scale, cameraOffset, envelope)
    const laterLongerPage = mainlineFitReadingText(scene, source, envelope[1]!, undefined, 210, protectedVisuals, metrics, scale, cameraOffset, envelope)

    expect(firstPage.fits).toBe(true)
    expect(laterLongerPage.fits).toBe(true)
    expect(firstPage.position).toEqual(laterLongerPage.position)
    expect(firstPage.maxWidthPx).toBe(laterLongerPage.maxWidthPx)
    expect(firstPage.segments.join('')).toBe(envelope[0])
    expect(laterLongerPage.segments.join('')).toBe(envelope[1])
    expect(mainlineInteractionRoom(scene, laterLongerPage.position)?.id).toBe(room.id)
    const envelopeLayout = mainlineEchoLayout(envelope[1]!, metrics, { maxWidthPx: laterLongerPage.maxWidthPx })
    const bounds = mainlineReadingBounds(scene, source, metrics, scale, cameraOffset)
    const centerX = projectCommercialStreetX(laterLongerPage.position.x, metrics)
    const halfWidth = envelopeLayout.widthPx / (1920 * scale) * 50
    const halfHeight = envelopeLayout.heightPx / (1080 * scale) * 50
    expect(centerX - halfWidth).toBeGreaterThanOrEqual(bounds.x - 1e-5)
    expect(centerX + halfWidth).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-5)
    expect(laterLongerPage.position.y - halfHeight).toBeGreaterThanOrEqual(bounds.y - 1e-5)
    expect(laterLongerPage.position.y + halfHeight).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-5)
  })

  it('re-fits a retained session when the real viewport changes', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const source = { x: room.bounds.x + .7, y: room.bounds.y + .8 }
    const scale = .65
    const cameraOffset = { x: 50 - source.x, y: 50 - source.y }
    const protectedVisuals = [{ x: source.x - .4, y: source.y - .65, width: .8, height: 1.3 }]
    const envelope = ['这里是原柜台的点单接触位置', '稍短的后页']
    const desktop = { width: 1280, height: 800, viewportWidth: 1280 }
    const phone = { width: 390, height: 844, viewportWidth: 390 }
    const desktopFit = mainlineFitReadingText(scene, source, envelope[0]!, undefined, 720, protectedVisuals, desktop, scale, cameraOffset, envelope)
    const phoneFit = mainlineFitReadingText(scene, source, envelope[1]!, undefined, 210, protectedVisuals, phone, scale, cameraOffset, envelope)
    const context = (viewport: typeof desktop) => mainlineReadingAnchorContextKey({ sceneId: scene.id, viewport, worldScale: scale, cameraOffset, source, protectedBoxes: protectedVisuals })
    const sessionKey = 'commercial-street:observation:echo:viewport-test:counter'
    const retained = {
      sessionKey,
      anchorContextKey: context(desktop),
      position: desktopFit.position,
      cameraOffset,
      layout: desktopFit.layout,
      maxWidthPx: desktopFit.maxWidthPx,
      text: envelope[0]!,
      overflowIndex: 0,
    }

    expect(desktopFit.fits).toBe(true)
    expect(phoneFit.fits).toBe(true)
    expect(context(phone)).not.toBe(context(desktop))
    expect(mainlineReadingAnchorForSession(sessionKey, context(phone), phoneFit.position, retained)).toEqual(phoneFit.position)
    expect(mainlineInteractionRoom(scene, phoneFit.position)?.id).toBe(room.id)
  })

  it('keeps renderer anchor and reading-pan decision stable when page width crosses the pan threshold', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const source = { x: room.bounds.x + .55, y: room.bounds.y + 1.2 }
    const metrics = { width: 390, height: 844, viewportWidth: 390 }
    const owner = activeStorefrontInteriorOwner(scene, source)!
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, source, {}, metrics, new Map())
    const pages = ['短句', '这里是原柜台的点单接触位置，客人可以在这里选择饮品并继续交谈']
    const cameraOffset = { x: 50 - source.x + (40 - metrics.width / 2) / (1920 * .65) * 100, y: 50 - source.y }
    const availableWidth = mainlineAvailableReadingWidthPx(scene, source, metrics, .65, cameraOffset)
    const shortWidth = mainlineEchoLayout(pages[0]!, metrics).widthPx
    const longWidth = mainlineEchoLayout(pages[1]!, metrics).widthPx
    const renderPage = (text: string) => renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={source} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId="commercial-cafe-menu"
      geometrySnapshot={geometrySnapshot} viewportMetrics={metrics} cameraOffset={cameraOffset}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      readingMode="observation" sceneEcho={{ id: 93, entityId: 'commercial-cafe-menu', text, segments: pages, segmentIndex: pages.indexOf(text), position: source, typing: false }}
      visibleInteriorStorefrontIds={[owner]} paintedInteriorStorefrontId={owner}
    />)
    const stableFields = (html: string) => {
      const worldStyle = html.match(/<div(?=[^>]*class="scene-mainline-world[^\"]*")(?=[^>]*style="([^\"]+)")[^>]*>/)?.[1]
      const textStyle = html.match(/<div(?=[^>]*data-scene-echo="commercial-cafe-menu")(?=[^>]*style="([^\"]+)")[^>]*>/)?.[1]
      return {
        world: worldStyle?.match(/transform:([^;]+);/)?.[1],
        text: textStyle?.match(/^(left:[^;]+;top:[^;]+);/)?.[1],
      }
    }
    const shortPage = stableFields(renderPage(pages[0]!))
    const longerPage = stableFields(renderPage(pages[1]!))

    expect(shortWidth).toBeLessThanOrEqual(availableWidth + 1)
    expect(longWidth).toBeGreaterThan(availableWidth + 1)
    expect(shortPage.world).toBeTruthy()
    expect(shortPage.text).toBeTruthy()
    expect(longerPage).toEqual(shortPage)
  })

  it('keeps the real renderer text visible and advances its fitted pages at the 360x550 support floor', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const source = { x: room.bounds.x + .7, y: room.bounds.y + .8 }
    const metrics = { width: 360, height: 550, viewportWidth: 360 }
    const owner = activeStorefrontInteriorOwner(scene, source)!
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, source, {}, metrics, new Map())
    const html = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={source} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId="commercial-cafe-menu"
      geometrySnapshot={geometrySnapshot} viewportMetrics={metrics} cameraOffset={{ x: 50 - source.x, y: 50 - source.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      readingMode="observation" sceneEcho={{ id: 88, entityId: 'commercial-cafe-menu', text: '老周把咖啡放到桌上。你可以先看看店里的菜单，再决定要不要继续聊下去。', segments: ['老周把咖啡放到桌上。你可以先看看店里的菜单，再决定要不要继续聊下去。'], segmentIndex: 0, position: source, typing: false }}
      visibleInteriorStorefrontIds={[owner]} paintedInteriorStorefrontId={owner}
    />)
    const reading = html.match(/<div[^>]*data-scene-echo="commercial-cafe-menu"[^>]*>/)?.[0]
    const segmentCount = Number(reading?.match(/data-scene-segment-count="(\d+)"/)?.[1])
    expect(reading).toBeTruthy()
    expect(reading).not.toContain('visibility:hidden')
    expect(reading).toContain('data-scene-reading-page-fit="true"')
    expect(segmentCount).toBe(2)
    expect(reading).not.toContain('data-scene-reading-paused-for-glyph')
    expect(html).toContain('data-scene-dialogue-shield="true"')
  })

  it('punches the real Cafe L counter segments out of the dimmer while its empty corner stays dimmed', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const parts = scene.continuousStructures.filter(part => part.counterSurface?.groupId === 'cafe-trial-L-counter')
    expect(parts).toHaveLength(2)
    const outlines = parts.map(part => part.counterSurface?.outlineBounds ?? part)
    const holes = mainlineReadingMaskRects(room.bounds, outlines)
    expect(holes).toHaveLength(2)
    const inDimmerHole = (x: number, y: number) => holes.some(hole => {
      const px = (x - room.bounds.x) / room.bounds.width
      const py = (y - room.bounds.y) / room.bounds.height
      return px >= hole.x && px <= hole.x + hole.width && py >= hole.y && py <= hole.y + hole.height
    })
    const localPoint = (x: number, y: number) => ({ x: room.bounds.x + x / 1920 * 100, y: room.bounds.y + y / 1080 * 100 })
    expect(inDimmerHole(localPoint(196, 300).x, localPoint(196, 300).y)).toBe(true)
    expect(inDimmerHole(localPoint(100, 477).x, localPoint(100, 477).y)).toBe(true)
    expect(inDimmerHole(localPoint(100, 300).x, localPoint(100, 300).y)).toBe(false)
  })

  it('keeps the active menu neutral and keyboard focusable while bounding the adjacent wall wrapper', () => {
    const scene = mainlineScenes['commercial-street']
    const cafe = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const source = { x: cafe.bounds.x + cafe.bounds.width / 2, y: cafe.bounds.y + cafe.bounds.height / 2 }
    const owner = activeStorefrontInteriorOwner(scene, source)!
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, source, {}, sceneDesignReferenceMetrics, new Map())
    const renderTarget = (targetId: string) => renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={source} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={targetId}
      geometrySnapshot={geometrySnapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - source.x, y: 50 - source.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      readingMode="observation" sceneEcho={{ id: 5, entityId: targetId, text: '测试文字', segments: ['测试文字'], segmentIndex: 0, position: source, typing: false }}
      visibleInteriorStorefrontIds={[owner]} paintedInteriorStorefrontId={owner}
    />)

    const counterHtml = renderTarget('commercial-cafe-counter')
    const counter = counterHtml.match(/<svg[^>]*data-counter-outline-group="cafe-trial-L-counter"[^>]*>/)?.[0]
    expect(counter).toBeTruthy()
    expect(counter).not.toContain('filter:')
    expect(counterHtml).toContain('data-reading-protection-count=')
    expect(counterHtml).toContain('data-reading-protection-hole="true"')
    expect(counterHtml).toContain('mask:url(#mainline-reading-mask-')

    const menuHtml = renderTarget('commercial-cafe-menu')
    const menuButton = menuHtml.match(/<button[^>]*scene-mainline-menu-feature[^>]*>/)?.[0]
    const menuPlane = menuHtml.match(/<div[^>]*data-reading-occlusion-entity-id="commercial-cafe-menu"[^>]*>/)?.[0]
    const geometryCells = geometrySnapshot.units.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
    const menuEntry = geometryCells.find(({ cell }) => cell.kind === 'feature' && cell.entityId === 'commercial-cafe-menu')!
    const neighboringWallEntry = geometryCells.filter(({ unit, cell }) => unit.sourceWallId === menuEntry.unit.sourceWallId && cell.kind === 'wall' && Math.abs(cell.y - menuEntry.cell.y) < .1 && Math.abs(cell.x - menuEntry.cell.x) > .01)
      .sort((a, b) => Math.abs(a.cell.x - menuEntry.cell.x) - Math.abs(b.cell.x - menuEntry.cell.x))[0]
    expect(menuButton).toBeTruthy()
    expect(menuPlane).toContain('data-reading-occlusion-protected="true"')
    expect(menuPlane).not.toContain('mask-image')
    expect(menuEntry).toBeTruthy()
    expect(neighboringWallEntry).toBeTruthy()
    const neighboringWallPlane = menuHtml.match(new RegExp(`<div[^>]*data-reading-occlusion-key="${neighboringWallEntry?.cell.id}"[^>]*>`))?.[0]
    expect(neighboringWallPlane).not.toContain('data-reading-occlusion-protected')
    expect(neighboringWallPlane).not.toContain('mask-image')
    expect(neighboringWallPlane).toContain('data-reading-world-bounds=')
    expect(neighboringWallPlane).toContain('width:0.8333333333333334%')
    const menuPosition = menuHtml.indexOf('data-reading-occlusion-entity-id="commercial-cafe-menu"')
    const neighborPosition = menuHtml.indexOf(`data-reading-occlusion-key="${neighboringWallEntry?.cell.id}"`)
    const menuSourceIndex = geometryCells.findIndex(({ cell }) => cell.id === menuEntry.cell.id)
    const neighborSourceIndex = geometryCells.findIndex(({ cell }) => cell.id === neighboringWallEntry?.cell.id)
    expect(menuPosition).toBeGreaterThanOrEqual(0)
    expect(neighborPosition).toBeGreaterThanOrEqual(0)
    expect(menuPosition < neighborPosition).toBe(menuSourceIndex < neighborSourceIndex)
    expect(menuButton).toContain('scene-mainline-interaction--normal-unexplored')
    expect(menuButton).not.toMatch(/scene-mainline-interaction--(?:explored|active)/)
    expect(menuButton).not.toContain('filter:')
    expect(menuButton).not.toContain('opacity: 0.82')
    expect(menuButton).not.toContain('disabled=""')
  })

  it('keeps target and same-position neighbor in their source order with bounded identity wrappers', () => {
    const baseScene = mainlineScenes['commercial-street']
    const cafe = baseScene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const target = baseScene.objects.find(entity => entity.roomId === cafe.id && entity.interactive !== false && entity.focusFrame === 'interactive')!
    const neighbor = { ...target, id: 'reading-overlap-neighbor', label: '邻物', interactive: false }
    const scene = { ...baseScene, objects: [...baseScene.objects, neighbor] }
    const source = { x: cafe.bounds.x + cafe.bounds.width / 2, y: cafe.bounds.y + cafe.bounds.height / 2 }
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, source, {}, sceneDesignReferenceMetrics, new Map())
    const html = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={source} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={target.id}
      geometrySnapshot={geometrySnapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - source.x, y: 50 - source.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements debugRuntimeEvidence
      readingMode="observation" sceneEcho={{ id: 91, entityId: target.id, text: '同一位置的文字', segments: ['同一位置的文字'], segmentIndex: 0, position: source, typing: false }}
      visibleInteriorStorefrontIds={[activeStorefrontInteriorOwner(baseScene, source)!]} paintedInteriorStorefrontId={activeStorefrontInteriorOwner(baseScene, source)!}
    />)
    const targetPlane = html.match(new RegExp(`<div[^>]*data-reading-occlusion-entity-id="${target.id}"[^>]*>`))?.[0]
    const neighborPlane = html.match(/<div[^>]*data-reading-occlusion-entity-id="reading-overlap-neighbor"[^>]*>/)?.[0]
    const targetNode = html.match(new RegExp(`<button[^>]*data-object-id="${target.id}"[^>]*>`))?.[0]
    const neighborNode = html.match(/<span[^>]*data-object-id="reading-overlap-neighbor"[^>]*>/)?.[0]
    expect(targetPlane).toContain('data-reading-occlusion-protected="true"')
    expect(targetPlane).not.toContain('mask-image')
    expect(neighborPlane).toBeTruthy()
    expect(neighborPlane).not.toContain('mask-image')
    expect(neighborPlane).toContain('data-reading-world-bounds=')
    expect(neighborPlane).not.toContain('inset:0')
    expect(targetPlane).not.toContain('z-index:')
    expect(neighborPlane).not.toContain('z-index:')
    expect(html.indexOf(`data-reading-occlusion-entity-id="${target.id}"`)).toBeLessThan(html.indexOf('data-reading-occlusion-entity-id="reading-overlap-neighbor"'))
    expect(targetNode).toContain('data-rendered-x=')
    expect(neighborNode).toContain(`data-rendered-x="${targetNode?.match(/data-rendered-x="([^"]+)/)?.[1]}"`)
    expect(neighborNode).toContain(`data-rendered-y="${targetNode?.match(/data-rendered-y="([^"]+)/)?.[1]}"`)
    expect(html).not.toContain('data-reading-mask-progress')
  })

  it('keeps the complete counter surface at its original draw position and masks it by interaction identity', () => {
    const scene = mainlineScenes['commercial-street']
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const parts = scene.continuousStructures.filter(part => part.counterSurface?.groupId === 'cafe-trial-L-counter')
    const targetId = parts[0].counterSurface!.interactionEntityId
    const source = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    const owner = activeStorefrontInteriorOwner(scene, source)!
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, source, {}, sceneDesignReferenceMetrics, new Map())
    const html = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={source} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={targetId}
      geometrySnapshot={geometrySnapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - source.x, y: 50 - source.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      readingMode="observation" sceneEcho={{ id: 94, entityId: targetId, text: '柜台文字', segments: ['柜台文字'], segmentIndex: 0, position: source, typing: false }}
      visibleInteriorStorefrontIds={[owner]} paintedInteriorStorefrontId={owner}
    />)
    const counterPlane = html.match(new RegExp(`<div[^>]*data-reading-occlusion-entity-id="${targetId}"[^>]*>([\\s\\S]*?)<\\/div>`))
    const counterPlaneOpening = counterPlane?.[0].match(/<div[^>]*>/)?.[0]
    expect(counterPlane?.[1]).toContain('data-counter-outline-group="cafe-trial-L-counter"')
    expect(counterPlane?.[0]).toContain('data-reading-occlusion-protected="true"')
    expect(counterPlane?.[0]).not.toContain('mask-image')
    expect(counterPlaneOpening).not.toContain('z-index:')
  })

  it('renders scene actions at their supplied final reading anchor with a bounded reading width', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const position = { x: 42, y: 34 }
    const cameraOffset = { x: 3, y: -2 }
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics, new Map())
    const html = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={geometrySnapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 0, y: 0 }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      sceneAction={{ entityId: 'zhongshuyuan-office-plant', options: ['浇水'], position, cameraOffset }}
      onSceneActionStart={() => {}} onSceneActionChoice={() => {}}
    />)
    const action = html.match(/<div[^>]*data-scene-action="zhongshuyuan-office-plant"[^>]*>/)?.[0]
    expect(action).toContain('scene-mainline-action--reading')
    expect(action).toContain('data-scene-action-position-x="42"')
    expect(action).toContain('data-scene-action-position-y="34"')
    expect(action).toContain('left:45%')
    expect(action).toContain('top:32%')
    expect(action).toMatch(/max-width:\d+(?:\.\d+)?px/)
    expect(html).toContain('data-entry-id="scene-action:zhongshuyuan-office-plant:浇水"')
  })

  it.each([
    { name: 'desktop', metrics: { width: 1280, height: 800, viewportWidth: 1280 }, scale: 0.65 },
    { name: 'narrow phone', metrics: { width: 360, height: 550, viewportWidth: 360 }, scale: 0.65 },
  ])('fits the measured two-option group at both room edges on $name', ({ metrics, scale }) => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const room = scene.rooms.find(candidate => candidate.kind !== 'boundary' && candidate.kind !== 'corridor')!
    for (const edge of ['top', 'bottom'] as const) {
      const position = {
        x: room.bounds.x + room.bounds.width / 2,
        y: edge === 'top' ? room.bounds.y + 1 : room.bounds.y + room.bounds.height - 1,
      }
      const cameraOffset = { x: 50 - position.x, y: 50 - position.y }
      const measured = mainlinePlaceReadingAction(scene, position, { width: 250, height: 118 }, metrics, scale, cameraOffset)
      expect(measured).not.toBeNull()
      const safe = measured!
      const bounds = mainlineReadingBounds(scene, position, metrics, scale, cameraOffset)
      const widthPercent = Math.min(250, safe.availableWidthPx) / (sceneDesignReferenceMetrics.width * scale) * 100
      const heightPercent = Math.min(118, safe.availableHeightPx) / (sceneDesignReferenceMetrics.height * scale) * 100
      expect(safe.position.x - widthPercent / 2).toBeGreaterThanOrEqual(bounds.x - 1e-6)
      expect(safe.position.x + widthPercent / 2).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-6)
      expect(safe.position.y - heightPercent / 2).toBeGreaterThanOrEqual(bounds.y - 1e-6)
      expect(safe.position.y + heightPercent / 2).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-6)
      expect(safe.position.y).not.toBe(position.y)
      expect(safe.overflowY).toBe(false)
    }
  })

  it('bounds an oversized option list in the same room and exposes vertical scrolling', () => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const room = scene.rooms.find(candidate => candidate.kind !== 'boundary' && candidate.kind !== 'corridor')!
    const position = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + 1 }
    const placement = mainlinePlaceReadingAction(scene, position, { width: 250, height: 900 }, { width: 360, height: 550, viewportWidth: 360 }, 0.65, { x: 50 - position.x, y: 50 - position.y })
    expect(placement).not.toBeNull()
    expect(placement!.overflowY).toBe(true)
    expect(placement!.availableHeightPx).toBeGreaterThan(0)
    expect(placement!.position.y).toBeGreaterThan(position.y)
  })
})

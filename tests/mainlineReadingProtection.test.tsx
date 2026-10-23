import { describe, expect, it } from 'vitest'
import { currentMainlineReadingTargetIds, mainlineFitReadingText, mainlinePlaceReadingBox, mainlineReadingMaskRects, mainlineReadingOverflowPageForSession, mainlineReadingOverflowPageIndex } from '../src/center/runtime/mainlineReadingProtection'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineReadingBounds, mainlineInteractionRoom } from '../src/center/runtime/mainlineTextReading'
import { projectCommercialStreetX } from '../src/center/runtime/commercialStreetGridProjection'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { activeStorefrontInteriorOwner } from '../src/center/runtime/storefrontPresentation'

describe('reading target protection', () => {
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
    expect(result.segments.join('')).toBe(text)
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

  it('protects the complete interactive L counter and keeps an active menu neutral and keyboard focusable', () => {
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
    expect(menuButton).toBeTruthy()
    expect(menuButton).toContain('scene-mainline-interaction--normal-unexplored')
    expect(menuButton).not.toMatch(/scene-mainline-interaction--(?:explored|active)/)
    expect(menuButton).not.toContain('filter:')
    expect(menuButton).not.toContain('opacity: 0.82')
    expect(menuButton).not.toContain('disabled=""')
  })
})

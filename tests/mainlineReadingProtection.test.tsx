import { describe, expect, it } from 'vitest'
import { currentMainlineReadingTargetIds, mainlinePlaceReadingBox, mainlineReadingMaskRects } from '../src/center/runtime/mainlineReadingProtection'
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
    const metrics = { width: 390, height: 550, viewportWidth: 390 }
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

  it('does not render text in a room too small for a complete non-overlapping reading box', () => {
    const base = mainlineScenes['commercial-street']
    const tinyRoom = { id: 'tiny-test-room', kind: 'room' as const, bounds: { x: 40, y: 40, width: 1, height: 1 } }
    const scene = { ...base, rooms: [tinyRoom] }
    const source = { x: 40.5, y: 40.5 }
    expect(mainlinePlaceReadingBox(scene, source, { width: 120, height: 36 }, [{ x: 40.4, y: 40.4, width: .2, height: .2 }], { width: 390, height: 844 }, .65, { x: 9.5, y: 9.5 })).toBeNull()
  })

  it('punches only the protected counter legs out of the dimmer, not the empty L corner', () => {
    const holes = mainlineReadingMaskRects({ x: 0, y: 0, width: 100, height: 100 }, [
      { x: 10, y: 10, width: 5, height: 40 },
      { x: 15, y: 45, width: 40, height: 5 },
    ])
    expect(holes).toHaveLength(2)
    expect(holes[0]).toMatchObject({ x: .1, y: .1, height: .4 })
    expect(holes[0]!.width).toBeCloseTo(.05, 10)
    expect(holes[1]).toMatchObject({ x: .15, y: .45, width: .4 })
    expect(holes[1]!.height).toBeCloseTo(.05, 10)
    expect(holes).toHaveLength(2)
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

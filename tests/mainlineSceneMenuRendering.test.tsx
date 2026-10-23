import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes, type MainlineSceneDefinition } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { activeStorefrontInteriorOwner, type StorefrontPresentationPhase } from '../src/center/runtime/storefrontPresentation'
import type { Point } from '../src/center/runtime/sceneGeometry'

const fixtures = [
  { sceneId: 'commercial-street', menuId: 'commercial-cafe-menu' },
  { sceneId: 'commercial-street', menuId: 'commercial-s5-milk-tea-menu-service-label' },
  { sceneId: 'commercial-street', menuId: 'fruit-tea-trial-menu' },
  { sceneId: 'yonghe-eatery', menuId: 'yonghe-menu' },
] as const
const phases: StorefrontPresentationPhase[] = ['baseline', 'retracting', 'revealing', 'revealed', 'lingering', 'restoring']

type Fixture = typeof fixtures[number] & {
  scene: MainlineSceneDefinition
  roomId: string
  ownerId: string
  inside: Point
  outside: Point
  cells: Array<{ id: string; x: number; y: number; glyph: string; baselineGlyph?: string; featureCellRole?: string }>
}
const resolvedFixtures: Fixture[] = fixtures.map(fixture => {
  const scene = mainlineScenes[fixture.sceneId]
  const entity = scene.objects.find(candidate => candidate.id === fixture.menuId)!
  const room = scene.rooms.find(candidate => candidate.id === entity.roomId)!
  const inside = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
  const ownerId = activeStorefrontInteriorOwner(scene, inside)!
  const units = createMainlineSceneGeometrySnapshot(scene, inside, {}, sceneDesignReferenceMetrics, new Map()).units
  const cells = units.flatMap(unit => unit.visual.cells).filter(cell => cell.kind === 'feature' && cell.entityId === fixture.menuId)
  return { ...fixture, scene, roomId: room.id, ownerId, inside, outside: { x: room.bounds.x - 5, y: room.bounds.y - 5 }, cells }
})

function render(fixture: Fixture, mode: 'active' | 'retained' | 'unowned', phase: StorefrontPresentationPhase) {
  const position = mode === 'active' ? fixture.inside : fixture.outside
  const visible = mode === 'active' || mode === 'retained' ? [fixture.ownerId] : []
  const painted = mode === 'active' ? fixture.ownerId : null
  const storefrontPresentation = new Map([[fixture.ownerId, phase]])
  const geometrySnapshot = createMainlineSceneGeometrySnapshot(fixture.scene, position, {}, sceneDesignReferenceMetrics, storefrontPresentation)
  const x = fixture.cells.find(cell => cell.featureCellRole === 'content')?.x ?? 50
  const y = fixture.cells.find(cell => cell.featureCellRole === 'content')?.y ?? 50
  return renderToStaticMarkup(<MainlineSceneRenderer
    scene={fixture.scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
    geometrySnapshot={geometrySnapshot} viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - x, y: 50 - y }}
    onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
    storefrontPresentation={storefrontPresentation} activeStorefrontId={null} visibleInteriorStorefrontIds={visible} paintedInteriorStorefrontId={painted}
  />)
}

function tagsAt(html: string, cell: { x: number; y: number }, className: string) {
  return [...html.matchAll(/<span\b[^>]*>/g)].map(match => match[0]).filter(tag =>
    tag.includes(className) && tag.includes(`left:${cell.x}%`) && tag.includes(`top:${cell.y}%`))
}

describe('menu wall cells render independently through owner and portal states', () => {
  it.each(resolvedFixtures)('$menuId restores every occupied wall cell and keeps flanks ordinary', fixture => {
    const content = fixture.cells.filter(cell => cell.featureCellRole === 'content')
    const flanks = fixture.cells.filter(cell => cell.featureCellRole === 'flank')
    expect(content.length, `${fixture.menuId} authored menu wall cells`).toBeGreaterThanOrEqual(2)

    for (const phase of phases) {
      const activeHtml = render(fixture, 'active', phase)
      for (const cell of content) {
        const wallTags = tagsAt(activeHtml, cell, 'scene-mainline-wall')
        expect(wallTags, `${fixture.menuId}/${phase} painted owner wall layer at ${cell.x},${cell.y}`).toHaveLength(1)
        expect(activeHtml, `${fixture.menuId}/${phase} shared menu focus group`).toContain('scene-mainline-wall-feature--interaction')
        expect(activeHtml, `${fixture.menuId}/${phase} menu focus group owns its first glyph cell`).toContain(`data-focus-target-id=\"${content[0]!.id}\"`)
      }
      for (const cell of flanks) {
        const flankTags = tagsAt(activeHtml, cell, 'scene-mainline-wall')
        expect(flankTags, `${fixture.menuId}/${phase} flank at ${cell.x},${cell.y}`).toHaveLength(1)
        expect(flankTags[0]).not.toMatch(/(?:opacity|filter):/)
      }

      const retainedHtml = render(fixture, 'retained', phase)
      for (const cell of content) {
        expect(tagsAt(retainedHtml, cell, 'scene-mainline-wall'), `${fixture.menuId}/${phase} retained wall at ${cell.x},${cell.y}`).toHaveLength(1)
      }

      const unownedHtml = render(fixture, 'unowned', phase)
      for (const cell of content) {
        const wallTags = tagsAt(unownedHtml, cell, 'scene-mainline-wall')
        expect(wallTags, `${fixture.menuId}/${phase} unowned wall at ${cell.x},${cell.y}`).toHaveLength(1)
        expect(unownedHtml, `${fixture.menuId}/${phase} no orphan menu focus group`).not.toContain('scene-mainline-wall-feature--interaction')
      }
      for (const cell of flanks) {
        const wallTags = tagsAt(unownedHtml, cell, 'scene-mainline-wall')
        expect(wallTags, `${fixture.menuId}/${phase} unowned flank at ${cell.x},${cell.y}`).toHaveLength(1)
        expect(wallTags[0]).not.toMatch(/(?:opacity|filter):/)
      }
    }
  })
})

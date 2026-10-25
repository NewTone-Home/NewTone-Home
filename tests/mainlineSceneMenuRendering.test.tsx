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
  cells: Array<{ id: string; x: number; y: number; glyph: string; baselineGlyph?: string; featureCellRole?: string; layoutOrientation?: 'horizontal' | 'vertical'; orientation?: 'horizontal' | 'vertical'; cellStart?: number; cellEnd?: number }>
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

function divSegmentAt(html: string, start: number, openEnd: number) {
  let depth = 1
  const divTags = /<\/?div\b[^>]*>/g
  divTags.lastIndex = openEnd
  let match: RegExpExecArray | null
  while ((match = divTags.exec(html))) {
    if (match[0].startsWith('</')) depth -= 1
    else if (!match[0].endsWith('/>')) depth += 1
    if (depth === 0) return html.slice(start, divTags.lastIndex)
  }
  return null
}

function extractSpan(html: string, start: number) {
  const spanTags = /<\/?span\b[^>]*>/g
  spanTags.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = spanTags.exec(html))) {
    if (match[0].startsWith('</')) depth -= 1
    else if (!match[0].endsWith('/>')) depth += 1
    if (depth === 0) return html.slice(start, spanTags.lastIndex)
  }
  return html.slice(start, html.indexOf('>', start) + 1)
}

function renderedWallGlyphs(html: string) {
  const wrappers = [...html.matchAll(/<div\b[^>]*class="[^"]*scene-mainline-reading-identity-plane--wall[^"]*"[^>]*>/g)]
  const glyphs: Array<{ x: number; y: number; tag: string }> = []
  for (const match of wrappers) {
    const wrapperStart = match.index!
    const wrapperTag = match[0]
    const wrapperEnd = wrapperStart + wrapperTag.length
    const segment = divSegmentAt(html, wrapperStart, wrapperEnd)
    const boundsValue = wrapperTag.match(/data-reading-world-bounds="([^"]+)"/)?.[1]
    const bounds = boundsValue?.split(',').map(Number)
    if (!segment || bounds?.length !== 4 || !bounds.every(Number.isFinite)) continue
    const inner = segment.slice(wrapperTag.length)
    for (const spanMatch of inner.matchAll(/<span\b[^>]*>/g)) {
      const classes = spanMatch[0].match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? []
      if (!classes.includes('scene-mainline-wall')) continue
      const style = spanMatch[0].match(/style="([^"]*)"/)?.[1] ?? ''
      const left = Number(style.match(/(?:^|;)left:([-\d.]+)%/)?.[1])
      const top = Number(style.match(/(?:^|;)top:([-\d.]+)%/)?.[1])
      if (!Number.isFinite(left) || !Number.isFinite(top)) continue
      glyphs.push({
        x: bounds[0]! + bounds[2]! * left / 100,
        y: bounds[1]! + bounds[3]! * top / 100,
        tag: extractSpan(inner, spanMatch.index!),
      })
    }
  }
  return glyphs
}

function cellWallMarkup(html: string, cell: { x: number; y: number }) {
  const x = cell.x / 100 * sceneDesignReferenceMetrics.width
  const y = cell.y / 100 * sceneDesignReferenceMetrics.height
  return renderedWallGlyphs(html).filter(glyph => Math.abs(glyph.x - x) < .05 && Math.abs(glyph.y - y) < .05)
}

describe('menu wall cells render independently through owner and portal states', () => {
  it.each(resolvedFixtures)('$menuId keeps the transparent hit target on the wall-cell axis while glyphs stay upright', fixture => {
    const content = fixture.cells.filter(cell => cell.featureCellRole === 'content')
    expect(content.length).toBeGreaterThanOrEqual(2)
    expect(content.every(cell => cell.layoutOrientation === 'vertical')).toBe(true)
    expect(content.every(cell => cell.orientation === 'horizontal')).toBe(true)

    const html = render(fixture, 'active', 'revealed')
    const firstCell = content[0]!
    const targetPattern = new RegExp(`<button\\b(?=[^>]*data-focus-target-id="${firstCell.id}")[^>]*>`)
    const target = html.match(targetPattern)?.[0]
    expect(target, `${fixture.menuId} renders an interactive group at its first menu cell`).toBeTruthy()
    const style = target!.match(/style="([^"]+)"/)?.[1] ?? ''
    const top = Number(style.match(/(?:^|;)top:([-\.\d]+)%/)?.[1])
    const height = Number(style.match(/(?:^|;)height:([-\.\d]+)%/)?.[1])
    expect(Number.isFinite(top), `${fixture.menuId} hit target has a vertical center`).toBe(true)
    expect(Number.isFinite(height), `${fixture.menuId} hit target has a vertical extent`).toBe(true)

    const marker = `data-reading-occlusion-entity-id="${fixture.menuId}"`
    const markerIndex = html.indexOf(marker)
    expect(markerIndex, `${fixture.menuId} has its bounded identity wrapper`).toBeGreaterThanOrEqual(0)
    const wrapperStart = html.lastIndexOf('<div', markerIndex)
    const wrapperTag = html.slice(wrapperStart, html.indexOf('>', markerIndex) + 1)
    const worldBounds = wrapperTag.match(/data-reading-world-bounds="([^"]+)"/)?.[1]?.split(',').map(Number)
    expect(worldBounds, `${fixture.menuId} wrapper exposes its world bounds`).toHaveLength(4)
    const [, worldY, , worldHeight] = worldBounds!
    const renderedCenterY = worldY! + worldHeight! * top! / 100
    const renderedSpanY = worldHeight! * height! / 100
    const expectedStartY = Math.min(...content.map(cell => cell.cellStart!)) / 100 * sceneDesignReferenceMetrics.height
    const expectedEndY = Math.max(...content.map(cell => cell.cellEnd!)) / 100 * sceneDesignReferenceMetrics.height
    expect(renderedCenterY).toBeCloseTo((expectedStartY + expectedEndY) / 2, 3)
    expect(renderedSpanY).toBeCloseTo(expectedEndY - expectedStartY, 3)
  })

  it.each(resolvedFixtures)('$menuId restores every occupied wall cell and keeps flanks ordinary', fixture => {
    const content = fixture.cells.filter(cell => cell.featureCellRole === 'content')
    const flanks = fixture.cells.filter(cell => cell.featureCellRole === 'flank')
    expect(content.length, `${fixture.menuId} authored menu wall cells`).toBeGreaterThanOrEqual(2)

    for (const phase of phases) {
      const activeHtml = render(fixture, 'active', phase)
      for (const cell of content) {
        const wallTags = cellWallMarkup(activeHtml, cell)
        expect(wallTags, `${fixture.menuId}/${phase} painted owner wall layer at cell ${cell.id}`).toHaveLength(1)
        expect(wallTags[0]!.x).toBeCloseTo(cell.x / 100 * sceneDesignReferenceMetrics.width, 4)
        expect(wallTags[0]!.y).toBeCloseTo(cell.y / 100 * sceneDesignReferenceMetrics.height, 4)
        expect(activeHtml, `${fixture.menuId}/${phase} shared menu focus group`).toContain('scene-mainline-wall-feature--interaction')
        expect(activeHtml, `${fixture.menuId}/${phase} menu focus group owns its first glyph cell`).toContain(`data-focus-target-id=\"${content[0]!.id}\"`)
      }
      for (const cell of flanks) {
        const wallTags = cellWallMarkup(activeHtml, cell)
        expect(wallTags, `${fixture.menuId}/${phase} flank cell ${cell.id}`).toHaveLength(1)
        expect(wallTags[0]!.x).toBeCloseTo(cell.x / 100 * sceneDesignReferenceMetrics.width, 4)
        expect(wallTags[0]!.y).toBeCloseTo(cell.y / 100 * sceneDesignReferenceMetrics.height, 4)
        expect(wallTags[0]!.tag).not.toMatch(/(?:opacity|filter):/)
      }

      const retainedHtml = render(fixture, 'retained', phase)
      for (const cell of content) {
        const wallTags = cellWallMarkup(retainedHtml, cell)
        expect(wallTags, `${fixture.menuId}/${phase} retained wall cell ${cell.id}`).toHaveLength(1)
        expect(wallTags[0]!.x).toBeCloseTo(cell.x / 100 * sceneDesignReferenceMetrics.width, 4)
        expect(wallTags[0]!.y).toBeCloseTo(cell.y / 100 * sceneDesignReferenceMetrics.height, 4)
        expect(wallTags[0]!.tag).toContain('>墙<')
        expect(wallTags[0]!.tag).not.toMatch(/opacity:\s*1(?:[;}]|$)/)
      }

      const unownedHtml = render(fixture, 'unowned', phase)
      for (const cell of content) {
        const wallTags = cellWallMarkup(unownedHtml, cell)
        expect(wallTags, `${fixture.menuId}/${phase} unowned wall cell ${cell.id}`).toHaveLength(1)
        expect(wallTags[0]!.x).toBeCloseTo(cell.x / 100 * sceneDesignReferenceMetrics.width, 4)
        expect(wallTags[0]!.y).toBeCloseTo(cell.y / 100 * sceneDesignReferenceMetrics.height, 4)
        expect(wallTags[0]!.tag).toContain('>墙<')
        expect(wallTags[0]!.tag).not.toMatch(/opacity:\s*1(?:[;}]|$)/)
        expect(unownedHtml, `${fixture.menuId}/${phase} no orphan menu focus group`).not.toContain('scene-mainline-wall-feature--interaction')
      }
      for (const cell of flanks) {
        const wallTags = cellWallMarkup(unownedHtml, cell)
        expect(wallTags, `${fixture.menuId}/${phase} unowned flank cell ${cell.id}`).toHaveLength(1)
        expect(wallTags[0]!.x).toBeCloseTo(cell.x / 100 * sceneDesignReferenceMetrics.width, 4)
        expect(wallTags[0]!.y).toBeCloseTo(cell.y / 100 * sceneDesignReferenceMetrics.height, 4)
        expect(wallTags[0]!.tag).not.toMatch(/(?:opacity|filter):/)
      }
    }
  })
})

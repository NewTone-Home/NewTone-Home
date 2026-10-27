import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineReadingIdentityPlane } from '../src/center/runtime/MainlineReadingIdentityPlane'
import { mainlineReadingLocalFadeMask, mainlineReadingOcclusionCellIdentity, mainlineReadingOcclusionIntersects, mainlineReadingOcclusionRect, mainlineReadingLocalPercent, mainlineReadingOccludedIdentityKeys, mainlineReadingWorldBox, retainMainlineReadingOcclusionSnapshot } from '../src/center/runtime/mainlineReadingOcclusion'

describe('mainline whole-object reading occlusion', () => {
  it('maps a reading layout to the design world without changing its screen size', () => {
    const rect = mainlineReadingOcclusionRect({ x: 50, y: 50 }, { widthPx: 320, heightPx: 160 }, .65)
    expect(rect.x + rect.width / 2).toBe(960)
    expect(rect.y + rect.height / 2).toBe(540)
    expect(rect.width * .65).toBeCloseTo(320)
    expect(rect.height * .65).toBeCloseTo(160)
  })

  it('uses a one-character hit margin in world units across viewport scales', () => {
    for (const viewportWidth of [360, 411, 1280, 1920]) {
      for (const worldScale of [.65, 1]) {
        const cssWidth = Math.max(120, Math.min(600, viewportWidth - 24))
        const rect = mainlineReadingOcclusionRect({ x: 50, y: 50 }, { widthPx: cssWidth, heightPx: 60 }, worldScale)
        expect(rect.width * worldScale).toBeCloseTo(cssWidth)
        expect(mainlineReadingOcclusionIntersects({ x: rect.x + rect.width + 15, y: rect.y + 8, width: 1, height: 1 }, rect)).toBe(true)
        expect(mainlineReadingOcclusionIntersects({ x: rect.x + rect.width + 17, y: rect.y + 8, width: 1, height: 1 }, rect)).toBe(false)
      }
    }
  })

  it('hides whole identities hit by the envelope, protecting targets and other spaces', () => {
    const rect = { x: 100, y: 200, width: 300, height: 80 }
    const keys = mainlineReadingOccludedIdentityKeys([
      { identityKey: 'counter:bar', entityId: 'counter-entity', bounds: { x: 170, y: 210, width: 280, height: 32 }, spaceId: 'room-a' },
      { identityKey: 'chair:one', bounds: { x: 200, y: 220, width: 20, height: 20 }, spaceId: 'room-a' },
      { identityKey: 'wall-cell:neighbor', bounds: { x: 380, y: 210, width: 16, height: 16 }, spaceId: 'room-a' },
      { identityKey: 'wall-cell:other-room', bounds: { x: 200, y: 220, width: 20, height: 20 }, spaceId: 'room-b' },
    ], rect, new Set(['counter-entity']), 'room-a')
    expect(keys).toEqual(new Set(['chair:one', 'wall-cell:neighbor']))
  })

  it('uses one space-scoped identity for every glyph and frame cell in a menu group', () => {
    const menuGroup = 'interactive:cafe-menu'
    const room = 'cafe-room'
    const menuKey = mainlineReadingOcclusionCellIdentity('menu-cell-1', menuGroup, room)
    expect(mainlineReadingOcclusionCellIdentity('menu-cell-2', menuGroup, room)).toBe(menuKey)
    expect(mainlineReadingOcclusionCellIdentity('menu-frame', menuGroup, room)).toBe(menuKey)
    expect(mainlineReadingOcclusionCellIdentity('neighbor-wall-cell')).toBe('neighbor-wall-cell')
    expect(mainlineReadingOcclusionCellIdentity('menu-cell-1', menuGroup, 'other-room')).not.toBe(menuKey)

    const rect = { x: 100, y: 100, width: 120, height: 48 }
    const hidden = mainlineReadingOccludedIdentityKeys([
      { identityKey: menuKey, entityId: 'cafe-menu', bounds: { x: 110, y: 110, width: 88, height: 28 }, spaceId: room },
      { identityKey: 'neighbor-wall-cell', entityId: 'wall', bounds: { x: 110, y: 110, width: 16, height: 16 }, spaceId: room },
      { identityKey: mainlineReadingOcclusionCellIdentity('menu-cell-1', menuGroup, 'other-room'), entityId: 'cafe-menu', bounds: { x: 110, y: 110, width: 88, height: 28 }, spaceId: 'other-room' },
    ], rect, new Set(), room)
    expect(hidden).toEqual(new Set([menuKey, 'neighbor-wall-cell']))
    expect(hidden.has(mainlineReadingOcclusionCellIdentity('menu-cell-2', menuGroup, room))).toBe(true)
    expect(hidden.has(mainlineReadingOcclusionCellIdentity('menu-frame', menuGroup, room))).toBe(true)
    expect(hidden.has(mainlineReadingOcclusionCellIdentity('menu-cell-1', menuGroup, 'other-room'))).toBe(false)
  })

  it('protects the complete menu group while leaving a coincident neighboring wall eligible', () => {
    const menuKey = mainlineReadingOcclusionCellIdentity('menu-first-cell', 'interactive:menu', 'cafe-room')
    const neighborKey = 'wall-cell:adjacent'
    const hidden = mainlineReadingOccludedIdentityKeys([
      { identityKey: menuKey, entityId: 'menu', bounds: { x: 10, y: 10, width: 40, height: 30 }, spaceId: 'cafe-room' },
      { identityKey: neighborKey, entityId: 'adjacent-wall', bounds: { x: 10, y: 10, width: 40, height: 30 }, spaceId: 'cafe-room' },
    ], { x: 0, y: 0, width: 80, height: 60 }, new Set(['menu']), 'cafe-room')
    expect(hidden).toEqual(new Set([neighborKey]))
  })

  it('converts scene bounds to the bounded wrapper coordinates without a second projection', () => {
    const bounds = mainlineReadingWorldBox({ x: 20, y: 30, width: 4, height: 5 })
    expect(bounds.x).toBe(384)
    expect(bounds.y).toBe(324)
    expect(bounds.width).toBeCloseTo(76.8)
    expect(bounds.height).toBe(54)
    expect(mainlineReadingLocalPercent({ x: 22, y: 32.5 }, bounds)).toEqual({ x: 50, y: 50 })
  })

  it('freezes the max envelope and hit set through pages, recalculating for a changed viewport', () => {
    const current = { sessionKey: 'dialogue:1', contextKey: '411x914@.65', rect: { x: 20, y: 30, width: 400, height: 80 }, protectedEntityIds: new Set(['npc']), hiddenIdentityKeys: new Set(['counter:a']) }
    const nextPage = { ...current, rect: { x: 90, y: 40, width: 300, height: 40 }, hiddenIdentityKeys: new Set(['chair:b']) }
    expect(retainMainlineReadingOcclusionSnapshot(current, nextPage)).toBe(current)
    const resized = { ...nextPage, contextKey: '1920x1080@1' }
    expect(retainMainlineReadingOcclusionSnapshot(current, resized)).toBe(resized)
  })

  it('hides a hit visual wrapper as a whole while keeping its protected neighbor visible', () => {
    const bounds = { x: 92, y: 192, width: 32, height: 32 }
    const html = renderToStaticMarkup(<>
      <MainlineReadingIdentityPlane entityId="menu" identityKey="menu" worldBounds={bounds} hiddenIdentityKeys={new Set(['menu'])} active protectedEntityIds={new Set(['menu'])}>
        <span data-overlap="target-menu">menu</span>
      </MainlineReadingIdentityPlane>
      <MainlineReadingIdentityPlane entityId="neighbor-wall" identityKey="neighbor-wall" worldBounds={bounds} hiddenIdentityKeys={new Set(['neighbor-wall'])} active protectedEntityIds={new Set(['menu'])}>
        <span data-overlap="neighbor-wall">wall</span>
      </MainlineReadingIdentityPlane>
    </>)
    const target = html.match(/<div[^>]*data-reading-occlusion-entity-id="menu"[^>]*>/)?.[0]
    const neighbor = html.match(/<div[^>]*data-reading-occlusion-entity-id="neighbor-wall"[^>]*>/)?.[0]
    expect(target).toContain('data-reading-occlusion-protected="true"')
    expect(target).not.toContain('data-reading-occlusion-hidden')
    expect(neighbor).toContain('data-reading-occlusion-hidden="true"')
    expect(neighbor).toContain('opacity:0')
    expect(neighbor).toContain('inert=""')
    expect(neighbor).not.toContain('mask-image')
  })

  it('applies the 380ms dialogue-stage fade to the identity wrapper itself', () => {
    const bounds = { x: 92, y: 192, width: 32, height: 32 }
    const html = renderToStaticMarkup(<MainlineReadingIdentityPlane entityId="table" identityKey="object:table" worldBounds={bounds} active protectedEntityIds={new Set()} stageFaded className="scene-mainline-dialogue-stage-object is-stage-faded">
      <span>table</span>
    </MainlineReadingIdentityPlane>)
    const table = html.match(/<div[^>]*data-reading-occlusion-entity-id="table"[^>]*>/)?.[0]
    expect(table).toContain('opacity:0')
    expect(table).toContain('transition:opacity 380ms ease-in-out')
  })

  it('uses an object-local transparent centre and a soft outer gradient for observations, while preserving protected targets', () => {
    const bounds = { x: 0, y: 0, width: 220, height: 120 }
    const rect = { x: 80, y: 40, width: 60, height: 24 }
    const mask = mainlineReadingLocalFadeMask(bounds, rect, 32, 48)
    expect(mask).toContain('radial-gradient(ellipse')
    expect(mask).toContain('transparent 0%')
    expect(mask).toContain('#000 100%)')

    const html = renderToStaticMarkup(<>
      <MainlineReadingIdentityPlane entityId="plant" identityKey="object:plant" worldBounds={bounds} observationFade={{ rect, innerMarginWorldPx: 32, featherWorldPx: 48 }} hiddenIdentityKeys={new Set(['object:plant'])} active protectedEntityIds={new Set(['door'])}>
        <span>plant</span>
      </MainlineReadingIdentityPlane>
      <MainlineReadingIdentityPlane entityId="door" identityKey="door" worldBounds={bounds} observationFade={{ rect, innerMarginWorldPx: 32, featherWorldPx: 48 }} active protectedEntityIds={new Set(['door'])}>
        <span>door</span>
      </MainlineReadingIdentityPlane>
    </>)
    const plant = html.match(/<div[^>]*data-reading-occlusion-entity-id="plant"[^>]*>/)?.[0]
    const door = html.match(/<div[^>]*data-reading-occlusion-entity-id="door"[^>]*>/)?.[0]
    expect(plant).toContain('data-reading-observation-fade="true"')
    expect(plant).not.toContain('data-reading-occlusion-hidden')
    expect(plant).toContain('mask-image:radial-gradient')
    expect(door).toContain('data-reading-occlusion-protected="true"')
    expect(door).not.toContain('data-reading-observation-fade')
  })
})

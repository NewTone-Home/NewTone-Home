import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineCanonicalSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { storefrontCharacterCells } from '../src/center/runtime/storefrontPresentation'

describe('Yonghe double front doors', () => {
  it('keeps one shared passage but gives each door cell its own focus frame', () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const slot = scene.storefronts.find(candidate => candidate.id === 'yonghe-slot-2')!
    const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
    const cells = storefrontCharacterCells(scene, slot, units)
    const doorCells = cells.filter(cell => cell.role === 'door')
    expect(doorCells).toHaveLength(2)
    expect(new Set(doorCells.map(cell => cell.id)).size).toBe(2)

    const room = scene.rooms.find(candidate => candidate.id === 'mining-shop-2-interior')!
    const position = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
    const phases = new Map([[slot.id, 'baseline' as const]])
    const markup = renderToStaticMarkup(<MainlineSceneRenderer
      scene={scene} position={position} moving={false} destination={null} layoutMode={false} layout={{}} activeObjectId={null}
      geometrySnapshot={createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics, phases)}
      viewportMetrics={sceneDesignReferenceMetrics} cameraOffset={{ x: 50 - position.x, y: 50 - position.y }}
      onLayoutChange={() => {}} onInteract={() => {}} onWalk={() => {}} freezeFrameMeasurements
      storefrontPresentation={phases} activeStorefrontId={null} visibleInteriorStorefrontIds={[]} paintedInteriorStorefrontId={null}
    />)

    const doorCellIds = new Set(doorCells.map(cell => cell.id))
    const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
      .filter(tag => [...doorCellIds].some(id => tag.includes(`data-storefront-cell-id="${id}"`))
        && tag.includes('data-storefront-presentation-phase="baseline"'))
    expect(buttons).toHaveLength(2)
    const groups = buttons.map(tag => tag.match(/data-focus-target-group="([^"]+)"/)?.[1])
    expect(groups.every(Boolean)).toBe(true)
    expect(new Set(groups).size).toBe(2)
    expect(groups.every(group => group!.startsWith('storefront-door:yonghe-slot-2:cell:'))).toBe(true)
    expect(buttons.every(tag => tag.includes('data-focus-passage-phase="closed"'))).toBe(true)
    expect(buttons.every(tag => tag.includes('data-focus-target-policy="passage"'))).toBe(true)
    expect(buttons.every(tag => tag.includes('aria-label='))).toBe(true)
  })
})

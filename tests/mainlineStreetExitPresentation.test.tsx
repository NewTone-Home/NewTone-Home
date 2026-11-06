import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MainlineSceneRenderer } from '../src/center/runtime/MainlineSceneRenderer'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineEntityIsPublicStreetContent, mainlinePublicStreetPresentationIsActive } from '../src/center/runtime/mainlineSceneModel'
import type { MainlineSceneDefinition } from '../src/center/runtime/mainlineScenes'

const rendererProps = (scene: MainlineSceneDefinition, position: { x: number; y: number }) => ({
  scene,
  position,
  moving: false,
  destination: null,
  layoutMode: false,
  layout: {},
  activeObjectId: null,
  geometrySnapshot: createMainlineSceneGeometrySnapshot(scene, position, {}, sceneDesignReferenceMetrics),
  viewportMetrics: sceneDesignReferenceMetrics,
  cameraOffset: { x: 0, y: 0 },
  onLayoutChange: () => {},
  onInteract: () => {},
  onWalk: () => {},
  freezeFrameMeasurements: true,
})

describe('street visual exit presentation', () => {
  it('keeps street entities owned by the public lane while an interior owns logic', () => {
    const street = mainlineScenes['commercial-street']
    const interior = street.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
    const inside = { x: interior.bounds.x + interior.bounds.width / 2, y: interior.bounds.y + interior.bounds.height / 2 }
    const outside = street.rooms.find(room => room.id === 'commercial-street-public-lane')!.bounds
    const streetPoint = { x: outside.x + outside.width / 2, y: outside.y + outside.height / 2 }
    const laneId = 'commercial-street-public-lane'
    const outdoorDoor = street.objects.find(entity => entity.kind === 'door' && !entity.roomId)!

    expect(mainlinePublicStreetPresentationIsActive(street, streetPoint)).toBe(true)
    expect(mainlinePublicStreetPresentationIsActive(street, inside)).toBe(false)
    expect(mainlineEntityIsPublicStreetContent(street.id, outdoorDoor)).toBe(false)
    expect(mainlineEntityIsPublicStreetContent(street.id, { kind: 'fixture', roomId: undefined, spaceId: laneId })).toBe(true)
    expect(mainlineEntityIsPublicStreetContent(street.id, { kind: 'fixture', roomId: undefined, spaceId: undefined })).toBe(false)
    expect(mainlineEntityIsPublicStreetContent(street.id, { kind: 'fixture', roomId: interior.id, spaceId: laneId })).toBe(false)
    expect(mainlineEntityIsPublicStreetContent('jijia-ancestral-home', outdoorDoor)).toBe(false)
  })

  it('renders explicit mining-lane objects during entry fade but disables them immediately', () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const interior = scene.rooms.find(room => room.id === 'mining-shop-2-interior')!
    const inside = { x: interior.bounds.x + interior.bounds.width / 2, y: interior.bounds.y + interior.bounds.height / 2 }
    const outdoor = scene.objects.find(entity => mainlineEntityIsPublicStreetContent(scene.id, entity)
      && entity.visible !== false && !entity.counterSurfaceId && entity.kind !== 'door')
    expect(outdoor).toBeDefined()
    const html = renderToStaticMarkup(<MainlineSceneRenderer {...rendererProps(scene, inside)} />)
    const object = html.match(new RegExp(`<button[^>]*data-object-id="${outdoor.id}"[^>]*>`))?.[0]

    expect(object).toBeDefined()
    expect(object).toContain('disabled=""')
    expect(object).toContain('opacity:0')
    expect(object).toContain('pointer-events:none')
    expect(object).toContain('transition:opacity 1100ms ease-in-out')
    expect(object).toContain('data-focus-target-group="interactive:yonghe-outdoor-table-1"')

    const lane = scene.rooms.find(room => room.id === 'mining-street-public-lane')!.bounds
    const outside = { x: lane.x + lane.width / 2, y: lane.y + lane.height / 2 }
    const streetHtml = renderToStaticMarkup(<MainlineSceneRenderer {...rendererProps(scene, outside)} />)
    const restoredObject = streetHtml.match(new RegExp(`<button[^>]*data-object-id="${outdoor.id}"[^>]*>`))?.[0]
    expect(restoredObject).toBeDefined()
    expect(restoredObject).not.toContain('disabled=""')
    expect(restoredObject).toContain('opacity:1')
  })

  it('keeps ambient street residents in a noninteractive fading visual layer', () => {
    const scene = mainlineScenes['commercial-street']
    const interior = scene.rooms.find(room => room.id === 'commercial-north-cafe-interior')!
    const inside = { x: interior.bounds.x + interior.bounds.width / 2, y: interior.bounds.y + interior.bounds.height / 2 }
    const html = renderToStaticMarkup(<MainlineSceneRenderer
      {...rendererProps(scene, inside)}
      ambientNpcActorLayer={<span data-test-ambient="street-walker" />}
    />)
    const layer = html.match(/<div[^>]*class="scene-mainline-street-ambient-layer"[^>]*>/)?.[0]

    expect(layer).toBeDefined()
    expect(layer).toContain('aria-hidden="true"')
    expect(layer).toContain('opacity:0')
    expect(layer).toContain('pointer-events:none')
    expect(html).toContain('data-test-ambient="street-walker"')
  })
})

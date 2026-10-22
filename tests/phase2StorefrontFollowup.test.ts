import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { mainlineCanonicalSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'

const scene = mainlineScenes['commercial-street']
const options = { screenMetrics: sceneDesignReferenceMetrics, actorId: 'protagonist' }

describe('Phase 2 customer-side menu placement', () => {
  it('embeds the fruit tea menu on its public-side wall and leaves a reachable reading point outside the L counter', () => {
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-n1-interior')!
    const menu = scene.objects.find(object => object.id === 'fruit-tea-trial-menu')!
    const counter = scene.continuousStructures.find(body => body.id === 'fruit-tea-trial-long-counter-body')!
    const front = scene.passages.find(passage => passage.toRoomId === room.id && passage.routeThrough)!
    const wallX = (menu.position.x - room.bounds.x) * 19.2
    const publicContactX = (menu.interactionContactAnchor!.x - room.bounds.x) * 19.2
    const contactY = (menu.interactionContactAnchor!.y - room.bounds.y) * 10.8
    const localContact = { x: publicContactX, y: contactY }
    const counterContainsContact = scene.continuousStructures
      .filter(body => body.id.startsWith('fruit-tea-trial-'))
      .some(body => {
        const left = (body.x - room.bounds.x) * 19.2
        const top = (body.y - room.bounds.y) * 10.8
        return localContact.x >= left && localContact.x <= left + body.width * 19.2
          && localContact.y >= top && localContact.y <= top + body.height * 10.8
      })

    expect(menu).toMatchObject({ surface: 'wall', interactive: true, roomId: room.id })
    expect(wallX).toBeCloseTo(room.bounds.width * 19.2, 5)
    expect(publicContactX).toBeCloseTo(room.bounds.width * 19.2 - 28, 5)
    expect(contactY).toBeCloseTo(588, 5)
    expect(counterContainsContact).toBe(false)
    expect(findMainlinePathToEntity(scene, menu.id, front.crossingTargets[0]!, {}, options).path).not.toBeNull()
    expect(scene.objects.filter(object => object.id === menu.id)).toHaveLength(1)
  })

  it('keeps both takeaway menu glyphs on their intended customer-facing walls and owned by their shop', () => {
    const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
    const samples = [
      // N1's right boundary is compiled as N2's left edge because that shell
      // owns the shared wall cell; the feature entity still belongs to N1.
      { id: 'fruit-tea-trial-menu', roomId: 'commercial-north-n1-interior', sourceWallId: 'commercial-north-n2-interior-shell', edge: 'left' },
      { id: 'commercial-s5-milk-tea-menu-service-label', roomId: 'commercial-south-s5-interior', sourceWallId: 'commercial-south-s5-interior-shell', edge: 'left' },
    ] as const

    for (const sample of samples) {
      const entity = scene.objects.find(object => object.id === sample.id)!
      const cells = units.flatMap(unit => unit.visual.cells.map(cell => ({ unit, cell })))
        .filter(({ cell }) => cell.entityId === sample.id && cell.featureCellRole === 'content')
      expect(entity).toMatchObject({ roomId: sample.roomId, surface: 'wall', interactive: true })
      expect(cells).toHaveLength(2)
      expect(cells.map(({ cell }) => cell.glyph).join('')).toBe('菜单')
      expect(cells.every(({ unit }) => unit.sourceWallId === sample.sourceWallId && unit.edge === sample.edge)).toBe(true)
      expect(cells.every(({ unit }) => unit.navigation.blocked)).toBe(true)
      expect(findMainlinePathToEntity(scene, sample.id, scene.initialPlayerPosition, {}, options).path).not.toBeNull()
    }
  })
})

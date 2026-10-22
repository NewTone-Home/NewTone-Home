import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

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
    expect(publicContactX).toBeCloseTo(160, 5)
    expect(contactY).toBeCloseTo(616, 5)
    expect(counterContainsContact).toBe(false)
    expect(findMainlinePathToEntity(scene, menu.id, front.crossingTargets[0]!, {}, options).path).not.toBeNull()
    expect(scene.objects.filter(object => object.id === menu.id)).toHaveLength(1)
  })
})

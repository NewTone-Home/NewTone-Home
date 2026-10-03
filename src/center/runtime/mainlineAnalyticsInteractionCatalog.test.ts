import { describe, expect, it } from 'vitest'
import { listMainlineAnalyticsInteractionPoints } from './mainlineAnalyticsInteractionCatalog'
import { mainlineScenes } from './mainlineScenes'

describe('mainline analytics interaction catalog', () => {
  const points = listMainlineAnalyticsInteractionPoints()
  const key = (sceneId: string, objectId: string) => `${sceneId}/${objectId}`
  const keys = new Set(points.map((point) => key(point.sceneId, point.objectId)))

  it('includes every authored interactive entity and NPC across the formal scenes', () => {
    for (const scene of Object.values(mainlineScenes)) {
      for (const entity of scene.objects) {
        if (entity.interactive === false && entity.interactionBehavior !== 'direct-wall') continue
        expect(keys.has(key(scene.id, entity.id)), `${scene.id}/${entity.id}`).toBe(true)
      }
      for (const npc of scene.npcs) {
        if (npc.interactive === false || scene.ambientNpcRoutes.some((route) => route.npcId === npc.id)) continue
        expect(keys.has(key(scene.id, npc.id)), `${scene.id}/${npc.id}`).toBe(true)
      }
      for (const passage of scene.passages) expect(keys.has(key(scene.id, passage.entityId)), `${scene.id}/${passage.entityId}`).toBe(true)
    }
  })

  it('includes storefront and passage targets while excluding non-interactive scenery', () => {
    expect(points.some((point) => point.sceneId === 'commercial-street' && point.objectKind === 'storefront')).toBe(true)
    expect(points.some((point) => point.objectKind === 'door')).toBe(true)
    expect(points.some((point) => point.objectKind === 'seat')).toBe(true)
    for (const chairId of [
      'yonghe-outdoor-chair-1-top',
      'yonghe-outdoor-chair-1-bottom',
      'yonghe-outdoor-chair-2-top',
      'yonghe-outdoor-chair-2-bottom',
    ]) {
      expect(keys.has(key('yonghe-mining-perimeter', chairId))).toBe(false)
    }
    expect(points.every((point) => point.sceneId && point.objectId && point.objectKind)).toBe(true)
  })

  it('exposes a stable unique identity and owner-facing label for every point', () => {
    expect(new Set(points.map((point) => key(point.sceneId, point.objectId))).size).toBe(points.length)
    expect(points.find((point) => point.sceneId === 'jijia-ancestral-home' && point.objectId === 'jijia-old-tree')).toMatchObject({
      objectKind: 'landmark',
      label: '老槐树',
    })
  })
})

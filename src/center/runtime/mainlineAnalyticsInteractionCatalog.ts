import { commercialStreetStorefrontInteractionFor } from './commercialStreetStorefrontInteractions'
import { mainlineScenes } from './mainlineScenes'
import type { MainlineSceneId } from './mainlineSceneModel'

export type MainlineAnalyticsInteractionPoint = {
  sceneId: MainlineSceneId
  objectId: string
  objectKind: string
  /** Owner-facing only; never an analytics identity or payload field. */
  label: string
}

/**
 * Canonical owner-side inventory derived from the compiled scene model.
 * Non-interactive scenery and ambient residents are intentionally excluded.
 */
export function listMainlineAnalyticsInteractionPoints(): MainlineAnalyticsInteractionPoint[] {
  const points = new Map<string, MainlineAnalyticsInteractionPoint>()
  const add = (point: MainlineAnalyticsInteractionPoint) => {
    points.set(`${point.sceneId}\u0000${point.objectId}`, point)
  }

  for (const scene of Object.values(mainlineScenes)) {
    for (const entity of scene.objects) {
      if (entity.interactive === false && entity.interactionBehavior !== 'direct-wall') continue
      add({ sceneId: scene.id, objectId: entity.id, objectKind: entity.kind, label: entity.label })
    }
    for (const passage of scene.passages) {
      if (passage.entityId && !points.has(`${scene.id}\u0000${passage.entityId}`)) {
        const entity = scene.objects.find((candidate) => candidate.id === passage.entityId)
        add({ sceneId: scene.id, objectId: passage.entityId, objectKind: 'door', label: entity?.label ?? '门' })
      }
    }
    for (const npc of scene.npcs) {
      if (npc.interactive === false || scene.ambientNpcRoutes.some((route) => route.npcId === npc.id)) continue
      add({ sceneId: scene.id, objectId: npc.id, objectKind: 'npc', label: npc.label })
    }
    for (const storefront of scene.storefronts) {
      if (!commercialStreetStorefrontInteractionFor(storefront.id)) continue
      add({ sceneId: scene.id, objectId: storefront.id, objectKind: 'storefront', label: storefront.label })
    }
  }

  return [...points.values()].sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.objectId.localeCompare(b.objectId))
}

import type { MainlineSceneId, MainlineScenePortalBlueprint } from './mainlineSceneModel'

const commercialStreetEntryPortalIds = new Set([
  'commercial-north-slot-1-entry',
  'commercial-south-slot-5-entry',
  'street-cafe-entry',
])

const miningEntryPortalIds = new Set(['yonghe-street-entry'])

export const storefrontAccessDeniedText = '\u6ca1\u6709\u6743\u9650\u8fdb\u5165\u8fd9\u5bb6\u5e97\u3002'

/** Restrict shop interiors while leaving each storefront's reveal presentation intact. */
export function restrictStorefrontPortalAccess(
  sceneId: MainlineSceneId,
  portals: readonly MainlineScenePortalBlueprint[],
  storefrontPortalIds: ReadonlySet<string>,
) {
  const allowed = sceneId === 'commercial-street'
    ? commercialStreetEntryPortalIds
    : sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery'
      ? miningEntryPortalIds
      : null
  if (!allowed) return portals

  return portals.map(portal => {
    if (!storefrontPortalIds.has(portal.id) || portal.id === 'cafe-trial-customer-toilet-door' || portal.access === 'locked' || allowed.has(portal.id)) return portal
    if (!portal.fromRoomId || !portal.toRoomId) return portal
    return { ...portal, access: 'locked' as const, lockedText: storefrontAccessDeniedText }
  })
}

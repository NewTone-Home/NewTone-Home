import { describe, expect, it } from 'vitest'
import { mainlineStorefrontPlayerContact, resolveMainlineStorefrontInteraction } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { storefrontContactGeometry } from '../src/center/runtime/storefrontContactGeometry'

const street = mainlineScenes['commercial-street']
const viewports = [
  { width: 1280, height: 720 }, { width: 390, height: 844 },
  { width: 412, height: 915 }, { width: 844, height: 390 },
  { width: 834, height: 1194 }, { width: 1194, height: 834 },
]

describe('commercial street storefront passages', () => {
  it.each(viewports)('keeps all 14 storefront signs outside player contact routing at $width x $height', metrics => {
    const snapshot = createMainlineSceneGeometrySnapshot(street, street.initialPlayerPosition, {}, metrics)
    const shops = street.storefronts.filter(storefront => /-slot(?:-\d+)?$/.test(storefront.id))
    const openShopIds = new Set(['commercial-north-slot-1', 'commercial-south-slot-5', 'commercial-cafe-slot'])
    expect(shops).toHaveLength(14)
    expect(street.storefronts).toHaveLength(15) // the separate restroom portal also has a sign
    for (const storefront of shops) {
      expect(storefront.portalId, storefront.id).toBeTruthy()
      expect(storefront.characterSwitch, storefront.id).toBe(true)
      expect(street.passages.find(passage => passage.portalId === storefront.portalId)?.access)
        .toBe(openShopIds.has(storefront.id) ? 'open' : 'locked')
      expect(snapshot.storefronts.has(storefront.id)).toBe(false)
      expect(mainlineStorefrontPlayerContact(street, storefront, street.initialPlayerPosition, {}, { screenMetrics: metrics, geometrySnapshot: snapshot })).toBeNull()
      expect(resolveMainlineStorefrontInteraction(street, storefront, street.initialPlayerPosition, {}, { screenMetrics: metrics, geometrySnapshot: snapshot }).path).toBeNull()
    }
    const restroom = street.storefronts.find(storefront => storefront.id === 'cafe-restroom-sign')!
    expect(restroom).toBeTruthy()
    expect(street.passages.find(passage => passage.portalId === restroom.portalId)?.access).toBe('open')
  })

  it('keeps label presentation geometry available without adding it to player contact geometry', () => {
    const metrics = viewports[0]
    const storefront = street.storefronts.find(candidate => candidate.id === 'commercial-cafe-slot')!
    const units = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics)
    expect(storefrontContactGeometry(storefront, units, metrics)).toBeNull()
    expect(storefrontContactGeometry(storefront, units, metrics, true)).not.toBeNull()
  })
})

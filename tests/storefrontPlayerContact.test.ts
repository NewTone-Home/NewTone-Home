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
    expect(street.storefronts).toHaveLength(14)
    for (const storefront of street.storefronts) {
      expect(storefront.portalId, storefront.id).toBeTruthy()
      expect(storefront.characterSwitch, storefront.id).toBe(true)
      expect(street.passages.find(passage => passage.portalId === storefront.portalId)?.access).toBe('locked')
      expect(snapshot.storefronts.has(storefront.id)).toBe(false)
      expect(mainlineStorefrontPlayerContact(street, storefront, street.initialPlayerPosition, {}, { screenMetrics: metrics, geometrySnapshot: snapshot })).toBeNull()
      expect(resolveMainlineStorefrontInteraction(street, storefront, street.initialPlayerPosition, {}, { screenMetrics: metrics, geometrySnapshot: snapshot }).path).toBeNull()
    }
  })

  it('keeps label presentation geometry available without adding it to player contact geometry', () => {
    const metrics = viewports[0]
    const storefront = street.storefronts.find(candidate => candidate.id === 'commercial-cafe-slot')!
    const units = mainlineSceneGeometryUnits(street, street.initialPlayerPosition, metrics)
    expect(storefrontContactGeometry(storefront, units, metrics)).toBeNull()
    expect(storefrontContactGeometry(storefront, units, metrics, true)).not.toBeNull()
  })
})

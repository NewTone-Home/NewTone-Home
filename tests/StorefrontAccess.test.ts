import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import { activeStorefrontPresentationOwner } from '../src/center/runtime/storefrontPresentation'
import { storefrontAccessDeniedText } from '../src/center/runtime/storefrontAccess'

describe('shop interior access', () => {
  it('keeps only fruit tea, milk tea, Cafe, and the attached restroom open on Commercial Street', () => {
    const scene = mainlineScenes['commercial-street']
    const open = new Set(['commercial-north-slot-1', 'commercial-south-slot-5', 'commercial-cafe-slot', 'cafe-restroom-sign'])
    for (const storefront of scene.storefronts.filter(slot => slot.portalId)) {
      const passage = scene.passages.find(candidate => candidate.portalId === storefront.portalId)!
      expect(passage.access, storefront.id).toBe(open.has(storefront.id) ? 'open' : 'locked')
      if (!open.has(storefront.id)) expect(passage.lockedText).toBe(storefrontAccessDeniedText)
      expect(activeStorefrontPresentationOwner(scene, mainlineStorefrontApproach(scene, storefront)), `${storefront.id} still reveals`).toBe(storefront.id)
    }
  })

  it('keeps only Yonghe open on the mining street without changing unrelated scenes', () => {
    for (const sceneId of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[sceneId]
      for (const storefront of scene.storefronts.filter(slot => slot.portalId)) {
        const passage = scene.passages.find(candidate => candidate.portalId === storefront.portalId)!
        expect(passage.access, `${sceneId}:${storefront.id}`).toBe(storefront.id === 'yonghe-slot-2' ? 'open' : 'locked')
        if (storefront.id !== 'yonghe-slot-2') expect(passage.lockedText).toBe(storefrontAccessDeniedText)
      }
    }
    expect(mainlineScenes['jijia-ancestral-home'].passages.some(passage => passage.access === 'open')).toBe(true)
  })
})

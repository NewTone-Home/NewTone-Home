import { describe, expect, it } from 'vitest'
import { commercialStreetMapGuideActive, laoZhouArrivalLabel, laoZhouArrivalShouldDeliver, laoZhouArrivalTimeKey } from './openingGuidance'
import { ruoyuCafeDepartedKey, ruoyuCafeMeetingStatusKey, ruoyuCafeUnlockedKey } from './ruoyuCafeMeeting'
import { commercialCafeNarrativeCursorKey, commercialCafeNarrativePhaseKey, commercialCafeStoryStatusKey } from './commercialCafeStory'
import { phoneCommercialCafeCenter } from './phoneCommercialStreetPlan'
import { getPhoneMapRegions } from './phoneMapModel'

describe('opening guidance', () => {
  it('delivers Lao Zhou arrival once, only on a fresh game', () => {
    expect(laoZhouArrivalShouldDeliver(undefined, undefined)).toBe(false)
    expect(laoZhouArrivalShouldDeliver({ [laoZhouArrivalTimeKey]: '10:00' }, undefined)).toBe(false)
    const fresh = { [commercialCafeStoryStatusKey]: 'available', [commercialCafeNarrativePhaseKey]: 'not-started', [commercialCafeNarrativeCursorKey]: 0 }
    expect(laoZhouArrivalShouldDeliver(undefined, fresh)).toBe(false)
    expect(laoZhouArrivalShouldDeliver({laoZhouOpeningPromptStatus:'pending',laoZhouConversationTriggered:false,laoZhouTriggerEvidenceVersion:1}, fresh)).toBe(true)
    expect(laoZhouArrivalShouldDeliver(undefined, { ...fresh, [commercialCafeNarrativePhaseKey]: 'dialogue' })).toBe(false)
    expect(laoZhouArrivalShouldDeliver(undefined, { ...fresh, [commercialCafeStoryStatusKey]: 'complete' })).toBe(false)
    expect(laoZhouArrivalLabel({ [laoZhouArrivalTimeKey]: '10:03' })).toBe('10:03')
    expect(laoZhouArrivalLabel({})).toBeNull()
  })
  it('glows the commercial street while away and the next story character waits there', () => {
    expect(commercialStreetMapGuideActive('commercial-street', undefined)).toBe(false)
    expect(commercialStreetMapGuideActive('yonghe-mining-perimeter', undefined)).toBe(true)
    const done = { [commercialCafeStoryStatusKey]: 'complete' }
    expect(commercialStreetMapGuideActive('yonghe-mining-perimeter', done)).toBe(false)
    const unlocked = { ...done, [ruoyuCafeUnlockedKey]: true }
    expect(commercialStreetMapGuideActive('yonghe-mining-perimeter', unlocked)).toBe(true)
    expect(commercialStreetMapGuideActive('yonghe-mining-perimeter', { ...unlocked, [ruoyuCafeMeetingStatusKey]: 'complete' })).toBe(false)
    expect(commercialStreetMapGuideActive('yonghe-mining-perimeter', { ...unlocked, [ruoyuCafeDepartedKey]: true })).toBe(false)
  })
  it('places the cafe poi on the right of the commercial region', () => {
    const poi = getPhoneMapRegions('inner').find(r => r.id === 'commercial')!.pois[0]
    expect(poi.id).toBe('commercial-cafe')
    expect(poi.label).toBe('咖啡馆')
    const [x, y] = phoneCommercialCafeCenter()
    expect(x).toBeGreaterThan(5)
    expect(x).toBeLessThan(11)
    expect(y).toBeLessThan(0)
  })
})

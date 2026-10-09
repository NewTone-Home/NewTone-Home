import { describe, expect, it } from 'vitest'
import { getPhoneMapRegions, stepPhoneMapZoom, phoneBusinessStatus, phonePublicPlaces, clampPhoneMapZoom, phoneMapTransitLinks } from '../src/center/runtime/phoneMapModel'

describe('Phone map region and POI model', () => {
  it('groups current inner-world locations and real POIs by their parent area', () => {
    const regions = getPhoneMapRegions('inner')
    expect(regions.map(region => region.label)).toEqual(['商业街', '中枢院', '矿区'])
    expect(regions.find(region => region.id === 'commercial')?.pois).toMatchObject([
      { id: 'commercial-cafe', label: 'Café', sceneId: 'commercial-cafe' },
    ])
    expect(regions.find(region => region.id === 'mine')?.pois).toMatchObject([
      { id: 'yonghe-eatery', label: '永和小馆', sceneId: 'yonghe-eatery' },
    ])
  })

  it('keeps the surface map on its existing landmarks without inner-world POIs', () => {
    const regions = getPhoneMapRegions('surface')
    expect(regions.map(region => region.id)).toEqual(['jijia', 'zhongshuyuan'])
    expect(regions.flatMap(region => region.pois)).toEqual([])
  })

  it('uses continuous bounded zoom ratios', () => {
    expect(clampPhoneMapZoom(.5)).toBe(1)
    expect(clampPhoneMapZoom(9)).toBe(3.5)
    expect(clampPhoneMapZoom(1.37)).toBe(1.37)
    expect(stepPhoneMapZoom(1, 1)).toBe(1.25)
    expect(stepPhoneMapZoom(1.25, -1)).toBe(1)
    expect(stepPhoneMapZoom(3.5, 1)).toBe(3.5)
  })
  it('only supplies the confirmed three transit relationships', () => {
    expect(phoneMapTransitLinks).toEqual([['commercial', 'zhongshuyuan'], ['commercial', 'mine'], ['zhongshuyuan', 'mine']])
  })
})

it('uses story minutes for public business hours and keeps sparse place records sparse', () => {
 expect(phoneBusinessStatus(phonePublicPlaces['yonghe-eatery'].hours!, 600)).toEqual({open:false,nextMinutes:660})
 expect(phoneBusinessStatus(phonePublicPlaces['yonghe-eatery'].hours!, 720)).toEqual({open:true,nextMinutes:780})
 expect(phonePublicPlaces['yonghe-eatery'].description).toBeUndefined()
 expect(phonePublicPlaces.mine.hours).toBeUndefined()
 expect(phonePublicPlaces.zhongshuyuan.phone).toBe('0000')
})

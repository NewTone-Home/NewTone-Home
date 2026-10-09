import { mainlineMapLandmarksByWorld, type MainlineMapLandmark, type MainlineMapWorld, type MainlineSceneId } from './mainlineScenes'

export const phoneMapZoomBounds = { min: 1, max: 3.5, poi: 1.45 } as const
export type PhoneMapZoomLevel = number
export function clampPhoneMapZoom(value: number) {
  return Math.max(phoneMapZoomBounds.min, Math.min(phoneMapZoomBounds.max, value))
}
export type PhoneMapPoint = readonly [number, number]

export type PhoneMapPoi = {
  id: string
  label: string
  detail: string
  sceneId?: MainlineSceneId
  position: PhoneMapPoint
}

export type PhoneMapRegion = MainlineMapLandmark & {
  detail: string
  pois: readonly PhoneMapPoi[]
}

const regionContent: Record<MainlineMapWorld, Record<string, { detail: string; pois: readonly { id: string; label: string; detail: string; sceneId?: MainlineSceneId; offset: PhoneMapPoint }[] }>> = {
  surface: {
    jijia: { detail: '表世界中的姬家祖宅。', pois: [] },
    zhongshuyuan: { detail: '表世界地图中的中枢院。', pois: [] },
  },
  inner: {
    commercial: {
      detail: '里世界商业街。',
      pois: [{ id: 'commercial-cafe', label: 'Café', detail: '商业街上的咖啡馆。', sceneId: 'commercial-cafe', offset: [6, 4] }],
    },
    zhongshuyuan: {
      detail: '里世界中枢院。',
      pois: [{ id: 'zhongshuyuan-office-poi', label: '办公室', detail: '中枢院办公室。', sceneId: 'zhongshuyuan-office', offset: [5, 4] }],
    },
    mine: {
      detail: '里世界矿区。',
      pois: [{ id: 'yonghe-eatery', label: '永和小馆', detail: '位于矿区外围老街。', sceneId: 'yonghe-eatery', offset: [5, -4] }],
    },
  },
}

export function getPhoneMapRegions(world: MainlineMapWorld): PhoneMapRegion[] {
  return mainlineMapLandmarksByWorld[world].flatMap((landmark) => {
    const content = regionContent[world][landmark.id]
    if (!content) return []
    return [{
      ...landmark,
      detail: content.detail,
      pois: content.pois.map((poi) => ({
        id: poi.id,
        label: poi.label,
        detail: poi.detail,
        ...(poi.sceneId ? { sceneId: poi.sceneId } : {}),
        position: [landmark.position[0] + poi.offset[0], landmark.position[1] + poi.offset[1]] as const,
      })),
    }]
  })
}

export function stepPhoneMapZoom(current: PhoneMapZoomLevel, direction: -1 | 1): PhoneMapZoomLevel {
  return clampPhoneMapZoom(current * (direction > 0 ? 1.25 : 1 / 1.25))
}

// Schematic transit links, never geographic roads or formal region boundaries.
export const phoneMapTransitLinks = [['commercial', 'zhongshuyuan'], ['commercial', 'mine'], ['zhongshuyuan', 'mine']] as const
export const phoneMapRegionContours: Record<string, string> = {
  commercial: 'M-13 -7 Q-8 -13 1 -10 L12 -7 Q17 -1 12 7 L5 11 -6 9 Q-16 7 -13 -7Z',
  zhongshuyuan: 'M-12 -8 L-3 -11 9 -8 Q15 -3 11 6 L4 10 -8 7 Q-14 2 -12 -8Z',
  mine: 'M-10 -9 L0 -12 11 -7 14 2 7 10 -4 8 -13 2Z',
  jijia: 'M-10 -7 Q-3 -11 7 -7 L12 1 6 9 -7 7 Q-13 2 -10 -7Z',
}

export const phonePublicPlaces: Record<string, {category:string; description?:string;address:string;hours?:readonly (readonly [number,number])[];phone?:string}> = {
 commercial:{category:'购物 · 餐饮',description:'集餐饮、零售和生活服务于一体的街区，沿街分布有多家独立商户和小型店铺。',address:'商业街',hours:[[600,1320]]},
 zhongshuyuan:{category:'政府机构',description:'综合行政办公机构，设有多个业务与管理部门。访客进入部分区域前需进行登记。',address:'中枢院',hours:[[540,1020]],phone:'0000'},
 mine:{category:'工业区',description:'围绕矿业生产设施形成的综合区域，包含作业区、旧设施和居民生活区。',address:'矿区'},
 'yonghe-eatery':{category:'简餐',address:'矿区',hours:[[360,480],[660,780],[1020,1200]]},
 'commercial-cafe':{category:'咖啡馆',address:'商业街'},
 'zhongshuyuan-office-poi':{category:'政府机构',address:'中枢院',hours:[[540,1020]],phone:'0000'},
 jijia:{category:'',address:'姬家祖宅'},
}
export function phoneBusinessStatus(hours:readonly (readonly [number,number])[], minutes:number) {
 const active=hours.find(([start,end])=>minutes>=start && minutes<end)
 const next=hours.find(([start])=>start>minutes) ?? hours[0]
 return {open:Boolean(active),nextMinutes:active ? active[1] : next[0]}
}

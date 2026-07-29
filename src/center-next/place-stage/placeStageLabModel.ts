import type { PlaceShapeSpec, PlaceStageDefinition, PlaceStageLayerAsset } from './placeStageTypes'

/**
 * Phase 0.5 隔离原型的数据与入口门控。
 *
 * 这里的地点是**结构占位**，不是正式地点表述层，也刻意不是地图：
 * 每一层只有体量、位置与纸色深浅，用来验证遮挡关系、视差与 80/20 前后权重。
 * 正式的姬家大院资产到位后，只需要把四类透明图层塞进同一个 `layers` 结构，
 * 组件、控制器与过渡策略都不需要改。
 *
 * 原型不接 committedLocation、progressStore、Reader、正式 Center。
 */

export const PLACE_STAGE_QUERY_KEY = 'place-stage'
/** 兼容别名。与正式入口进入同一个 Lab，不形成第二条代码路径。 */
export const PLACE_STAGE_LEGACY_QUERY_KEY = 'horizon-lab'

/** 与 isThemeLabEnabled 同语义：出现且不为 '0' 即开启。 */
export function isPlaceStageLabEnabled(search: string): boolean {
  try {
    const params = new URLSearchParams(search)
    for (const key of [PLACE_STAGE_QUERY_KEY, PLACE_STAGE_LEGACY_QUERY_KEY]) {
      const value = params.get(key)
      if (value !== null && value !== '0') return true
    }
    return false
  } catch {
    return false
  }
}

function shape(
  id: string,
  form: PlaceShapeSpec['form'],
  box: { xPct: number; yPct: number; widthPct: number; heightPct: number },
  tone: number,
  depth: number,
  parallaxX: number,
  parallaxY: number,
  extra: Partial<PlaceStageLayerAsset> = {},
): PlaceStageLayerAsset {
  return {
    id,
    kind: 'shape',
    shape: { form, tone, ...box },
    depth,
    parallaxX,
    parallaxY,
    ...extra,
  }
}

function centerAssetImage(
  id: string,
  assetDirectory: string,
  fileName: string,
  depth: number,
  parallaxX: number,
  parallaxY: number,
): PlaceStageLayerAsset {
  return {
    id,
    kind: 'image',
    src: `${import.meta.env.BASE_URL}assets/center/${assetDirectory}/${fileName}`,
    depth,
    parallaxX,
    parallaxY,
  }
}

function image(
  id: string,
  fileName: string,
  depth: number,
  parallaxX: number,
  parallaxY: number,
): PlaceStageLayerAsset {
  return centerAssetImage(id, 'jijia-stage-layers-v2', fileName, depth, parallaxX, parallaxY)
}

function centralInstituteImage(
  id: string,
  fileName: string,
  depth: number,
  parallaxX: number,
  parallaxY: number,
): PlaceStageLayerAsset {
  return centerAssetImage(
    id,
    'central-institute-stage-v13-object-layered',
    fileName,
    depth,
    parallaxX,
    parallaxY,
  )
}

/**
 * 姬家大院的原结构占位。
 *
 * 只供里世界的结构占位复用，避免表世界真实资产污染其他地点定义。
 */
const jiManorPlaceholder: PlaceStageDefinition = {
  id: 'ji-manor',
  title: '姬家大院',
  subtitle: '表世界 · 结构占位',
  worldLayer: 'surface',
  stageEnabled: true,
  layers: {
    rear: [
      shape('manor-rear-roof', 'roof', { xPct: 16, yPct: 26, widthPct: 68, heightPct: 20 }, 0.32, 0.12, 2, 1),
      shape('manor-rear-mass', 'block', { xPct: 20, yPct: 40, widthPct: 60, heightPct: 30 }, 0.24, 0.18, 3, 1),
    ],
    inner: [
      shape('manor-court', 'block', { xPct: 40, yPct: 46, widthPct: 20, heightPct: 26 }, 0.44, 0.44, -6, -3),
      shape('manor-court-ridge', 'ridge', { xPct: 38, yPct: 44, widthPct: 24, heightPct: 6 }, 0.5, 0.48, -5, -2),
    ],
    subject: [
      shape('manor-wall-left', 'wall', { xPct: 12, yPct: 50, widthPct: 26, heightPct: 30 }, 0.62, 0.7, 3, 1.5),
      shape('manor-gate', 'gate', { xPct: 38, yPct: 42, widthPct: 24, heightPct: 40 }, 0.72, 0.72, 3, 1.5),
      shape('manor-wall-right', 'wall', { xPct: 62, yPct: 50, widthPct: 26, heightPct: 30 }, 0.62, 0.7, 3, 1.5),
    ],
    foreground: [
      shape('manor-front-stone', 'block', { xPct: 6, yPct: 74, widthPct: 22, heightPct: 12 }, 0.8, 1, 11, 5),
      shape('manor-front-post', 'ridge', { xPct: 72, yPct: 72, widthPct: 20, heightPct: 10 }, 0.76, 1, 9, 4),
    ],
  },
  neighborSilhouette: [
    shape('manor-sil', 'silhouette', { xPct: 14, yPct: 34, widthPct: 72, heightPct: 48 }, 0.5, 0.5, 2, 1),
  ],
}

/**
 * 姬家大院。
 *
 * 美术文件名只停留在资产路径层；PlaceStage 数据模型仍使用
 * rear / inner / subject / foreground 四个通用槽位。
 */
const jijiaCompound: PlaceStageDefinition = {
  id: 'jijia-compound',
  title: '姬家大院',
  subtitle: '表世界',
  worldLayer: 'surface',
  stageEnabled: true,
  /** 四张导出图同为 1536 × 1024，共用这一张母画布。 */
  canvasAspectRatio: 1536 / 1024,
  layers: {
    rear: [
      image('jijia-rear', '04_rear_hall.png', 0.15, -2, -1),
    ],
    inner: [
      image('jijia-inner', '03_inner_courtyard.png', 0.45, -6, -3),
    ],
    subject: [
      image('jijia-subject', '02_gate.png', 0.72, 3, 1.5),
    ],
    foreground: [
      image('jijia-foreground', '01_foreground.png', 1, 11, 5),
    ],
  },
  neighborSilhouette: jiManorPlaceholder.neighborSilhouette,
}

const centralInstitute: PlaceStageDefinition = {
  id: 'central-institute',
  title: '中枢院',
  subtitle: '世界级联合行政中枢',
  worldLayer: 'surface',
  stageEnabled: true,
  /** 四张导出图同为 1536 × 1024，共用同一画布原点、中轴与比例。 */
  canvasAspectRatio: 1536 / 1024,
  /** 建筑内容接近满画布，地点级缩放后与姬家大院的视觉重量接近。 */
  visualScale: 0.82,
  visualOffsetXPct: 0,
  /** 以 82% 高度为缩放原点时，轻微下移补回原底线。 */
  visualOffsetYPct: 3.25,
  layers: {
    rear: [
      centralInstituteImage('central-institute-rear', '04_rear_hall.png', 0.15, -2, -1),
    ],
    inner: [
      centralInstituteImage('central-institute-inner', '03_inner_courtyard.png', 0.45, -6, -3),
    ],
    subject: [
      centralInstituteImage('central-institute-subject', '02_gate.png', 0.72, 3, 2),
    ],
    foreground: [
      centralInstituteImage('central-institute-foreground', '01_foreground.png', 1, 11, 5),
    ],
  },
  neighborSilhouette: [
    centralInstituteImage('central-institute-neighbor', '02_gate.png', 0.5, 2, 1),
  ],
}

function generatedPlaceImage(
  placeId: string,
  assetDirectory: string,
  slot: string,
  fileName: string,
  depth: number,
  parallaxX: number,
  parallaxY: number,
): PlaceStageLayerAsset {
  return centerAssetImage(
    `${placeId}-${slot}`,
    assetDirectory,
    fileName,
    depth,
    parallaxX,
    parallaxY,
  )
}

const commercialStreet: PlaceStageDefinition = {
  id: 'commerce-street',
  title: '商业街',
  subtitle: '里世界',
  worldLayer: 'inner',
  stageEnabled: true,
  canvasAspectRatio: 1536 / 1024,
  layers: {
    rear: [
      generatedPlaceImage('commerce-street', 'commercial-street-stage-layered', 'rear', '04_rear_hall.png', 0.15, -1, -1),
    ],
    inner: [
      generatedPlaceImage('commerce-street', 'commercial-street-stage-layered', 'inner', '03_inner_courtyard.png', 0.45, -4, -2),
    ],
    subject: [
      generatedPlaceImage('commerce-street', 'commercial-street-stage-layered', 'subject', '02_gate.png', 0.72, 3, 1),
    ],
    foreground: [
      generatedPlaceImage('commerce-street', 'commercial-street-stage-layered', 'foreground', '01_foreground.png', 1, 8, 3),
    ],
  },
  neighborSilhouette: [
    generatedPlaceImage('commerce-street', 'commercial-street-stage-layered', 'neighbor', '02_gate.png', 0.5, 2, 1),
  ],
}

const miningDistrict: PlaceStageDefinition = {
  id: 'mining-district',
  title: '矿区',
  subtitle: '里世界',
  worldLayer: 'inner',
  stageEnabled: true,
  canvasAspectRatio: 1536 / 1024,
  layers: {
    rear: [
      generatedPlaceImage('mining-district', 'mining-area-stage-layered', 'rear', '04_rear_hall.png', 0.15, -1, -1),
    ],
    inner: [
      generatedPlaceImage('mining-district', 'mining-area-stage-layered', 'inner', '03_inner_courtyard.png', 0.45, -4, -2),
    ],
    subject: [
      generatedPlaceImage('mining-district', 'mining-area-stage-layered', 'subject', '02_gate.png', 0.72, 3, 1),
    ],
    foreground: [
      generatedPlaceImage('mining-district', 'mining-area-stage-layered', 'foreground', '01_foreground.png', 1, 8, 3),
    ],
  },
  neighborSilhouette: [
    generatedPlaceImage('mining-district', 'mining-area-stage-layered', 'neighbor', '02_gate.png', 0.5, 2, 1),
  ],
}

/**
 * 表里世界中枢院是同一栋建筑：直接共享同一组图层对象与画布校准，
 * 世界差异只由 EnvironmentSystem 消费 worldLayer 后表达。
 */
const innerCentralInstitute: PlaceStageDefinition = {
  ...centralInstitute,
  id: 'inner-central-institute',
  subtitle: '里世界 · 同一建筑',
  worldLayer: 'inner',
}

/**
 * 表世界第一层地点链：姬家大院 → 中枢院。非循环。
 *
 * 咖啡馆、永和小馆属于下一层地点，后续单独接入 —— 数组长度不写死在
 * 任何地方，加新地点不需要改组件。
 */
export const SURFACE_PLACES: PlaceStageDefinition[] = [jijiaCompound, centralInstitute]

/**
 * 里世界的地点。
 *
 * worldLayer 只决定初始显示与环境状态；中枢院复用同一建筑资产，
 * 商业街与矿区各自消费独立的四层地点资产。
 */
export const INNER_PLACES: PlaceStageDefinition[] = [
  commercialStreet,
  innerCentralInstitute,
  miningDistrict,
]

/**
 * 真实透明资产的接入探针。
 *
 * **默认关闭，默认可见的 Lab 不使用任何完整地图图像** —— 那会重新制造
 * 卡片、地图与贴图语义。它只有一个用途：证明 kind: 'image' 与 kind: 'shape'
 * 走的是同一条渲染路径，将来把姬家大院的透明 PNG 塞进来不需要结构改动。
 */
export const IMAGE_PROBE_LAYER: PlaceStageLayerAsset = {
  id: 'image-probe',
  kind: 'image',
  src: `${import.meta.env.BASE_URL}assets/center/center-city-ambient-test-v1.png`,
  depth: 0.66,
  parallaxX: 3,
  parallaxY: 1.5,
  opacity: 0.9,
}

/** 把探针图层挂到主体组末尾。纯函数，不改原定义。 */
export function withImageProbe(definition: PlaceStageDefinition): PlaceStageDefinition {
  return {
    ...definition,
    layers: {
      ...definition.layers,
      subject: [...definition.layers.subject, IMAGE_PROBE_LAYER],
    },
  }
}

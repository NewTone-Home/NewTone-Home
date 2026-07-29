/**
 * Place Stage 的类型面。
 *
 * 这里定义的是「地点如何被消费」，不是某一个地点长什么样：
 * 一个地点 = 任意数量的分层透明资产，天空 / 星体 / 天气 / 空气都不烘焙进地点。
 * 姬家大院资产就位时，只需把四类透明图层塞进 `layers`，组件与控制器不动。
 */

import type { TimeOfDay, WorldLayer } from '../environment/environmentTypes'

/** 地点内部的深度分组。渲染顺序恒为 rear → inner → subject → foreground。 */
export type PlaceLayerSlot = 'rear' | 'inner' | 'subject' | 'foreground'

/**
 * 世界层。只决定初始显示哪一组地点，浏览另一层不改变阅读位置。
 *
 * 与环境系统共用同一个类型 —— 世界层只有一个真相来源。
 */
export type PlaceWorldLayer = WorldLayer

/**
 * Phase 0.5 的抽象纸片描述。
 *
 * 刻意不是地图：只有体量、位置与纸色深浅，用来验证遮挡关系与视差，
 * 不伪造任何精确地点形状。真实资产接入后这一支会自然退场（改用 kind: 'image'）。
 */
export interface PlaceShapeSpec {
  form: 'block' | 'roof' | 'gate' | 'wall' | 'ridge' | 'silhouette'
  /** 相对地点画框的百分比，原点为左上。 */
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
  /** 0 = 最浅的纸色，1 = 最深。 */
  tone: number
  radius?: string
}

export interface PlaceStageLayerAsset {
  id: string
  /**
   * 'shape' = CSS/内联 SVG 抽象纸片（Phase 0.5 默认）；
   * 'image' = 真实透明资产。两者共用同一套 depth / parallax / 渲染路径，
   * 因此真实资产接入不需要结构改动。
   */
  kind: 'shape' | 'image'
  /** kind === 'image' 时必填。 */
  src?: string
  /** kind === 'shape' 时必填。 */
  shape?: PlaceShapeSpec
  /** 0 = 最远，1 = 最近。用于层间收束幅度，不直接等于 z-index。 */
  depth: number
  /** 满幅指针位移下的像素偏移。允许负值，内层可与前景反向。 */
  parallaxX: number
  parallaxY: number
  opacity?: number
  blendMode?: string
}

export type PlaceLayerGroups = {
  rear?: PlaceStageLayerAsset[]
  inner?: PlaceStageLayerAsset[]
  /** 唯一必填的一组：一个地点至少要有主体。 */
  subject: PlaceStageLayerAsset[]
  foreground?: PlaceStageLayerAsset[]
}

/**
 * 该地点特有的远景基底变体。
 *
 * 注意这**不是天空**：天空、天体、天气、空气归全局环境系统，
 * 任何地点共用一套。这里只留给「确实无法用独立层表达的光照变化」，
 * 而且只按时间分档、不按天气分档 —— 否则每加一种天气都要重导整套远景，
 * 组合数量会爆炸。
 */
export type PlaceBackdropVariant = TimeOfDay

export interface PlaceStageDefinition {
  id: string
  title: string
  /** 舞台上不显示，供 HUD / 信息层使用。 */
  subtitle?: string
  worldLayer: PlaceWorldLayer
  /** false = 该地点尚未具备可上舞台的资产，仍占 index，但走降级表述。 */
  stageEnabled: boolean
  /**
   * 地点母画布的宽高比（宽 / 高）。缺省 3 : 2。
   *
   * 舞台占满整个 viewport，地点却必须保持自身比例：这个值决定那张母画布
   * 等比缩放后有多大。四组图层共用这一个画布，因此同 scale、同 origin，
   * 彼此之间只差 parallax。姬家大院是 1536 × 1024，即 1.5。
  */
  canvasAspectRatio?: number
  /**
   * 地点资产自身的视觉占比校准。只修正该地点的母画布，不参与 80/20
   * 全局预设，也不改变其他地点。
   */
  visualScale?: number
  /** 相对该地点母画布宽 / 高的百分比偏移。 */
  visualOffsetXPct?: number
  visualOffsetYPct?: number
  /** 地点远景基底的变体键；缺省则由环境系统给统一底。 */
  backdrop?: Partial<Record<PlaceBackdropVariant, string>>
  layers: PlaceLayerGroups
  /**
   * 20% 位的简化表述。从第一天就是数组：单层升级为多层不需要改签名。
   * 缺省时由渲染层从 subject 派生一层剪影。
   */
  neighborSilhouette?: PlaceStageLayerAsset[]
}

// ---------------------------------------------------------------------------
// 导航意图
// ---------------------------------------------------------------------------

/**
 * 输入适配层唯一的输出。
 *
 * 输入设备只负责产生意图，绝不直接操作图层，也不含任何 CSS 公式。
 */
export type PlaceNavigationIntent =
  | {
      type: 'continuous'
      source: 'pointer-drag' | 'touch-swipe' | 'wheel-depth'
      /** 相对上一帧的位置增量，单位是「地点」。1:1 直接操作，不做惯性仿真。 */
      progress: number
      direction: -1 | 1
    }
  | {
      type: 'commit'
      source: 'arrow' | 'keyboard' | 'index-jump'
      targetIndex: number
    }
  | {
      type: 'activate'
      source: 'active-click'
      placeId: string
    }

// ---------------------------------------------------------------------------
// 舞台状态
// ---------------------------------------------------------------------------

/**
 * 控制器状态。
 *
 * 刻意不是「一个 position 走天下」：构图由 fromIndex / toIndex / transitionProgress
 * 三者共同表达，position 只是它们的派生量（见 placeStageMath.derivePosition）。
 * settledIndex 是唯一的「已结算主体」，离散切换期间不提前更新。
 */
export interface PlaceStageState {
  phase: 'idle' | 'continuous' | 'committing'
  /** 已结算的主体地点索引。commit 完成前不变。 */
  settledIndex: number
  /** 当前构图的低位地点索引。 */
  fromIndex: number
  /** 当前构图的高位：真实地点索引，或 null = 未知世界边界。 */
  toIndex: number | null
  /** fromIndex → toIndex 的推进量，0..1。 */
  transitionProgress: number
  /** 离散补间的端点与进度。null = 当前没有 commit 在跑。 */
  commit: PlaceCommitTween | null
}

export interface PlaceCommitTween {
  /** 补间起点，连续位置。 */
  fromPosition: number
  /** 补间终点，恒为整数地点索引。 */
  toIndex: number
  /** 补间自身的进度，0..1。与 transitionProgress 不是一回事。 */
  progress: number
}

// ---------------------------------------------------------------------------
// 视觉量
// ---------------------------------------------------------------------------

export type PlaceSlotRole = 'active' | 'neighbor' | 'boundary'

/**
 * 一个地点槽位的视觉量。
 *
 * 全部由过渡策略产生，控制器只负责写成 CSS 变量。
 * Active 与 Neighbor 共用这一个结构，因此二者复用同一套渲染模型。
 */
export interface PlaceSlotVisual {
  /** null = 未知世界边界，不进地点数组、不占 index、不可点击。 */
  placeIndex: number | null
  role: PlaceSlotRole
  /**
   * 深度轨坐标：0 = 前景主体，1 = 侧后方邻居，2 = 已退进深处。
   *
   * 这是空间位置，不是插值进度：退场主体沿它连续走完
   * foreground → neighbor → silhouette/boundary，而不是被 crossfade 掉包。
   */
  depth: number
  /** 1 = 前景主体（80%），0 = 侧后方邻居（20%）及更深。 */
  prominence: number
  /** 0 = 该槽位这一帧完全不参与构图。用于钉住「同时只有两个槽位可见」。 */
  visible: number
  scale: number
  /** 相对舞台宽 / 高的百分比。 */
  translateXPct: number
  translateYPct: number
  zIndex: number
  opacity: number
  /** 纸色褪色叠层，替代昂贵的 filter: contrast()。 */
  veil: number
  /** 默认 0：景深不靠 blur 制造。保留字段供个别地点显式开启。 */
  blurPx: number
  /** 0 = 只读剪影，1 = 多层主体完全展开。由 strategy 控制。 */
  unfold: number
  /** 层间收束幅度：越大，内部各层越向中心聚拢（远离主体位时的表现）。 */
  converge: number
  /**
   * 层展开的时间差系数，单位秒。
   *
   * place-shift 恒为 0；layer-unfold 会让 rear → inner → subject → foreground
   * 按很短的时间差立起来。通道先留出，数据与渲染届时都不用改。
   */
  unfoldDelay: number
}

export interface PlaceStageVisualState {
  /** 恒为两项（末端时第二项 role === 'boundary'）。 */
  slots: PlaceSlotVisual[]
}

// ---------------------------------------------------------------------------
// 环境
// ---------------------------------------------------------------------------

/**
 * 环境不再住在这里。
 *
 * 时间、天气、天体、空气与世界层归 `src/center-next/environment/` 的全局系统，
 * 因为任何地点都要复用同一套 —— 姬家大院、商业街、矿区、里世界、以后的开放世界。
 *
 * 旧的 `variant: 'day' | 'dusk' | 'night' | 'inner'` 已经删掉：
 * inner 是**世界层**，不是一种天色，把它和 day / night 放进同一个枚举
 * 正是这一版要拆掉的混淆。
 */
export type { EnvironmentToggles, SceneEnvironmentState } from '../environment/environmentTypes'

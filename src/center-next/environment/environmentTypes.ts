/**
 * 全局环境系统的类型面。
 *
 * 环境**不是地点的一部分**。姬家大院、商业街、矿区、里世界、以后的开放世界，
 * 共用这一套系统；地点资产里不烘焙天空、太阳、月亮、星星与天气。
 *
 * 驱动方向是单向的：
 *
 *   剧情状态 → SceneEnvironmentState → Environment System → 视觉层
 *
 * 用户不直接挑天气。Lab 里的开关是**剧情状态的替身**，不是产品交互。
 */

/**
 * 世界层。它不是时间，也不是天气。
 *
 * 里世界不是一种「天色」——把 inner 塞进 day / night 同一个枚举，
 * 是这一版明确要拆掉的东西。
 */
export type WorldLayer = 'surface' | 'inner'

/** 第一版时间系统：只有四档。 */
export type TimeOfDay = 'morning' | 'noon' | 'dusk' | 'night'

/** 第一版天气系统：只有三种。沙尘、雷暴、雾、风暴以后再说。 */
export type Weather = 'clear' | 'rain' | 'snow'

/** 第一版月相：先有三档。new moon / gibbous 以后再加。 */
export type MoonPhase = 'crescent' | 'half' | 'full'

/**
 * 一个场景的环境状态。剧情系统以后产出的就是这个对象。
 *
 * 本阶段不接剧情系统，但形状先定死，接的时候不用改下游。
 */
export interface SceneEnvironmentState {
  worldLayer: WorldLayer
  time: TimeOfDay
  weather: Weather
  /** 缺省 crescent。只在夜晚可见，但状态本身不依赖时间。 */
  moonPhase?: MoonPhase
}

/**
 * 背景空间的调色板。
 *
 * 背景不再是「一条渐变完成所有事情」：天空、地平线、地面、空气各自有色，
 * 表里世界的区别由这套光色系统表达，不是换地图。
 *
 * 颜色一律是空格分隔的 RGB 三元组（如 "206 216 219"），
 * CSS 侧用 rgb(var(--x)) / rgb(var(--x) / alpha) 消费，便于调透明度。
 */
export interface EnvironmentPalette {
  /** 天空顶部。 */
  skyTop: string
  /** 天空接近地平线处。 */
  skyLow: string
  /** 地平线带：天与地相接处的软色。 */
  horizon: string
  /** 地面主色，从地平线向下延伸。 */
  ground: string
  /** 地面最下缘（离摄影机最近处），比 ground 略深。 */
  groundLow: string
  /** 远景剪影色（远山 / 城市轮廓）。 */
  far: string
  /** 空气 / 雾的颜色。 */
  atmosphere: string
  /** 光源色：太阳/月亮本体与局部光色。表世界偏暖，里世界偏白。 */
  light: string
}

/** 天体。星星与太阳月亮分开，因为晴朗夜晚两者可以同时存在。 */
export type CelestialBody = 'sun' | 'moon' | 'none'

/**
 * 环境系统解算后的视觉参数。
 *
 * 视觉层只读这个对象，不再自己判断「现在是不是晚上」——
 * 所有条件判断集中在 resolveEnvironment 一处。
 */
export interface ResolvedEnvironment {
  /** 解算后的场景状态：天气已按世界层规则收窄。 */
  scene: SceneEnvironmentState

  sky: {
    /** 天空梯度的档位键，供 CSS 取对应的静态定义。 */
    variant: `${WorldLayer}-${TimeOfDay}`
    /** 整体亮度系数，0..1。天气会压暗它。 */
    luminance: number
  }

  celestial: {
    body: CelestialBody
    /** 天体在天空中的位置，百分比。低角度 = y 大。 */
    xPct: number
    yPct: number
    /** 被云层遮蔽的程度，0 = 完全可见，1 = 完全遮蔽。 */
    occlusion: number
    /** 星星只在晴朗夜晚出现。 */
    stars: boolean
    /** 月相。body 不是 moon 时无视觉意义，但始终有值。 */
    moonPhase: MoonPhase
    /**
     * 天体的运行时姿态：从资产原生构图位（画布中心附近）出发的平移、
     * 缩放与透明度上限。morning / noon / dusk 靠它区分同一张 sun_bw，
     * 不新增资产。dx 单位 vw、dy 单位 vh。
     */
    pose: {
      dxVw: number
      dyVh: number
      scale: number
      opacity: number
    }
  }

  weather: {
    kind: Weather
    /** 降水强度，0..1。程序化粒子的密度与速度由它推导。 */
    intensity: number
    /** 云量，0..1。 */
    cloudCover: number
  }

  atmosphere: {
    /** 空气浑浊度，0..1。 */
    haze: number
    /** 里世界渗透强度，0..1。表世界恒为 0。 */
    seepage: number
  }

  /** 背景空间的调色板。见 EnvironmentPalette。 */
  palette: EnvironmentPalette

  /**
   * 统一环境分级：同时作用于背景与地点的明暗与对比。
   *
   * 黑白手绘线稿是世界本体，时间 / 天气 / 世界层只通过这套低饱和
   * 环境光表达 —— 不能出现「背景有颜色，地点仍是纯白贴图」。
   */
  grade: {
    /** 整体亮度乘数。时间 × 云量压暗 × 里世界暗沉的合成结果。 */
    brightness: number
    /** 整体对比乘数。noon 最清楚，morning 最柔。 */
    contrast: number
  }

  /**
   * 地平线高度，占视口高度的百分比。
   *
   * 上面是天空，下面是承载地点的地面空间 —— 建筑、邻居、
   * 接触投影全都参照这一条线，摄影机高度由它定义。
   */
  horizonYPct: number
}

/**
 * 八个层级容器的独立开关。
 *
 * 存在的意义是让「天空 / 天体 / 天气 / 空气 / 地点主体」可以分别关掉：
 * 任何一项被烘焙进另一项，这里的开关就会失效，问题立刻暴露，
 * 而不是等到「新增一种天气要重导整套背景」时才发现。
 */
export interface EnvironmentToggles {
  sky: boolean
  celestial: boolean
  /** 远景剪影层：远山 / 城市轮廓。 */
  farField: boolean
  /** 地面层：地平线向下的地面空间与地平线雾带。 */
  ground: boolean
  weather: boolean
  rearAtmosphere: boolean
  rearSilhouette: boolean
  neighborPlace: boolean
  activePlace: boolean
  foregroundAtmosphere: boolean
}

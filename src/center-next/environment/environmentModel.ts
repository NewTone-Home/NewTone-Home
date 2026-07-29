import type {
  CelestialBody,
  EnvironmentPalette,
  EnvironmentToggles,
  MoonPhase,
  ResolvedEnvironment,
  SceneEnvironmentState,
  TimeOfDay,
  Weather,
  WorldLayer,
} from './environmentTypes'

/**
 * 环境状态的解算。
 *
 * 全部条件判断集中在这里：视觉层只消费 ResolvedEnvironment，
 * 不再自己问「现在是不是晚上」「里世界能不能下雪」。
 *
 * 这里没有任何一张「雨天.jpg / 夜晚.jpg」式的组合产物 ——
 * 时间、天气、天体、空气各自是独立参数，组合在渲染时发生，不在资产里发生。
 */

export const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'noon', 'dusk', 'night']

/** 表世界的天气。 */
const SURFACE_WEATHER: Weather[] = ['clear', 'rain', 'snow']

/**
 * 里世界的天气。
 *
 * 刻意是同一套枚举的**子集**，不是第二套天气系统：
 * 里世界不下雪，仅此而已。以后放开只需要改这一行。
 */
const INNER_WEATHER: Weather[] = ['clear', 'rain']

export function allowedWeather(worldLayer: WorldLayer): Weather[] {
  return worldLayer === 'inner' ? INNER_WEATHER : SURFACE_WEATHER
}

export function isWeatherAllowed(worldLayer: WorldLayer, weather: Weather): boolean {
  return allowedWeather(worldLayer).includes(weather)
}

/** 把不被允许的天气收窄到该世界层的缺省天气，而不是报错或留下无效状态。 */
export function coerceWeather(worldLayer: WorldLayer, weather: Weather): Weather {
  return isWeatherAllowed(worldLayer, weather) ? weather : 'clear'
}

export const DEFAULT_SCENE_ENVIRONMENT: SceneEnvironmentState = {
  worldLayer: 'surface',
  time: 'noon',
  weather: 'clear',
}

export const ALL_ENVIRONMENT_LAYERS_ON: EnvironmentToggles = {
  sky: true,
  celestial: true,
  farField: true,
  ground: true,
  weather: true,
  rearAtmosphere: true,
  rearSilhouette: true,
  neighborPlace: true,
  activePlace: true,
  foregroundAtmosphere: true,
}

export const MOON_PHASES: MoonPhase[] = ['crescent', 'half', 'full']

export const DEFAULT_MOON_PHASE: MoonPhase = 'crescent'

/**
 * 地平线高度：视口高度的 54%。
 *
 * 对齐手绘地景线稿（landscape_lines，与旧版地平线位置一致）的实际地平线
 * （画布 y≈496–560 / 1024）。上面是天空，下面是承载地点的地面空间，
 * 层间雾与落地关系共用这一个数 —— 摄影机高度只有一个真相来源。
 */
export const HORIZON_Y_PCT = 54

/**
 * 背景空间调色板：worldLayer × time 的 8 组底色。
 *
 * 黑白手绘线稿是世界本体，这里只负责时间与世界状态：
 * 表世界略自然略暖，里世界略冷略白略暗沉。全部低饱和，不用纯白。
 * skyTop = 天空底色，ground = 地面底色，horizon / skyLow 是两者间的
 * 自然过渡（不出现一块明显矩形地板）。
 * 颜色是空格分隔 RGB 三元组，CSS 用 rgb(var(--x) / alpha) 消费。
 */
const PALETTES: Record<WorldLayer, Record<TimeOfDay, EnvironmentPalette>> = {
  surface: {
    morning: {
      skyTop: '241 240 235',
      skyLow: '238 236 230',
      horizon: '237 235 229',
      ground: '233 230 222',
      groundLow: '225 222 214',
      far: '150 150 148',
      atmosphere: '240 238 232',
      light: '246 236 216',
    },
    noon: {
      skyTop: '239 238 233',
      skyLow: '236 234 228',
      horizon: '235 233 226',
      ground: '230 227 219',
      groundLow: '222 219 211',
      far: '148 148 146',
      atmosphere: '238 236 230',
      light: '248 244 230',
    },
    dusk: {
      skyTop: '231 224 219',
      skyLow: '228 221 216',
      horizon: '226 219 213',
      ground: '221 214 207',
      groundLow: '213 206 199',
      far: '142 136 132',
      atmosphere: '232 226 220',
      light: '240 220 200',
    },
    night: {
      skyTop: '201 205 211',
      skyLow: '200 203 209',
      horizon: '198 202 207',
      ground: '195 198 202',
      groundLow: '187 190 194',
      far: '120 124 130',
      atmosphere: '206 210 216',
      light: '216 222 230',
    },
  },
  inner: {
    morning: {
      skyTop: '236 239 238',
      skyLow: '233 236 235',
      horizon: '231 234 233',
      ground: '226 229 227',
      groundLow: '218 221 219',
      far: '140 144 143',
      atmosphere: '234 237 236',
      light: '236 240 240',
    },
    noon: {
      skyTop: '232 235 234',
      skyLow: '229 232 231',
      horizon: '227 230 229',
      ground: '221 225 223',
      groundLow: '213 217 215',
      far: '138 142 141',
      atmosphere: '230 233 232',
      light: '240 243 243',
    },
    dusk: {
      skyTop: '220 225 227',
      skyLow: '218 223 226',
      horizon: '216 222 225',
      ground: '212 218 222',
      groundLow: '204 210 214',
      far: '128 134 138',
      atmosphere: '222 227 230',
      light: '228 234 238',
    },
    night: {
      skyTop: '198 204 210',
      skyLow: '195 202 208',
      horizon: '193 200 206',
      ground: '188 195 202',
      groundLow: '180 187 194',
      far: '114 120 127',
      atmosphere: '202 208 214',
      light: '210 217 226',
    },
  },
}

/**
 * 统一环境分级：时间 → 明暗与对比的基准。
 *
 * morning 较亮较柔低对比；noon 最亮、对比略清楚；
 * dusk 略暗远景稍沉；night 冷灰压暗但地点仍可读。
 * 云量与里世界在解算时再乘上去 —— 背景与地点消费同一份结果。
 */
const TIME_GRADE: Record<TimeOfDay, { brightness: number; contrast: number }> = {
  morning: { brightness: 1.0, contrast: 0.95 },
  noon: { brightness: 1.03, contrast: 1.0 },
  dusk: { brightness: 0.93, contrast: 0.97 },
  night: { brightness: 0.78, contrast: 0.94 },
}

/**
 * 天体姿态：同一张 sun_bw 靠 position / scale / opacity 区分三个时段，
 * 不新增生图。全部位于高位边缘（右上），不压主建筑、不做画面主角。
 * dx/dy 是从资产原生构图位（画布中心附近）出发的平移。
 */
const SUN_POSES: Record<TimeOfDay, { dxVw: number; dyVh: number; scale: number; opacity: number }> = {
  morning: { dxVw: 22, dyVh: -25, scale: 0.3, opacity: 0.72 },
  noon: { dxVw: 27, dyVh: -30, scale: 0.26, opacity: 0.62 },
  dusk: { dxVw: 30, dyVh: -19, scale: 0.33, opacity: 0.8 },
  // night 无太阳；占位保持结构完整
  night: { dxVw: 26, dyVh: -26, scale: 0.3, opacity: 0 },
}

const MOON_POSE = { dxVw: 26, dyVh: -26, scale: 0.32, opacity: 0.85 }

/**
 * 天体的种类与位置。
 *
 * 太阳与月亮走同一套坐标，只是不同时间出现在不同角度：
 * 清晨低角度偏左，正午高角度偏右，黄昏继续落向右侧，夜晚换成右上方月亮。
 * 日夜转换因此不需要换掉任何地点资产。
 */
function resolveCelestialPlacement(time: TimeOfDay): { body: CelestialBody; xPct: number; yPct: number } {
  switch (time) {
    case 'morning':
      return { body: 'sun', xPct: 21, yPct: 30 }
    case 'noon':
      return { body: 'sun', xPct: 64, yPct: 10 }
    case 'dusk':
      return { body: 'sun', xPct: 82, yPct: 34 }
    case 'night':
      return { body: 'moon', xPct: 74, yPct: 17 }
  }
}

/** 天气对云量与降水强度的贡献。天体遮蔽由云量推导，不是另写一份判断。 */
function resolvePrecipitation(weather: Weather): { intensity: number; cloudCover: number } {
  switch (weather) {
    case 'clear':
      return { intensity: 0, cloudCover: 0.12 }
    case 'rain':
      return { intensity: 0.68, cloudCover: 0.82 }
    case 'snow':
      return { intensity: 0.5, cloudCover: 0.7 }
  }
}

/** 时间对天空亮度的贡献。 */
function baseLuminance(time: TimeOfDay): number {
  switch (time) {
    case 'morning':
      return 0.82
    case 'noon':
      return 1
    case 'dusk':
      return 0.66
    case 'night':
      return 0.3
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * 场景状态 → 视觉参数。
 *
 * 纯函数，没有副作用，也不认识 DOM。
 */
export function resolveEnvironment(scene: SceneEnvironmentState): ResolvedEnvironment {
  const weather = coerceWeather(scene.worldLayer, scene.weather)
  const resolved: SceneEnvironmentState = { ...scene, weather }

  const placement = resolveCelestialPlacement(resolved.time)
  const precipitation = resolvePrecipitation(weather)
  const inner = resolved.worldLayer === 'inner'

  return {
    scene: resolved,
    sky: {
      variant: `${resolved.worldLayer}-${resolved.time}`,
      // 云层压暗天空；里世界整体再低一档
      luminance: clamp01(baseLuminance(resolved.time) * (1 - precipitation.cloudCover * 0.34) * (inner ? 0.78 : 1)),
    },
    celestial: {
      ...placement,
      // 遮蔽只由云量决定 —— 太阳月亮星星永远不画进天气贴图
      occlusion: clamp01(precipitation.cloudCover),
      // 星星只在晴朗夜晚出现，且里世界看不到
      stars: resolved.time === 'night' && weather === 'clear' && !inner,
      moonPhase: resolved.moonPhase ?? DEFAULT_MOON_PHASE,
      pose: placement.body === 'moon' ? MOON_POSE : SUN_POSES[resolved.time],
    },
    weather: {
      kind: weather,
      intensity: precipitation.intensity,
      cloudCover: precipitation.cloudCover,
    },
    atmosphere: {
      haze: clamp01(0.16 + precipitation.cloudCover * 0.3 + (resolved.time === 'night' ? 0.12 : 0)),
      seepage: inner ? 0.55 : 0,
    },
    palette: PALETTES[resolved.worldLayer][resolved.time],
    grade: {
      // 云量压暗 + 里世界略暗沉，与时间基准相乘 —— 只有这一份分级，
      // 背景与地点共同消费
      brightness: Math.max(
        0.4,
        TIME_GRADE[resolved.time].brightness
          * (1 - precipitation.cloudCover * 0.16)
          * (inner ? 0.94 : 1),
      ),
      contrast: TIME_GRADE[resolved.time].contrast * (inner ? 0.99 : 1),
    },
    horizonYPct: HORIZON_Y_PCT,
  }
}

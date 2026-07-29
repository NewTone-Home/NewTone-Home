import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { EnvironmentToggles, MoonPhase, ResolvedEnvironment } from './environmentTypes'
import './EnvironmentSystem.css'

/**
 * 透明手绘线稿背景资产（1536 × 1024 RGBA，真实透明底）：
 *
 *   sky_clouds_line.png   云层线稿（属于天空空间）
 *   landscape_lines.png   远山 / 地平线 / 地面线稿
 *   sun / moon×3 / stars  天体
 *
 * 原则：透明手绘资产负责线条与内容；
 * 运行时 CSS 负责天空底色、地面底色、光色、明暗和过渡。
 * 不再使用整张彩色背景图。
 */
const BACKGROUND_ASSET_BASE = `${import.meta.env.BASE_URL}assets/center/place-stage-background/`

const MOON_ASSETS: Record<MoonPhase, string> = {
  crescent: 'moon_crescent_bw.png',
  half: 'moon_half_bw.png',
  full: 'moon_full_bw.png',
}

const MOON_PHASE_KEYS = Object.keys(MOON_ASSETS) as MoonPhase[]

/**
 * 全局环境系统的视觉层。
 *
 * 分层是硬要求，不是排版洁癖：
 *
 *   Environment
 *   ├── SkyLayer
 *   ├── CelestialLayer   (Sun / Moon / Stars)
 *   ├── WeatherLayer     (Rain / Snow)
 *   └── AtmosphereLayer
 *
 * 静态的归静态（天空、日月星、云），动态的归程序（雨雪粒子、云移动）。
 * 这里不存在也不会生成「雨天.jpg / 雪天.jpg / 夜晚.jpg」——
 * 时间 4 档 × 天气 3 种 × 世界层 2 个的组合在渲染时发生，不在资产里发生。
 *
 * 组件只读 ResolvedEnvironment，所有条件判断都已经在 resolveEnvironment 做完。
 */

interface EnvironmentLayerProps {
  environment: ResolvedEnvironment
}

interface EnvironmentSystemProps extends EnvironmentLayerProps {
  toggles: EnvironmentToggles
}

/**
 * 把解算结果写成一组 CSS 变量，供舞台根节点挂载。
 *
 * 背景四色（天空 / 地平线 / 地面 / 空气）与地平线高度是**共享空间参数**：
 * 不只环境层要用，地点的落地关系（层间雾、接触投影）也要参照同一套，
 * 因此统一从舞台根继承，而不是各层各写一份。
 */
export function environmentCssVars(environment: ResolvedEnvironment): CSSProperties {
  const { palette, grade } = environment
  return {
    '--env-sky-top': palette.skyTop,
    '--env-sky-low': palette.skyLow,
    '--env-horizon': palette.horizon,
    '--env-ground': palette.ground,
    '--env-ground-low': palette.groundLow,
    '--env-far': palette.far,
    '--env-atmos': palette.atmosphere,
    '--env-light': palette.light,
    '--env-horizon-y': `${environment.horizonYPct}%`,
    '--env-luminance': environment.sky.luminance,
    '--env-haze': environment.atmosphere.haze,
    '--env-seepage': environment.atmosphere.seepage,
    /*
      统一环境分级：舞台根整体消费，背景线稿与地点四层一起变亮变暗。
      写成字面量 filter 而不是 filter: brightness(var(--x))：后者的声明值
      文本恒定，带 transition 时不会重算，时间切换会整档卡住。
    */
    filter: `brightness(${grade.brightness.toFixed(4)}) contrast(${grade.contrast.toFixed(4)})`,
  } as CSSProperties
}

/**
 * 天空。两件事：
 *
 * 1. 运行时天空 / 地面底色 —— 一条跨越地平线的柔和过渡（不是纯白，
 *    也不是一块矩形地板），颜色来自调色板，随时间与世界层变化；
 * 2. sky_clouds_line 云层线稿 —— 云属于天空空间，随统一相机 ×0.03 平移。
 *
 * 地点透明资产的空隙、屋顶上方与门洞会透出它。
 */
export function SkyLayer({ environment }: EnvironmentLayerProps) {
  return (
    <div
      className="env-layer env-sky"
      data-variant={environment.sky.variant}
      aria-hidden="true"
    >
      <span className="env-base-colors" />
      {/*
        云属于天空空间。资产本身是满画布云纹（下半部也有笔触），
        因此这里裁到地平线以上，并在接近地平线处淡出 ——
        云绝不铺到地面上。
      */}
      <span className="env-sky-clouds">
        <img
          className="env-clouds-art"
          src={`${BACKGROUND_ASSET_BASE}sky_clouds_line.png`}
          alt=""
          draggable={false}
        />
      </span>
    </div>
  )
}

/**
 * 天体。与天气完全解耦，全部是手绘图资产 —— 不再有 CSS 圆球或 SVG 天体。
 *
 * 太阳、月亮、星星与天空同画布：天体在原生构图位置从地平线后升起，
 * 地景层随后压住它们的下缘。太阳与月亮互斥（由时间决定），
 * 月相由场景状态决定；三张月相图常驻挂载，各自独立淡入淡出。
 * 阴天由云量遮蔽（occlusion 压低透明度），不替换资产。
 * 位置 / 缩放留有运行时旋钮：--celestial-dx / --celestial-dy / --celestial-scale。
 */
export function CelestialLayer({ environment }: EnvironmentLayerProps) {
  const { body, occlusion, stars, moonPhase, pose } = environment.celestial
  const bodyOpacity = (1 - occlusion * 0.86) * pose.opacity

  /*
    最终透明度在这里算成一个**字面量数值**再写进内联样式。

    刻意不写成 CSS 的 calc(var(--a) * var(--b))：那样声明值的文本永远不变，
    带 transition 的属性就不会重启过渡，计算值会卡在上一次的数值 ——
    夜晚太阳不灭、月亮不亮正是这么来的。字面量变化才能正常触发交叉淡入淡出。
  */
  return (
    <div
      className="env-layer env-celestial"
      style={{
        /* 姿态由模型给出：morning/noon/dusk 用同一张太阳，只换位置/缩放/透明度 */
        '--celestial-dx': pose.dxVw,
        '--celestial-dy': pose.dyVh,
        '--celestial-scale': pose.scale,
      } as CSSProperties}
      aria-hidden="true"
    >
      {/* 星星在天体之下：月亮可以叠在星空前 */}
      <img
        className="env-bg-art env-celestial-art env-stars-art"
        data-visible={stars ? 'true' : 'false'}
        style={{ opacity: stars ? (1 - occlusion) * 0.8 : 0 }}
        src={`${BACKGROUND_ASSET_BASE}stars_bw.png`}
        alt=""
        draggable={false}
      />
      <img
        className="env-bg-art env-celestial-art env-sun-art"
        data-visible={body === 'sun' ? 'true' : 'false'}
        style={{ opacity: body === 'sun' ? bodyOpacity : 0 }}
        src={`${BACKGROUND_ASSET_BASE}sun_bw.png`}
        alt=""
        draggable={false}
      />
      {MOON_PHASE_KEYS.map(phase => {
        const visible = body === 'moon' && moonPhase === phase
        return (
          <img
            key={phase}
            className="env-bg-art env-celestial-art env-moon-art"
            data-visible={visible ? 'true' : 'false'}
            style={{ opacity: visible ? bodyOpacity : 0 }}
            src={`${BACKGROUND_ASSET_BASE}${MOON_ASSETS[phase]}`}
            alt=""
            draggable={false}
          />
        )
      })}
    </div>
  )
}

/**
 * 地景的视差带。同一张 landscape_lines（透明线稿）挂两份，各自只露出一条垂直区间，
 * **切口正落在地平线上** —— 那本来就是远山与地面相接的地方：
 *
 *   far    地平线以上：远山与村落剪影   ×0.05
 *   ground 地平线以下：地面笔触         ×0.10
 *
 * 刻意只有两条：任何落在山脊中间的切口都会让山形随速度差横向撕开。
 * 相机移动时两带按各自倍率平移，与云（×0.03）、天体（×0.02）、
 * 地点整体（0.14–0.42）构成同一条深度标尺 —— 全部消费舞台根上的
 * 同一个 --cam-final（drag 相机 + 指针分量）。
 * 不重新生图 —— 拆层发生在运行时，不发生在资产里。
 */
const LANDSCAPE_BANDS = [
  { band: 'far', plx: 0.05 },
  { band: 'ground', plx: 0.1 },
] as const

/**
 * 地景层。固定一张透明线稿地景（landscape_lines），不随时间与世界层更换 ——
 * 底色由天空层的运行时渐变承担，这里只有线条。
 *
 * 它压住天体下缘，但必须在地点层之下 —— 地景绝不盖住地点资产。
 * 层内按深度拆成三条视差带，全部消费舞台根上的同一个 --cam-final。
 */
export function LandscapeLayer(_: EnvironmentLayerProps) {
  return (
    <div className="env-layer env-landscape" aria-hidden="true">
      {LANDSCAPE_BANDS.map(({ band, plx }) => (
        <div
          key={band}
          className="env-land-band"
          data-band={band}
          style={{ '--band-plx': plx } as CSSProperties}
        >
          <img
            className="env-land-art"
            src={`${BACKGROUND_ASSET_BASE}landscape_lines.png`}
            alt=""
            draggable={false}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * 环境光色罩。黑白资产之上、地点资产之下的一层光色。
 *
 * 绘制内容归资产，冷暖归这里：表世界 morning / dusk 轻微偏暖、noon 中性，
 * 里世界更冷更白 —— 全部由调色板的 light 色经 color 混合模式染上去，
 * 不换地景、不换天空构图，也不产生第二套资产。
 */
export function LightWashLayer({ environment }: EnvironmentLayerProps) {
  return (
    <div
      className="env-layer env-lightwash"
      data-world={environment.scene.worldLayer}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// 降水粒子。
//
// 天气不是屏幕特效：不用 background-image / gradient / filter / 全屏叠层。
// 每个雨滴、每片雪都是空间中的独立元素，带自己的一份数据，
// 分 near / far 两个深度带 —— near 大、快、清晰；far 小、慢、淡。
// 雨与雪是两套互不复用的系统，只共享「确定性伪随机」这一个工具函数。
// ---------------------------------------------------------------------------

/** 确定性伪随机（mulberry32）：同一 band 每次渲染得到同一批粒子，不闪变。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface RainDrop {
  /** 水平位置，% */
  x: number
  /** reduced motion 下的静态落点，vh */
  y: number
  /** 长条的长度，px */
  length: number
  /** 宽度，px */
  width: number
  /** 落完全程的时长，s。越小越快。 */
  speed: number
  opacity: number
  /** 负值：让画面一开始就处于降雨中途，而不是齐刷刷从顶部出发。 */
  delay: number
  /** 与竖直方向的夹角，deg。方向一致，速度随机。 */
  angle: number
}

const RAIN_BANDS = {
  near: { count: 34, length: [18, 30], width: [1.4, 2], speed: [0.6, 0.85], opacity: [0.34, 0.5] },
  far: { count: 44, length: [8, 14], width: [1, 1.2], speed: [1, 1.5], opacity: [0.14, 0.26] },
} as const

function makeRainDrops(band: keyof typeof RAIN_BANDS, seed: number): RainDrop[] {
  const spec = RAIN_BANDS[band]
  const random = createRandom(seed)
  const range = (lo: number, hi: number) => lo + random() * (hi - lo)

  return Array.from({ length: spec.count }, () => {
    const speed = range(spec.speed[0], spec.speed[1])
    return {
      x: random() * 100,
      y: random() * 96,
      length: range(spec.length[0], spec.length[1]),
      width: range(spec.width[0], spec.width[1]),
      speed,
      opacity: range(spec.opacity[0], spec.opacity[1]),
      delay: -random() * speed,
      // 风向一致（约 8°），只允许极小的个体偏差
      angle: range(7, 9),
    }
  })
}

/** 落程固定走 125vh：从视口上方出发，出画后循环。 */
const FALL_DISTANCE_VH = 125

function RainField() {
  const bands = useMemo(
    () => (['near', 'far'] as const).map(band => ({
      band,
      drops: makeRainDrops(band, band === 'near' ? 11 : 47),
    })),
    [],
  )

  return (
    <span className="env-precip env-rain-field">
      {bands.map(({ band, drops }) => (
        <span key={band} className="env-rain-band" data-band={band}>
          {drops.map((drop, index) => (
            <i
              key={index}
              className="env-drop"
              style={{
                '--p-x': `${drop.x.toFixed(2)}%`,
                '--p-y': `${drop.y.toFixed(1)}vh`,
                '--p-len': `${drop.length.toFixed(1)}px`,
                '--p-w': `${drop.width.toFixed(2)}px`,
                '--p-dur': `${drop.speed.toFixed(2)}s`,
                '--p-opacity': drop.opacity.toFixed(2),
                '--p-delay': `${drop.delay.toFixed(2)}s`,
                // rotate 为负时长轴才与「右下」的位移方向一致
                '--p-rot': `${(-drop.angle).toFixed(1)}deg`,
                '--p-drift': `${(Math.tan((drop.angle * Math.PI) / 180) * FALL_DISTANCE_VH).toFixed(1)}vh`,
              } as CSSProperties}
            />
          ))}
        </span>
      ))}
    </span>
  )
}

interface SnowFlake {
  /** 水平位置，% */
  x: number
  /** reduced motion 下的静态落点，vh */
  y: number
  /** 直径，px */
  size: number
  /** 落完全程的时长，s。雪明显慢于雨。 */
  speed: number
  opacity: number
  delay: number
  /** 左右漂移的半幅，px */
  sway: number
  /** 一次左右漂移的时长，s */
  swayDuration: number
  /** 整程的整体横移，vh。轻微，可正可负。 */
  drift: number
}

const SNOW_BANDS = {
  near: { count: 22, size: [3, 5], speed: [7, 11], opacity: [0.55, 0.9], sway: [10, 22] },
  far: { count: 32, size: [1.5, 3], speed: [12, 19], opacity: [0.28, 0.5], sway: [6, 14] },
} as const

function makeSnowFlakes(band: keyof typeof SNOW_BANDS, seed: number): SnowFlake[] {
  const spec = SNOW_BANDS[band]
  const random = createRandom(seed)
  const range = (lo: number, hi: number) => lo + random() * (hi - lo)

  return Array.from({ length: spec.count }, () => {
    const speed = range(spec.speed[0], spec.speed[1])
    return {
      x: random() * 100,
      y: random() * 96,
      size: range(spec.size[0], spec.size[1]),
      speed,
      opacity: range(spec.opacity[0], spec.opacity[1]),
      delay: -random() * speed,
      sway: range(spec.sway[0], spec.sway[1]),
      swayDuration: range(2.6, 4.8),
      drift: range(-4, 4),
    }
  })
}

function SnowField() {
  const bands = useMemo(
    () => (['near', 'far'] as const).map(band => ({
      band,
      flakes: makeSnowFlakes(band, band === 'near' ? 23 : 71),
    })),
    [],
  )

  return (
    <span className="env-precip env-snow-field">
      {bands.map(({ band, flakes }) => (
        <span key={band} className="env-snow-band" data-band={band}>
          {flakes.map((flake, index) => (
            <span
              key={index}
              className="env-flake-fall"
              style={{
                '--p-x': `${flake.x.toFixed(2)}%`,
                '--p-y': `${flake.y.toFixed(1)}vh`,
                '--p-dur': `${flake.speed.toFixed(1)}s`,
                '--p-delay': `${flake.delay.toFixed(1)}s`,
                '--p-drift': `${flake.drift.toFixed(1)}vh`,
              } as CSSProperties}
            >
              <i
                className="env-flake"
                style={{
                  '--p-size': `${flake.size.toFixed(1)}px`,
                  '--p-opacity': flake.opacity.toFixed(2),
                  '--p-sway': `${flake.sway.toFixed(1)}px`,
                  '--p-sway-dur': `${flake.swayDuration.toFixed(1)}s`,
                } as CSSProperties}
              />
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

/**
 * 天气。只有云、雨、雪，没有任何天体。
 *
 * 降水是空间中的独立粒子（见上方 RainField / SnowField），
 * 雨与雪互不复用；云仍是静态资产 + 程序化平移。
 * 不是贴图，换时间、换世界层都不需要重导资产。
 */
export function WeatherLayer({ environment }: EnvironmentLayerProps) {
  const { kind, intensity, cloudCover } = environment.weather

  return (
    <div
      className="env-layer env-weather"
      data-weather={kind}
      style={{ '--env-intensity': intensity, '--env-cloud': cloudCover } as CSSProperties}
      aria-hidden="true"
    >
      <span className="env-clouds" />
      {kind === 'rain' && <RainField />}
      {kind === 'snow' && <SnowField />}
    </div>
  )
}

/**
 * 空气。雾、颗粒、空气透视、里世界渗透。
 *
 * 拆成前后两层，因为空气本来就同时存在于地点前方与后方。
 */
export function RearAtmosphereLayer({ environment }: EnvironmentLayerProps) {
  return (
    <div
      className="env-layer env-atmos env-atmos--rear"
      style={{
        '--env-haze': environment.atmosphere.haze,
        '--env-seepage': environment.atmosphere.seepage,
      } as CSSProperties}
      aria-hidden="true"
    />
  )
}

export function ForegroundAtmosphereLayer({ environment }: EnvironmentLayerProps) {
  return (
    <div
      className="env-layer env-atmos env-atmos--front"
      style={{
        '--env-haze': environment.atmosphere.haze,
        '--env-seepage': environment.atmosphere.seepage,
      } as CSSProperties}
      aria-hidden="true"
    />
  )
}

/** 地点后方的环境组：天空 → 天体 → 地景 → 光色罩 → 后方空气 → 天气。
    地景复用 ground 开关、光色罩复用 farField 开关 —— 开关键位保持不变。 */
export function EnvironmentBackdrop({ environment, toggles }: EnvironmentSystemProps) {
  return (
    <>
      {toggles.sky && <SkyLayer environment={environment} />}
      {toggles.celestial && <CelestialLayer environment={environment} />}
      {toggles.ground && <LandscapeLayer environment={environment} />}
      {toggles.farField && <LightWashLayer environment={environment} />}
      {toggles.rearAtmosphere && <RearAtmosphereLayer environment={environment} />}
      {toggles.weather && <WeatherLayer environment={environment} />}
    </>
  )
}

/** 地点前方的环境组。 */
export function EnvironmentForeground({ environment, toggles }: EnvironmentSystemProps) {
  if (!toggles.foregroundAtmosphere) return null
  return <ForegroundAtmosphereLayer environment={environment} />
}

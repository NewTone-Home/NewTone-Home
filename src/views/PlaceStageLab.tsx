import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { PlaceInfoPanel } from '../center-next/place-stage/PlaceInfoPanel'
import { PlaceStage } from '../center-next/place-stage/PlaceStage'
import type { PlaceStageApi } from '../center-next/place-stage/PlaceStage'
import { describeWeights } from '../center-next/place-stage/placeStageMath'
import {
  INNER_PLACES,
  SURFACE_PLACES,
  withImageProbe,
} from '../center-next/place-stage/placeStageLabModel'
import type { PlaceStageFrame } from '../center-next/place-stage/placeTransitionController'
import {
  ALL_ENVIRONMENT_LAYERS_ON,
  DEFAULT_SCENE_ENVIRONMENT,
  MOON_PHASES,
  TIMES_OF_DAY,
  coerceWeather,
  isWeatherAllowed,
} from '../center-next/environment/environmentModel'
import type {
  EnvironmentToggles,
  MoonPhase,
  SceneEnvironmentState,
} from '../center-next/environment/environmentTypes'
import type {
  PlaceStageDefinition,
  PlaceWorldLayer,
} from '../center-next/place-stage/placeStageTypes'
import { listTransitionStrategies } from '../center-next/place-stage/transitionStrategies'
import type { PlaceTransitionStrategyId } from '../center-next/place-stage/transitionStrategies'
import './PlaceStageLab.css'

/**
 * Phase 0.5：分层地点纸景舞台的隔离原型。
 *
 * 只验证舞台结构、80/20 前后权重、输入 / 过渡解耦与环境分层。
 * 不接正式 Center、Reader、committedLocation 与真实地点资产。
 *
 * 入口：?place-stage=1（?horizon-lab=1 为兼容别名）
 */

/** 调试档位。刻意不参与任何吸附集合 —— 拖动释放绝不会被吸到这些数上。 */
const DEBUG_STOPS = [0, 0.35, 0.5, 0.85, 1, 1.5, 2]

const LAYER_LABELS: Array<[keyof EnvironmentToggles, string]> = [
  ['sky', '天空'],
  ['celestial', '天体'],
  ['farField', '光色罩'],
  ['ground', '地景'],
  ['weather', '天气'],
  ['rearAtmosphere', '后方空气'],
  ['rearSilhouette', '未知剪影'],
  ['neighborPlace', '邻居地点'],
  ['activePlace', '主体地点'],
  ['foregroundAtmosphere', '前景空气'],
]

const MOON_PHASE_LABELS: Record<MoonPhase, string> = {
  crescent: '弦月',
  half: '半月',
  full: '满月',
}

/**
 * 从 URL 读初始场景状态，让验收可复现：
 * `?place-stage=1&time=night&weather=rain&world=inner&pos=0.5&hud=0`
 *
 * 这是 Lab 的调试入口，不是产品交互 —— 产品里这个对象由剧情驱动。
 * 非法值一律回落到缺省，里世界的天气仍然走 environmentModel 的收窄规则。
 */
function readSceneFromSearch(): SceneEnvironmentState {
  const params = new URLSearchParams(window.location.search)
  const worldLayer: PlaceWorldLayer = params.get('world') === 'inner' ? 'inner' : 'surface'
  const time = TIMES_OF_DAY.find(t => t === params.get('time')) ?? DEFAULT_SCENE_ENVIRONMENT.time
  const requested = params.get('weather')
  const weather = (['clear', 'rain', 'snow'] as const).find(w => w === requested)
    ?? DEFAULT_SCENE_ENVIRONMENT.weather
  const moonPhase = MOON_PHASES.find(p => p === params.get('moon'))

  return { worldLayer, time, weather: coerceWeather(worldLayer, weather), moonPhase }
}

/** `?pos=` 的一次性落位，用于截取推进途中的构图。 */
function readDebugPosition(): number | null {
  const raw = new URLSearchParams(window.location.search).get('pos')
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function PlaceStageLab() {
  const systemReduced = useReducedMotion()
  const [forceReduced, setForceReduced] = useState(false)
  const reduced = systemReduced || forceReduced

  // ?hud=0 收起仪表，用于不受遮挡地看整个世界空间（验收截图）
  const [hudOpen, setHudOpen] = useState(
    () => new URLSearchParams(window.location.search).get('hud') !== '0',
  )
  const [strategyId, setStrategyId] = useState<PlaceTransitionStrategyId>('place-shift')
  const [imageProbe, setImageProbe] = useState(false)
  const [toggles, setToggles] = useState<EnvironmentToggles>(ALL_ENVIRONMENT_LAYERS_ON)

  /**
   * 场景环境状态。
   *
   * 产品里这个对象由剧情驱动，用户不直接挑天气；HUD 只是剧情状态的替身，
   * 让本阶段能在没有剧情系统的情况下验证「状态 → 环境系统 → 视觉层」这条链路。
   */
  const [scene, setScene] = useState<SceneEnvironmentState>(readSceneFromSearch)
  const worldLayer = scene.worldLayer

  const [settledIndex, setSettledIndex] = useState(0)
  const [settled, setSettled] = useState(true)
  const [infoPlace, setInfoPlace] = useState<PlaceStageDefinition | null>(null)
  /** 收起时保留最后一个地点，信息层才能滑出去而不是直接消失。 */
  const lastInfoPlaceRef = useRef<PlaceStageDefinition | null>(null)
  if (infoPlace) lastInfoPlaceRef.current = infoPlace

  const apiRef = useRef<PlaceStageApi | null>(null)
  const positionOutRef = useRef<HTMLElement | null>(null)
  const weightOutRef = useRef<HTMLElement | null>(null)
  const phaseOutRef = useRef<HTMLElement | null>(null)

  const basePlaces = worldLayer === 'surface' ? SURFACE_PLACES : INNER_PLACES
  const places = useMemo(
    // 探针默认关闭：默认可见的 Lab 不使用任何完整地图图像
    () => (imageProbe ? basePlaces.map(withImageProbe) : basePlaces),
    [basePlaces, imageProbe],
  )
  const placeCount = places.length

  /** 每帧只写 DOM，不 setState —— HUD 不能成为拖动期间的重渲染来源。 */
  const handleFrame = useCallback((frame: PlaceStageFrame) => {
    if (positionOutRef.current) positionOutRef.current.textContent = frame.position.toFixed(3)
    if (phaseOutRef.current) phaseOutRef.current.textContent = frame.state.phase

    if (weightOutRef.current) {
      const weights = describeWeights(frame.position, placeCount)
      const low = places[frame.state.fromIndex]
      const high = frame.state.toIndex === null ? null : places[frame.state.toIndex]
      weightOutRef.current.textContent =
        `${low?.title ?? '—'} ${weights.low} / ${high?.title ?? '未知边界'} ${weights.high}`
    }
  }, [placeCount, places])

  const handleSettledChange = useCallback((index: number, isSettled: boolean) => {
    setSettledIndex(index)
    setSettled(isSettled)
    // 主体一旦离开稳定位，信息层不应继续挂在旧地点上
    if (!isSettled) setInfoPlace(null)
  }, [])

  const toggleLayer = useCallback((key: keyof EnvironmentToggles) => {
    setToggles(current => ({ ...current, [key]: !current[key] }))
  }, [])

  /**
   * 切换世界层时同步收窄天气。
   *
   * 里世界不下雪 —— 但这不是第二套天气系统，只是同一套枚举的子集，
   * 收窄规则住在 environmentModel，Lab 不自己判断。
   */
  const setWorldLayer = useCallback((next: PlaceWorldLayer) => {
    setScene(current => ({
      ...current,
      worldLayer: next,
      weather: coerceWeather(next, current.weather),
    }))
  }, [])

  // ?pos= 只在挂载后落一次位，之后交互完全接管
  useEffect(() => {
    const position = readDebugPosition()
    if (position !== null) apiRef.current?.debugJump(position)
  }, [])

  const activePlace = places[settledIndex]
  const infoOpen = infoPlace !== null

  return (
    <main className="plab" data-reduced={reduced ? 'true' : 'false'}>
      <header className="plab-header">
        <p>NewTone · PLACE STAGE LAB</p>
        <p className="plab-header-note">
          Phase 0.5 分层地点纸景舞台 · 不接 Center / Reader / 真实资产
        </p>
      </header>

      {/* 只复制正式 Shell 的栏宽与纸面，不接任何真实数据 */}
      <aside className="plab-rail plab-rail--read" aria-hidden="true">
        <p className="plab-rail-heading">阅读状态</p>
        <p className="plab-rail-inert">原型不接数据</p>
      </aside>

      <div className="plab-viewport">
        <PlaceStage
          key={worldLayer}
          places={places}
          environment={scene}
          toggles={toggles}
          strategyId={strategyId}
          reduced={reduced}
          infoOpen={infoOpen}
          apiRef={apiRef}
          onActivate={setInfoPlace}
          onFrame={handleFrame}
          onSettledChange={handleSettledChange}
        />

        <PlaceInfoPanel
          place={infoPlace ?? lastInfoPlaceRef.current}
          open={infoOpen}
          onClose={() => setInfoPlace(null)}
        />

        <div className="plab-arrows">
          <button
            type="button"
            onClick={() => apiRef.current?.commitTo(settledIndex - 1)}
            disabled={settledIndex <= 0}
            aria-label="上一个地点"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => apiRef.current?.commitTo(settledIndex + 1)}
            disabled={settledIndex >= placeCount - 1}
            aria-label="下一个地点"
          >
            →
          </button>
        </div>
      </div>

      <aside className="plab-rail plab-rail--modules" aria-hidden="true">
        <p className="plab-rail-heading">世界</p>
        <p className="plab-rail-inert">原型不接数据</p>
      </aside>

      {/* 舞台现在占满整个世界空间，HUD 是浮在世界之上的仪表，
          必须能收起来 —— 否则它会挡住右后方那 20%。 */}
      <button
        type="button"
        className="plab-hud-toggle"
        onClick={() => setHudOpen(open => !open)}
        aria-expanded={hudOpen}
      >
        {hudOpen ? 'HUD ✕' : 'HUD'}
      </button>

      <section className="plab-hud" data-open={hudOpen ? 'true' : 'false'} aria-label="原型读数">
        <dl className="plab-hud-readouts">
          <div>
            <dt>position</dt>
            <dd ref={positionOutRef}>0.000</dd>
          </div>
          <div>
            <dt>前后权重</dt>
            <dd ref={weightOutRef}>—</dd>
          </div>
          <div>
            <dt>phase</dt>
            <dd ref={phaseOutRef}>idle</dd>
          </div>
          <div>
            <dt>已结算</dt>
            <dd data-flag={settled ? 'on' : 'off'}>
              {settled ? `${settledIndex} · ${activePlace?.title ?? '—'}` : '否 · 中间态'}
            </dd>
          </div>
        </dl>

        <div className="plab-hud-group">
          <span className="plab-hud-label">世界层</span>
          {(['surface', 'inner'] as const).map(layer => (
            <button
              key={layer}
              type="button"
              data-on={worldLayer === layer ? 'true' : 'false'}
              onClick={() => setWorldLayer(layer)}
            >
              {layer === 'surface' ? '表世界' : '里世界'}
            </button>
          ))}
        </div>

        <div className="plab-hud-group">
          <span className="plab-hud-label">过渡策略</span>
          {listTransitionStrategies().map(id => (
            <button
              key={id}
              type="button"
              data-on={strategyId === id ? 'true' : 'false'}
              onClick={() => setStrategyId(id)}
            >
              {id}
            </button>
          ))}
        </div>

        {/* 剧情状态的替身。产品里这一组由剧情驱动，用户不直接挑天气。 */}
        <div className="plab-hud-group">
          <span className="plab-hud-label">时间（剧情驱动）</span>
          {TIMES_OF_DAY.map(time => (
            <button
              key={time}
              type="button"
              data-on={scene.time === time ? 'true' : 'false'}
              onClick={() => setScene(current => ({ ...current, time }))}
            >
              {time}
            </button>
          ))}
        </div>

        <div className="plab-hud-group">
          <span className="plab-hud-label">
            天气（{worldLayer === 'inner' ? '里世界不下雪' : '表世界'}）
          </span>
          {(['clear', 'rain', 'snow'] as const).map(weather => {
            const allowed = isWeatherAllowed(worldLayer, weather)
            return (
              <button
                key={weather}
                type="button"
                disabled={!allowed}
                data-on={scene.weather === weather ? 'true' : 'false'}
                onClick={() => setScene(current => ({ ...current, weather }))}
              >
                {weather}
              </button>
            )
          })}
        </div>

        <div className="plab-hud-group">
          <span className="plab-hud-label">月相（夜晚可见）</span>
          {MOON_PHASES.map(phase => (
            <button
              key={phase}
              type="button"
              data-on={(scene.moonPhase ?? 'crescent') === phase ? 'true' : 'false'}
              onClick={() => setScene(current => ({ ...current, moonPhase: phase }))}
            >
              {MOON_PHASE_LABELS[phase]}
            </button>
          ))}
        </div>

        <div className="plab-hud-group">
          <span className="plab-hud-label">层开关</span>
          {LAYER_LABELS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-on={toggles[key] ? 'true' : 'false'}
              onClick={() => toggleLayer(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="plab-hud-group">
          <span className="plab-hud-label">调试跳转</span>
          {DEBUG_STOPS.map(stop => (
            <button key={stop} type="button" onClick={() => apiRef.current?.debugJump(stop)}>
              {stop}
            </button>
          ))}
        </div>

        <div className="plab-hud-group">
          <label>
            <input
              type="checkbox"
              checked={forceReduced}
              onChange={event => setForceReduced(event.target.checked)}
            />
            强制 reduced motion{systemReduced ? '（系统已开启）' : ''}
          </label>
          <label>
            <input
              type="checkbox"
              checked={imageProbe}
              onChange={event => setImageProbe(event.target.checked)}
            />
            image 资产探针（默认关闭）
          </label>
        </div>

        <p className="plab-hud-hint">
          横向拖动切换地点 · 滚轮沿地点链深入 / 返回 · 点击建筑打开信息层
        </p>
      </section>
    </main>
  )
}

export default PlaceStageLab

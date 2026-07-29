import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, MouseEvent, RefObject } from 'react'
import {
  EnvironmentBackdrop,
  EnvironmentForeground,
  environmentCssVars,
} from '../environment/EnvironmentSystem'
import { resolveEnvironment } from '../environment/environmentModel'
import type { EnvironmentToggles, SceneEnvironmentState } from '../environment/environmentTypes'
import { RearSilhouetteLayer } from './PlaceEnvironmentLayers'
import { PlaceVisualLayers } from './PlaceVisualLayers'
import { FOREGROUND_PRESET } from './placeStageMath'
import { usePlaceParallax } from './usePlaceParallax'
import { usePlaceStageInput } from './usePlaceStageInput'
import { usePlaceTransitionController } from './placeTransitionController'
import type { PlaceStageFrame } from './placeTransitionController'
import type { PlaceSlotVisual, PlaceStageDefinition } from './placeStageTypes'
import type { PlaceTransitionStrategyId } from './transitionStrategies'

/**
 * 分层地点纸景舞台。
 *
 * 八个层级容器各自独立，即使只有 placeholder 也不合并。
 * 地点元素按 place.id 保持 DOM key，角色切换不卸载重挂。
 *
 * 组件不计算构图：每帧的视觉量由控制器经策略产生，这里只把它们写成 CSS 变量。
 */

interface PlaceStageProps {
  places: PlaceStageDefinition[]
  /**
   * 场景环境状态。剧情系统以后产出的就是这个对象 —— 舞台只是读它，
   * 既不拥有环境，也不自己判断「现在是不是晚上」。
   */
  environment: SceneEnvironmentState
  /** 层级开关。验收用：任何一层被关掉都必须真的消失。 */
  toggles: EnvironmentToggles
  strategyId: PlaceTransitionStrategyId
  reduced: boolean
  /** 信息层展开时：暂停舞台输入，其余舞台元素轻微后退变淡，主体保持清晰。 */
  infoOpen: boolean
  onActivate: (place: PlaceStageDefinition) => void
  /** 供 HUD 驱动箭头 / 索引跳转。 */
  apiRef?: RefObject<PlaceStageApi | null>
  /** 每帧读数，供 HUD 直接写 DOM 使用；不要在这里 setState。 */
  onFrame?: (frame: PlaceStageFrame) => void
  onSettledChange?: (settledIndex: number, settled: boolean) => void
}

/** 地点未声明画布比例时的缺省值：3 : 2。 */
const DEFAULT_CANVAS_RATIO = 1.5

export interface PlaceStageApi {
  /** 离散跳转到某个地点索引。左右箭头、键盘与索引跳转都走这里。 */
  commitTo: (targetIndex: number) => void
  /** HUD / 测试专用：无动画直接落到某个连续位置，不参与任何吸附集合。 */
  debugJump: (position: number) => void
  getPosition: () => number
}

function writeSlotVars(element: HTMLElement, slot: PlaceSlotVisual) {
  const style = element.style
  style.setProperty('--pv-visible', slot.visible.toFixed(3))
  style.setProperty('--pv-prom', slot.prominence.toFixed(4))
  style.setProperty('--pv-scale', slot.scale.toFixed(4))
  style.setProperty('--pv-x', slot.translateXPct.toFixed(3))
  style.setProperty('--pv-y', slot.translateYPct.toFixed(3))
  style.setProperty('--pv-z', String(slot.zIndex))
  style.setProperty('--pv-opacity', slot.opacity.toFixed(4))
  style.setProperty('--pv-veil', slot.veil.toFixed(4))
  style.setProperty('--pv-blur', slot.blurPx.toFixed(2))
  style.setProperty('--pv-unfold', slot.unfold.toFixed(4))
  style.setProperty('--pv-converge', slot.converge.toFixed(4))
  style.setProperty('--pv-unfold-delay', slot.unfoldDelay.toFixed(3))
  element.dataset.role = slot.role
  // 不在构图里的地点保留 DOM，但完全退出交互
  element.dataset.visible = slot.visible > 0 ? 'true' : 'false'
}

export function PlaceStage({
  places,
  environment,
  toggles,
  strategyId,
  reduced,
  infoOpen,
  onActivate,
  apiRef,
  onFrame,
  onSettledChange,
}: PlaceStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const placeElementsRef = useRef(new Map<number, HTMLElement>())
  const boundaryRef = useRef<HTMLDivElement | null>(null)
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  const placeCount = places.length

  /**
   * 场景状态 → 视觉参数。
   *
   * 所有条件判断（几点了、云遮不遮天体、里世界能不能下雪）都在
   * resolveEnvironment 里做完，舞台与各环境层只消费结果。
   */
  const resolved = useMemo(() => resolveEnvironment(environment), [environment])

  /** 每帧直接写 DOM，刻意不 setState —— 拖动期间地点组件零重渲染。 */
  const handleFrame = useCallback((frame: PlaceStageFrame) => {
    for (const [index, element] of placeElementsRef.current) {
      const slot = frame.slotByPlaceIndex.get(index)
      if (slot) writeSlotVars(element, slot)
    }

    const boundary = boundaryRef.current
    if (boundary) {
      if (frame.boundary) {
        writeSlotVars(boundary, frame.boundary)
        boundary.dataset.present = 'true'
      } else {
        boundary.dataset.present = 'false'
        boundary.style.setProperty('--pv-visible', '0')
      }
    }

    onFrameRef.current?.(frame)

    const stage = stageRef.current
    if (stage) {
      const offset = frame.position - frame.state.settledIndex
      stage.style.setProperty('--stage-offset', offset.toFixed(4))
      /*
        相机偏移：以地点链中心为原点的连续位置。
        与 --stage-offset 不同，它在换位结算时不回零 —— 背景各视差层
        消费的就是这一个值，因此背景移动与地点拖动共享同一个相机，
        不存在第二套动画时钟。
      */
      const camera = frame.position - (placeCount - 1) / 2
      stage.style.setProperty('--camera-x', camera.toFixed(4))
    }
  }, [placeCount])

  const controller = usePlaceTransitionController({
    placeCount,
    reduced,
    strategyId,
    onFrame: handleFrame,
  })

  const input = usePlaceStageInput({
    stageRef,
    reduced,
    enabled: !infoOpen,
    onIntent: controller.sendIntent,
    onRelease: controller.releaseContinuous,
  })

  usePlaceParallax({ stageRef, reduced, enabled: !infoOpen })

  useEffect(() => {
    onSettledChange?.(controller.settledIndex, controller.settled)
  }, [controller.settled, controller.settledIndex, onSettledChange])

  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      commitTo: targetIndex =>
        controller.sendIntent({ type: 'commit', source: 'arrow', targetIndex }),
      debugJump: controller.debugJump,
      getPosition: controller.getPosition,
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, controller])

  const handleStageClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    // 拖动的副产物 click 必须被吃掉，否则松手就会误进入
    if (input.isClickSuppressed()) return
    // 连续拖动留下的中间态没有操作语义；只允许稳定 80/20 构图响应点击。
    if (!controller.settled) return

    const visible = [...placeElementsRef.current.entries()]
      .filter(([, element]) => element.dataset.visible === 'true')
      .map(([index, element]) => {
        const canvas = element.querySelector<HTMLElement>('.pstage-place-canvas')
        return canvas
          ? { index, role: element.dataset.role, rect: canvas.getBoundingClientRect() }
          : null
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    const neighborLeft = visible
      .filter(entry => entry.role === 'neighbor')
      .reduce((left, entry) => Math.min(left, entry.rect.left), Number.POSITIVE_INFINITY)

    const hit = visible.find(entry => {
      const { left, right, top, bottom } = entry.rect
      const hitRight = entry.role === 'active' ? Math.min(right, neighborLeft) : right
      return event.clientX >= left
        && event.clientX <= hitRight
        && event.clientY >= top
        && event.clientY <= bottom
    })

    if (!hit) return
    const index = hit.index
    const place = places[index]
    if (!place) return
    controller.sendIntent({ type: 'activate', source: 'active-click', placeId: place.id })
    onActivate(place)
  }, [controller, input, onActivate, places])

  const registerPlaceElement = useCallback((index: number, element: HTMLElement | null) => {
    if (element) placeElementsRef.current.set(index, element)
    else placeElementsRef.current.delete(index)
  }, [])

  return (
    <div
      className="pstage"
      ref={stageRef}
      data-phase={controller.phase}
      data-reduced={reduced ? 'true' : 'false'}
      data-info-open={infoOpen ? 'true' : 'false'}
      data-settled-index={controller.settledIndex}
      data-place-count={placeCount}
      onClick={handleStageClick}
      /*
        主体构图偏移的绝对值，交给 CSS 做 contain 的预算。
        主体稳定在偏左的位置，母画布必须先扣掉这段偏移再等比缩放，
        否则会被 viewport 边缘裁掉 —— 数值只有 placeStageMath 一个来源。

        环境调色板与地平线也挂在根上：地点的落地关系（层间雾、接触投影）
        与背景层参照同一套空间参数，不各写一份。
      */
      style={{
        ...environmentCssVars(resolved),
        '--place-active-x-abs': Math.abs(FOREGROUND_PRESET.translateXPct),
      } as CSSProperties}
    >
      {/* 全局环境：天空 → 天体 → 天气 → 后方空气。
          任何地点复用同一套，因此这里传的是场景状态，不是某个地点的资产。 */}
      <EnvironmentBackdrop environment={resolved} toggles={toggles} />

      {/* 世界边界的暗示属于舞台空间结构，不跟着时间与天气走 */}
      <RearSilhouetteLayer toggles={toggles} />

      {/* 地点层。Active 与 Neighbor 共用同一套渲染模型与同一份 DOM，
          由 --pv-prom / --pv-unfold 决定这一帧读成主体还是剪影。 */}
      <div className="pstage-places">
        {/*
          层间地平线雾：z 介于邻居与主体之间。
          邻居的底边因此被远处空气轻微覆盖，主体完全在雾前 ——
          这是「邻居在更远的地点轴上」的空气证据，不是又一层滤镜。
        */}
        <span className="pstage-depth-fog" aria-hidden="true" />
        {controller.mountedIndices.map(index => {
          const place = places[index]
          if (!place) return null
          return (
            <div
              key={place.id}
              ref={element => registerPlaceElement(index, element)}
              className="pstage-place"
              data-place-id={place.id}
              data-stage-enabled={place.stageEnabled ? 'true' : 'false'}
              data-neighbor-hidden={toggles.neighborPlace ? 'false' : 'true'}
              data-active-hidden={toggles.activePlace ? 'false' : 'true'}
            >
              {/*
                地点母画布。舞台占满 viewport，地点却保持自身比例：
                这一层等比缩放到完整可见（绝不裁切），四组图层与褪色叠层
                全部住在里面，因此共享同一坐标系 —— 同 scale、同 origin，
                彼此之间只差 parallax。
              */}
              <div
                className="pstage-place-canvas"
                style={{
                  '--place-canvas-ratio': place.canvasAspectRatio ?? DEFAULT_CANVAS_RATIO,
                  translate:
                    `calc(-50% + ${place.visualOffsetXPct ?? 0}%) ${place.visualOffsetYPct ?? 0}%`,
                  scale: place.visualScale ?? 1,
                  transformOrigin: '50% 82%',
                } as CSSProperties}
              >
                {/* 与地面的接触投影：建筑站在地上，不是浮在底色上 */}
                <span className="pstage-place-contact" aria-hidden="true" />
                <PlaceVisualLayers definition={place} />
                <span className="pstage-place-veil" aria-hidden="true" />
              </div>
            </div>
          )
        })}

        {/*
          未知世界边界。不进地点数组、不占 index、不可点击、无名称。
          它没有自己的纸面 —— 只是统一背景与空气之上的一点未知剪影。
        */}
        <div
          className="pstage-boundary"
          ref={boundaryRef}
          data-present="false"
          data-hidden={toggles.rearSilhouette ? 'false' : 'true'}
          aria-hidden="true"
        >
          <span className="pstage-boundary-shape" data-depth="near" />
          <span className="pstage-boundary-shape" data-depth="far" />
        </div>
      </div>

      <EnvironmentForeground environment={resolved} toggles={toggles} />
    </div>
  )
}

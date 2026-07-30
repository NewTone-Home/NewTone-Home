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
import { isInsidePlaceActivationRegion } from './placeActivationRegions'
import { FOREGROUND_PRESET } from './placeStageMath'
import { usePlaceParallax } from './usePlaceParallax'
import { usePlaceStageInput } from './usePlaceStageInput'
import { usePlaceTransitionController } from './placeTransitionController'
import type { PlaceStageFrame } from './placeTransitionController'
import type { PlaceSlotVisual, PlaceStageDefinition } from './placeStageTypes'
import type { PlaceTransitionStrategyId } from './transitionStrategies'

interface PlaceStageProps {
  places: PlaceStageDefinition[]
  environment: SceneEnvironmentState
  toggles: EnvironmentToggles
  strategyId: PlaceTransitionStrategyId
  reduced: boolean
  infoOpen: boolean
  onActivate: (place: PlaceStageDefinition) => void
  apiRef?: RefObject<PlaceStageApi | null>
  onFrame?: (frame: PlaceStageFrame) => void
  onSettledChange?: (settledIndex: number, settled: boolean) => void
}

const DEFAULT_CANVAS_RATIO = 1.5

export interface PlaceStageApi {
  commitTo: (targetIndex: number) => void
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
  const resolved = useMemo(() => resolveEnvironment(environment), [environment])

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
    if (input.isClickSuppressed()) return
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
    const place = places[hit.index]
    if (!place) return

    // 20% 邻居只切换地点，永远不直接打开信息层。
    if (hit.role === 'neighbor') {
      controller.sendIntent({ type: 'commit', source: 'arrow', targetIndex: hit.index })
      return
    }

    if (hit.role !== 'active') return

    // 主体地点把屏幕点击换算为母画布归一化坐标，再走用户描出的轮廓。
    const width = hit.rect.width
    const height = hit.rect.height
    if (width <= 0 || height <= 0) return
    const x = (event.clientX - hit.rect.left) / width
    const y = (event.clientY - hit.rect.top) / height
    if (!isInsidePlaceActivationRegion(place.id, x, y)) return

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
      style={{
        ...environmentCssVars(resolved),
        '--place-active-x-abs': Math.abs(FOREGROUND_PRESET.translateXPct),
      } as CSSProperties}
    >
      <EnvironmentBackdrop environment={resolved} toggles={toggles} />
      <RearSilhouetteLayer toggles={toggles} />

      <div className="pstage-places">
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
                <span className="pstage-place-contact" aria-hidden="true" />
                <PlaceVisualLayers definition={place} />
                <span className="pstage-place-veil" aria-hidden="true" />
              </div>
            </div>
          )
        })}

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

'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent as ReactTransitionEvent } from 'react'
import { sceneFrameDefaultMotionMs, sceneFrameMotionMsForRect } from './sceneMotion'
import { measureSceneCharacterRects, measureSceneCharacters, sceneFocusVisualGapPx, sceneFocusStrokeInsetPx } from './sceneVisualBounds'
import { beginFrameAppearance, beginFrameRetraction, completeFrameTransition, frameShouldCollapse, frameVisualPhase, preserveFrameRetractCorner, resumeFrameAppearance, type SceneFrameRuntime, type SceneFrameTarget } from './sceneFrameLifecycle'
import { createEndpointMeasurementScheduler } from './sceneFocusFrameEndpointMeasure'

type FocusFrameCorner = SceneFrameRuntime['corner']

type SceneFocusFramesProps = {
  targets: readonly SceneFrameTarget[]
  /** A short transition snapshot keeps its already-computed frames, rather
   * than measuring transformed DOM on every presentation frame. */
  freezeMeasurements?: boolean
}

const frameCorners: readonly FocusFrameCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

export type SceneFocusFrameGeometry = {
  viewBox: string
  paths: Record<FocusFrameCorner, string>
}

function geometryDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 100
}

function geometryNumber(value: number) {
  return Number(value.toFixed(3))
}

export function sceneFocusFrameGeometry(width: number, height: number): SceneFocusFrameGeometry {
  const viewWidth = geometryDimension(width)
  const viewHeight = geometryDimension(height)
  const insetX = sceneFocusStrokeInsetPx
  const insetY = sceneFocusStrokeInsetPx
  const left = geometryNumber(insetX)
  const top = geometryNumber(insetY)
  const right = geometryNumber(viewWidth - insetX)
  const bottom = geometryNumber(viewHeight - insetY)
  const xView = geometryNumber(viewWidth)
  const yView = geometryNumber(viewHeight)
  return {
    viewBox: `0 0 ${xView} ${yView}`,
    paths: {
      'top-left': `M${left} ${top} H${right} V${bottom} H${left} V${top} Z`,
      'top-right': `M${right} ${top} V${bottom} H${left} V${top} H${right} Z`,
      'bottom-right': `M${right} ${bottom} H${left} V${top} H${right} V${bottom} Z`,
      'bottom-left': `M${left} ${bottom} V${top} H${right} V${bottom} H${left} Z`,
    },
  }
}

const defaultFrameGeometry = sceneFocusFrameGeometry(100, 100)

function randomCorner(): FocusFrameCorner {
  return frameCorners[Math.floor(Math.random() * frameCorners.length)]
}

function targetElement(event: { target: EventTarget | null }) {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-focus-target-group][data-focus-target-policy]')
    : null
}

/**
 * Owns only frame lifecycle and pointer emphasis. Navigation, scene exploration,
 * and route transitions provide explicit target metadata from above.
 */
export function useSceneFocusFrameController({ targets, freezeMeasurements = false }: SceneFocusFramesProps) {
  const targetMap = useMemo(() => new Map(targets.map((target) => [target.group, target] as const)), [targets])
  const targetGroupSignature = JSON.stringify(targets.map((target) => target.group).sort())
  const targetGroups = useMemo(() => new Set(targets.map((target) => target.group)), [targetGroupSignature])
  const retractRequestSignature = targets.map((target) => `${target.group}:${target.retractRequested ? 1 : 0}`).join('|')
  const [revision, setRevision] = useState(0)
  const runtimeRef = useRef(new Map<string, SceneFrameRuntime>())
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<ReadonlyMap<string, SceneFrameRuntime>>(new Map())
  const frameNodeRefsRef = useRef(new Map<string, (node: HTMLSpanElement | null) => void>())
  const frameNodesRef = useRef(new Map<string, HTMLSpanElement>())
  const measureGroupRef = useRef<(group: string) => void>(() => {})
  const [frameNodesRevision, setFrameNodesRevision] = useState(0)
  const [frameMeasurements, setFrameMeasurements] = useState<ReadonlyMap<string, { duration: number; geometry: SceneFocusFrameGeometry; bounds: CSSProperties }>>(new Map())
  const lastPointerTypeRef = useRef(new Map<string, string>())

  const bump = useCallback(() => {
    setRuntimeSnapshot(new Map([...runtimeRef.current].map(([group, runtime]) => [group, { ...runtime }] as const)))
    setRevision((value) => value + 1)
  }, [])

  useLayoutEffect(() => {
    let changed = false
    targetMap.forEach((_target, group) => {
      if (runtimeRef.current.has(group)) return
      runtimeRef.current.set(group, {
        corner: randomCorner(),
        phase: 'hidden',
        fullyCollapsed: true,
        preserveCornerOnResume: false,
        resumeCorner: null,
        transitionDirection: null,
        transitionStartedAt: 0,
        initialized: false,
        hovered: false,
        locked: false,
      })
      changed = true
    })
    runtimeRef.current.forEach((_runtime, group) => {
      if (targetMap.has(group)) return
      runtimeRef.current.delete(group)
      lastPointerTypeRef.current.delete(group)
      changed = true
    })
    if (changed) bump()
  }, [bump, targetMap])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const transitionStartedAt = window.performance.now()
    let changed = false
    targetMap.forEach((target, group) => {
      const runtime = runtimeRef.current.get(group)
      if (!runtime) return
      if (target.retractRequested) {
        preserveFrameRetractCorner(runtime)
        return
      }
      if ((runtime.phase !== 'retracting' && runtime.phase !== 'hidden') || !runtime.preserveCornerOnResume) return
      resumeFrameAppearance(runtime, randomCorner(), transitionStartedAt)
      changed = true
    })
    if (changed) bump()
  }, [bump, retractRequestSignature, targetMap])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const frameId = window.requestAnimationFrame(() => {
      const transitionStartedAt = window.performance.now()
      let changed = false
      targetMap.forEach((target, group) => {
        const runtime = runtimeRef.current.get(group)
        if (!runtime) return
        if (runtime.locked && !runtime.hovered && !target.interactionBusy) {
          runtime.locked = false
          changed = true
        }
        const shouldCollapse = frameShouldCollapse(target, runtime)
        if (!runtime.initialized) {
          runtime.initialized = true
          if (shouldCollapse) {
            runtime.phase = 'hidden'
            runtime.fullyCollapsed = true
            runtime.transitionDirection = null
          } else {
            beginFrameAppearance(runtime, transitionStartedAt)
          }
          changed = true
          return
        }
        if (shouldCollapse) {
          if (target.retractRequested) preserveFrameRetractCorner(runtime)
          if (runtime.phase === 'visible' || runtime.phase === 'appearing') {
            beginFrameRetraction(runtime, transitionStartedAt, target.retractRequested)
            changed = true
          }
          return
        }
        if (runtime.phase === 'hidden' || runtime.phase === 'retracting') {
          resumeFrameAppearance(runtime, randomCorner(), transitionStartedAt)
          changed = true
        }
      })
      if (changed) bump()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [bump, retractRequestSignature, revision, targetMap])

  const updateInteraction = useCallback((group: string, update: (runtime: SceneFrameRuntime) => void) => {
    const runtime = runtimeRef.current.get(group)
    if (!runtime) return
    update(runtime)
    bump()
  }, [bump])

  const frameRefFor = useCallback((group: string) => {
    const existing = frameNodeRefsRef.current.get(group)
    if (existing) return existing
    const ref = (node: HTMLSpanElement | null) => {
      if (node) frameNodesRef.current.set(group, node)
      else frameNodesRef.current.delete(group)
      setFrameNodesRevision((value) => value + 1)
    }
    frameNodeRefsRef.current.set(group, ref)
    return ref
  }, [])

  const remeasureGroup = useCallback((group: string) => measureGroupRef.current(group), [])

  useLayoutEffect(() => {
    if (freezeMeasurements) return undefined
    const measure = (groups: Iterable<string> = targetGroups) => {
      const updates = new Map<string, { duration: number; geometry: SceneFocusFrameGeometry; bounds: CSSProperties }>()
      for (const group of groups) {
        const node = frameNodesRef.current.get(group)
        if (!node) continue
        const parent = node.parentElement
        const stage = node.closest('.mainline-scene-stage')
        if (!parent || !stage) continue
        const characters = [...stage.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
          .filter(element => element.dataset.focusVisualGroup === group)
        const rect = measureSceneCharacters(characters)
        if (!rect) continue
        const otherCharacters = [...stage.querySelectorAll<HTMLElement>('[data-scene-characters]')]
          .filter(element => !characters.some(target => target === element || target.contains(element) || element.contains(target)))
        const neighbors = measureSceneCharacterRects(otherCharacters)
        const origin = parent.getBoundingClientRect()
        const parentStyle = getComputedStyle(parent)
        const borderSize = (axis: 'x' | 'y') => {
          const sides = axis === 'x' ? ['Left', 'Right'] : ['Top', 'Bottom']
          const extra = parentStyle.boxSizing === 'border-box' ? 0 : sides.reduce((sum, side) => sum
            + (Number.parseFloat(parentStyle.getPropertyValue(`padding-${side.toLowerCase()}`)) || 0)
            + (Number.parseFloat(parentStyle.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0), 0)
          return (Number.parseFloat(axis === 'x' ? parentStyle.width : parentStyle.height) || 0) + extra
        }
        const scaleX = origin.width > 0 ? origin.width / (borderSize('x') || origin.width) : 1
        const scaleY = origin.height > 0 ? origin.height / (borderSize('y') || origin.height) : 1
        const nominalMargin = sceneFocusVisualGapPx + sceneFocusStrokeInsetPx
        const minMargin = sceneFocusStrokeInsetPx + .5
        const crowdingMargin = (distance: number) => Math.min(nominalMargin, Math.max(minMargin, minMargin + (distance - 1) / 2))
        let leftMargin = nominalMargin
        let rightMargin = nominalMargin
        let topMargin = nominalMargin
        let bottomMargin = nominalMargin
        neighbors.forEach(neighbor => {
          const overlapsX = neighbor.left < rect.right && neighbor.right > rect.left
          const overlapsY = neighbor.top < rect.bottom && neighbor.bottom > rect.top
          if (overlapsX && neighbor.bottom <= rect.top) topMargin = Math.min(topMargin, crowdingMargin(rect.top - neighbor.bottom))
          if (overlapsX && neighbor.top >= rect.bottom) bottomMargin = Math.min(bottomMargin, crowdingMargin(neighbor.top - rect.bottom))
          if (overlapsY && neighbor.right <= rect.left) leftMargin = Math.min(leftMargin, crowdingMargin(rect.left - neighbor.right))
          if (overlapsY && neighbor.left >= rect.right) rightMargin = Math.min(rightMargin, crowdingMargin(neighbor.left - rect.right))
        })
        const width = rect.right - rect.left + leftMargin + rightMargin
        const height = rect.bottom - rect.top + topMargin + bottomMargin
        updates.set(group, {
          duration: sceneFrameMotionMsForRect(width, height),
          geometry: sceneFocusFrameGeometry(width, height),
          bounds: { left: (rect.left - origin.left - leftMargin) / scaleX, top: (rect.top - origin.top - topMargin) / scaleY, width: width / scaleX, height: height / scaleY },
        })
      }
      setFrameMeasurements((current) => {
        const next = new Map(current)
        let changed = false
        for (const [group, measurement] of updates) {
          const previous = current.get(group)
          if (!previous || previous.duration !== measurement.duration || previous.geometry.viewBox !== measurement.geometry.viewBox || JSON.stringify(previous.bounds) !== JSON.stringify(measurement.bounds)) {
            next.set(group, measurement)
            changed = true
          }
        }
        return changed ? next : current
      })
    }

    const measureAll = () => measure()
    measureGroupRef.current = (group) => measure([group])
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measureAll)
    const characterChanges = new MutationObserver(measureAll)
    const endpointSchedulers = new Map<HTMLElement, ReturnType<typeof createEndpointMeasurementScheduler>>()
    const characterProgressChanges = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.attributeName !== 'data-character-progress') return
        const host = record.target as HTMLElement
        let scheduler = endpointSchedulers.get(host)
        if (!scheduler) {
          scheduler = createEndpointMeasurementScheduler(window, () => Number.parseFloat(host.dataset.characterProgress ?? ''), () => {
            const groups = [...host.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
              .map((element) => element.dataset.focusVisualGroup ?? '')
              .filter((group) => targetGroups.has(group))
            measure(groups)
          })
          endpointSchedulers.set(host, scheduler)
        }
        scheduler.progressChanged()
        // A storefront rolls the replacement glyph across the baseline door.
        // The scheduler ignores intermediate positions and measures only if
        // the same endpoint remains current through both animation frames.
      })
    })
    frameNodesRef.current.forEach((node, group) => {
      if (!targetGroups.has(group)) return
      if (node.parentElement) observer.observe(node.parentElement)
      node.closest('.mainline-scene-stage')?.querySelectorAll<HTMLElement>('[data-focus-visual-group]').forEach(element => {
        if (element.dataset.focusVisualGroup === group) {
          observer.observe(element)
          characterChanges.observe(element, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
        }
      })
    })
    const stages = new Set([...frameNodesRef.current.entries()]
      .filter(([group]) => targetGroups.has(group))
      .map(([, node]) => node.closest('.mainline-scene-stage'))
      .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement))
    stages.forEach((stage) => {
      stage.querySelectorAll<HTMLElement>('[data-character-progress]').forEach((host) => {
        if ([...host.querySelectorAll<HTMLElement>('[data-focus-visual-group]')]
          .some((element) => targetGroups.has(element.dataset.focusVisualGroup ?? ''))) {
          characterProgressChanges.observe(host, { attributes: true, attributeFilter: ['data-character-progress'] })
        }
      })
    })
    document.fonts?.addEventListener('loadingdone', measureAll)
    return () => {
      observer.disconnect()
      characterChanges.disconnect()
      characterProgressChanges.disconnect()
      endpointSchedulers.forEach((scheduler) => scheduler.dispose())
      endpointSchedulers.clear()
      document.fonts?.removeEventListener('loadingdone', measureAll)
      measureGroupRef.current = () => {}
    }
  }, [frameNodesRevision, freezeMeasurements, targetGroups])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const timers: ReturnType<typeof setTimeout>[] = []
    targetMap.forEach((target, group) => {
      const runtime = runtimeRef.current.get(group)
      if (!runtime || !runtime.transitionDirection) return
      const direction = runtime.transitionDirection
      const transitionStartedAt = runtime.transitionStartedAt
      const duration = frameMeasurements.get(group)?.duration ?? sceneFrameDefaultMotionMs
      const elapsed = window.performance.now() - transitionStartedAt
      timers.push(window.setTimeout(() => {
        const currentRuntime = runtimeRef.current.get(group)
        const currentTarget = targetMap.get(group)
        if (!currentRuntime || !currentTarget || currentRuntime.transitionDirection !== direction
          || currentRuntime.transitionStartedAt !== transitionStartedAt) return
        if (completeFrameTransition(
          currentRuntime,
          frameShouldCollapse(currentTarget, currentRuntime),
          window.performance.now(),
          duration,
          true,
        )) bump()
      }, Math.max(0, duration - elapsed) + 50))
    })
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [bump, frameMeasurements, revision, targetMap])

  const onPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const element = targetElement(event)
    const group = element?.dataset.focusTargetGroup
    if (group && (element?.dataset.focusTargetPolicy === 'interactive' || element?.dataset.focusTargetPolicy === 'exploration')) {
      lastPointerTypeRef.current.set(group, event.pointerType)
    }
  }, [])

  const onPointerOverCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    const element = targetElement(event)
    const group = element?.dataset.focusTargetGroup
    if (!group || (element?.dataset.focusTargetPolicy !== 'interactive' && element?.dataset.focusTargetPolicy !== 'exploration')) return
    updateInteraction(group, (runtime) => { runtime.hovered = true })
  }, [updateInteraction])

  const onPointerOutCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    const element = targetElement(event)
    const group = element?.dataset.focusTargetGroup
    if (!group || (element?.dataset.focusTargetPolicy !== 'interactive' && element?.dataset.focusTargetPolicy !== 'exploration')) return
    const nextElement = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest<HTMLElement>('[data-focus-target-group][data-focus-target-policy]')
      : null
    if (nextElement?.dataset.focusTargetGroup === group) return
    lastPointerTypeRef.current.delete(group)
    updateInteraction(group, (runtime) => { runtime.hovered = false })
  }, [updateInteraction])

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const element = targetElement(event)
    const group = element?.dataset.focusTargetGroup
    if (!group || (element?.dataset.focusTargetPolicy !== 'interactive' && element?.dataset.focusTargetPolicy !== 'exploration')) return
    if (lastPointerTypeRef.current.get(group) === 'touch') return
    updateInteraction(group, (runtime) => { runtime.locked = true })
  }, [updateInteraction])

  const handleTransitionEnd = useCallback((group: string, event: ReactTransitionEvent<SVGPathElement>) => {
    if (event.propertyName !== 'stroke-dashoffset') return
    const runtime = runtimeRef.current.get(group)
    if (!runtime) return
    const target = targetMap.get(group)
    const style = window.getComputedStyle(event.currentTarget)
    const dashOffset = Number.parseFloat(style.strokeDashoffset)
    const reachedCurrentEndpoint = runtime.transitionDirection === 'retracting'
      ? dashOffset >= .999
      : dashOffset <= .001
    const elapsedMs = event.elapsedTime * 1000
    if (completeFrameTransition(runtime, target ? frameShouldCollapse(target, runtime) : true, event.timeStamp, elapsedMs, reachedCurrentEndpoint)) bump()
  }, [bump, targetMap])

  const renderFrame = useCallback((group: string): ReactNode => {
    const target = targetMap.get(group)
    const runtime = runtimeSnapshot.get(group)
    if (!target || !runtime) return null
    const measurement = frameMeasurements.get(group)
    if (!measurement) return (
      <span
        className="scene-focus-frame scene-focus-frame--measuring"
        style={{ width: 0, height: 0, visibility: 'hidden', '--scene-focus-stroke-offset': 1, '--scene-focus-frame-duration': `${sceneFrameDefaultMotionMs}ms` } as CSSProperties}
        data-focus-frame-group={group}
        data-focus-frame-policy={target.policy}
        data-focus-frame-phase={frameVisualPhase(runtime)}
        aria-hidden="true"
        ref={frameRefFor(group)}
      ><svg viewBox={defaultFrameGeometry.viewBox} preserveAspectRatio="none"><path pathLength="1" d={defaultFrameGeometry.paths[runtime.corner]} onTransitionEnd={(event) => handleTransitionEnd(group, event)} /></svg></span>
    )
    const collapsed = runtime.phase === 'hidden' || runtime.phase === 'retracting'
    const duration = measurement.duration
    const geometry = measurement.geometry
    const style = {
      ...measurement?.bounds,
      '--scene-focus-stroke-offset': collapsed ? 1 : 0,
      '--scene-focus-frame-duration': `${duration}ms`,
    } as CSSProperties
    return (
      <span
        className={`scene-focus-frame ${target.policy === 'exploration' ? 'scene-focus-frame--exploration' : ''} ${collapsed ? 'is-collapsed' : 'is-visible'} ${target.retractRequested ? 'is-requested-retraction' : ''}`}
        style={style}
        data-focus-frame-group={group}
        data-focus-frame-policy={target.policy}
        data-focus-frame-phase={frameVisualPhase(runtime)}
        data-focus-frame-corner={runtime.corner}
        aria-hidden="true"
        ref={frameRefFor(group)}
      >
        <svg viewBox={geometry.viewBox} preserveAspectRatio="none">
          <path pathLength="1" d={geometry.paths[runtime.corner]} onTransitionEnd={(event) => handleTransitionEnd(group, event)} />
        </svg>
      </span>
    )
  }, [frameMeasurements, frameRefFor, handleTransitionEnd, runtimeSnapshot, targetMap])

  const requestedRetractionsComplete = useMemo(() => {
    const requestedGroups = targets
      .filter((target) => target.retractRequested)
      .map((target) => target.group)
    if (requestedGroups.length === 0) return true
    return requestedGroups.every((group) => {
      const runtime = runtimeSnapshot.get(group)
      return runtime?.phase === 'hidden' && runtime.fullyCollapsed
    })
  }, [runtimeSnapshot, targets])

  const motionDurationMs = useCallback((group: string) => frameMeasurements.get(group)?.duration ?? sceneFrameDefaultMotionMs, [frameMeasurements])
  const maxMotionDurationMs = useMemo(() => Math.max(sceneFrameDefaultMotionMs, ...[...frameMeasurements.values()].map((measurement) => measurement.duration)), [frameMeasurements])

  const isCollapsed = useCallback((group: string) => {
    const runtime = runtimeSnapshot.get(group)
    return Boolean(runtime?.phase === 'hidden' && runtime.fullyCollapsed)
  }, [runtimeSnapshot])
  return { renderFrame, remeasureGroup, motionDurationMs, maxMotionDurationMs, onPointerDownCapture, onPointerOverCapture, onPointerOutCapture, onClickCapture, requestedRetractionsComplete, isCollapsed }
}

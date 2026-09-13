'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent as ReactTransitionEvent } from 'react'
import { sceneFocusMotionForPolicy } from './sceneMotion'
import { frameShouldCollapse, frameVisualPhase, type SceneFrameRuntime, type SceneFrameTarget } from './sceneFrameLifecycle'

type FocusFrameCorner = SceneFrameRuntime['corner']

type SceneFocusFramesProps = {
  targets: readonly SceneFrameTarget[]
}

const frameCorners: readonly FocusFrameCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const frameCornerPaths: Record<FocusFrameCorner, string> = {
  'top-left': 'M2 2 H98 V98 H2 V2',
  'top-right': 'M98 2 V98 H2 V2 H98',
  'bottom-right': 'M98 98 H2 V2 H98 V98',
  'bottom-left': 'M2 98 V2 H98 V98 H2',
}

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
export function useSceneFocusFrameController({ targets }: SceneFocusFramesProps) {
  const targetMap = useMemo(() => new Map(targets.map((target) => [target.group, target] as const)), [targets])
  const [revision, setRevision] = useState(0)
  const runtimeRef = useRef(new Map<string, SceneFrameRuntime>())
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<ReadonlyMap<string, SceneFrameRuntime>>(new Map())
  const renderedGroupsRef = useRef(new Set<string>())
  const [renderedGroups, setRenderedGroups] = useState<ReadonlySet<string>>(new Set())
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const frameId = window.requestAnimationFrame(() => {
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
          runtime.phase = shouldCollapse ? 'hidden' : 'appearing'
          runtime.fullyCollapsed = shouldCollapse
          changed = true
          return
        }
        if (shouldCollapse) {
          if (runtime.phase === 'visible' || runtime.phase === 'appearing') {
            runtime.phase = 'retracting'
            runtime.fullyCollapsed = false
            changed = true
          }
          return
        }
        if (runtime.phase === 'hidden' || runtime.phase === 'retracting') {
          runtime.corner = randomCorner()
          runtime.phase = 'appearing'
          runtime.fullyCollapsed = false
          changed = true
        }
      })
      if (changed) bump()
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [bump, revision, targetMap])

  useLayoutEffect(() => {
    const nextGroups = new Set(renderedGroupsRef.current)
    renderedGroupsRef.current.clear()
    setRenderedGroups((current) => {
      if (current.size === nextGroups.size && [...current].every((group) => nextGroups.has(group))) return current
      return nextGroups
    })
  }, [revision, runtimeSnapshot, targetMap])

  const updateInteraction = useCallback((group: string, update: (runtime: SceneFrameRuntime) => void) => {
    const runtime = runtimeRef.current.get(group)
    if (!runtime) return
    update(runtime)
    bump()
  }, [bump])

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
    if (runtime.phase === 'appearing') {
      runtime.phase = 'visible'
      runtime.fullyCollapsed = false
      bump()
      return
    }
    if (runtime.phase === 'retracting') {
      runtime.phase = 'hidden'
      runtime.fullyCollapsed = true
      bump()
    }
  }, [bump])

  const renderFrame = useCallback((group: string): ReactNode => {
    const target = targetMap.get(group)
    const runtime = runtimeSnapshot.get(group)
    if (!target || !runtime) return null
    renderedGroupsRef.current.add(group)
    const collapsed = runtime.phase === 'hidden' || runtime.phase === 'retracting'
    const style = {
      '--scene-focus-stroke-offset': collapsed ? 1000 : 0,
      '--scene-focus-frame-duration': `${sceneFocusMotionForPolicy(target.policy)}ms`,
    } as CSSProperties
    return (
      <span
        className={`scene-focus-frame ${target.policy === 'exploration' ? 'scene-focus-frame--exploration' : ''} ${collapsed ? 'is-collapsed' : 'is-visible'}`}
        style={style}
        data-focus-frame-group={group}
        data-focus-frame-policy={target.policy}
        data-focus-frame-phase={frameVisualPhase(runtime)}
        data-focus-frame-corner={runtime.corner}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={frameCornerPaths[runtime.corner]} onTransitionEnd={(event) => handleTransitionEnd(group, event)} />
        </svg>
      </span>
    )
  }, [handleTransitionEnd, runtimeSnapshot, targetMap])

  const requestedRetractionsComplete = useMemo(() => {
    const requestedGroups = targets
      .filter((target) => target.retractRequested && renderedGroups.has(target.group))
      .map((target) => target.group)
    if (requestedGroups.length === 0) return true
    return requestedGroups.every((group) => {
      const runtime = runtimeSnapshot.get(group)
      return runtime?.phase === 'hidden' && runtime.fullyCollapsed
    })
  }, [renderedGroups, runtimeSnapshot, targets])

  return { renderFrame, onPointerDownCapture, onPointerOverCapture, onPointerOutCapture, onClickCapture, requestedRetractionsComplete }
}

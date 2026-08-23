import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getLocalNarrativeGateBeatIndex } from '../../reader/narrativeGate'
import { getSceneBoundaryState } from '../../reader/readerFlow'
import './ReaderBeatStack.css'

const BOUNDARY_THRESHOLD_PX = 12
const SCENE_ENTRY_LIFT_PX = 240

export function getNativeBoundaries(viewport) {
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const scrollTop = viewport.scrollTop
  return {
    scrollTop,
    maxScrollTop,
    atTop: scrollTop <= BOUNDARY_THRESHOLD_PX,
    atBottom: maxScrollTop - scrollTop <= BOUNDARY_THRESHOLD_PX,
  }
}

export function getNativeEdgeSpace(viewport, flow) {
  const maxBeatHeight = Array.from(flow?.children ?? [])
    .reduce((height, beat) => Math.max(
      height,
      Number.isFinite(beat?.offsetHeight) ? beat.offsetHeight : 0,
    ), 0)
  return Math.max(0, Math.round((viewport.clientHeight - maxBeatHeight) / 2))
}

export function getBeatBlocksForLanguage(beat, language) {
  return (language === 'en' ? beat.translations?.en?.blocks : null) ?? beat.blocks
}

function ReaderBeatStack({
  beats,
  language = 'zh',
  languageTransitionPhase = 'idle',
  focusBeatIndex,
  focusRef,
  onNativeFocusChange,
  onNativeScrollOffset,
  onViewportBoundaryChange,
  sceneBoundaryRanges = [],
  sceneBoundaryControlRef,
  initialScrollOffset = 0,
  narrativeRuntimeEnabled = true,
  narrativeDeliveryStates = {},
  activeNarrativePauseId,
  activeNarrativeRevealId,
  activeNarrativeTypewriterId,
}) {
  const viewportRef = useRef(null)
  const flowRef = useRef(null)
  const frameRef = useRef(0)
  const lastReportedIndexRef = useRef(focusBeatIndex)
  const lastScrollTopRef = useRef(0)
  const activeSceneEntryRef = useRef([])
  const [nativeBoundary, setNativeBoundary] = useState({ atTop: false, atBottom: false })

  const localGateBeatIndex = getLocalNarrativeGateBeatIndex({
    beats,
    focusBeatIndex,
    deliveryStates: narrativeDeliveryStates,
  })

  const clearSceneEntryStyles = entry => {
    entry.removeAttribute('data-scene-entry-active')
    entry.style.removeProperty('--reader-scene-entry-opacity')
    entry.style.removeProperty('--reader-scene-entry-lift')
    entry.style.removeProperty('--reader-scene-entry-blur')
    entry.style.removeProperty('--reader-scene-entry-scale')
    entry.style.removeProperty('transition')
  }

  const applySceneBoundaryState = (state, flow) => {
    const nextSceneEntries = Number.isInteger(state?.toIndex) && Number.isInteger(state?.toEndIndex)
      ? Array.from(flow?.children ?? []).slice(state.toIndex, state.toEndIndex + 1)
      : []
    const progress = state?.progress ?? 1
    activeSceneEntryRef.current.forEach(clearSceneEntryStyles)

    if (nextSceneEntries.length === 0 || (state?.active && progress >= 0.999)) {
      activeSceneEntryRef.current = []
      return
    }

    nextSceneEntries.forEach((entry, index) => {
      entry.dataset.sceneEntryActive = 'true'
      entry.style.setProperty('--reader-scene-entry-opacity', String(Math.max(0.001, progress * (index === 0 ? 0.34 : 0.18))))
      entry.style.setProperty('--reader-scene-entry-lift', `${Math.round((1 - progress) * (index === 0 ? SCENE_ENTRY_LIFT_PX : SCENE_ENTRY_LIFT_PX / 2))}px`)
      entry.style.setProperty('--reader-scene-entry-blur', `${(1 - progress) * (index === 0 ? 2.8 : 2.2) + 1.2}px`)
      entry.style.setProperty('--reader-scene-entry-scale', `${0.985 + progress * 0.01}`)
      entry.style.setProperty('transition', 'none')
    })
    activeSceneEntryRef.current = nextSceneEntries
  }

  const reportViewportBoundary = () => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    if (!viewport || !flow) return
    const boundaries = getNativeBoundaries(viewport)
    const nextBoundary = {
      atTop: boundaries.atTop,
      atBottom: boundaries.atBottom,
    }
    setNativeBoundary(current => (
      current.atTop === nextBoundary.atTop && current.atBottom === nextBoundary.atBottom
        ? current
        : nextBoundary
    ))
    onViewportBoundaryChange?.({ direction: 0, ...nextBoundary, ...boundaries })
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    const focused = flow?.children[focusBeatIndex]
    if (!viewport || !flow || !focused) return undefined

    const syncNativeEdgeSpace = () => {
      const edgeSpace = getNativeEdgeSpace(viewport, flow)
      flow.style.setProperty('--reader-native-edge-space', `${edgeSpace}px`)
      const sceneBoundaryState = getSceneBoundaryState(viewport, flow, sceneBoundaryRanges)
      sceneBoundaryControlRef?.current?.setBoundaryProgress(sceneBoundaryState?.active ? sceneBoundaryState.progress : 1)
      applySceneBoundaryState(sceneBoundaryState, flow)
    }
    syncNativeEdgeSpace()

    const focusedTop = focused.offsetTop - (viewport.clientHeight - focused.offsetHeight) / 2
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const nextTop = initialScrollOffset > 0
      ? Math.min(initialScrollOffset, maxScrollTop)
      : Math.max(0, focusedTop)
    viewport.scrollTo({ top: nextTop, behavior: 'auto' })
    lastScrollTopRef.current = nextTop
    lastReportedIndexRef.current = focusBeatIndex

    const boundaryFrame = requestAnimationFrame(reportViewportBoundary)
    const observer = new ResizeObserver(syncNativeEdgeSpace)
    observer.observe(viewport)
    observer.observe(flow)
    return () => {
      cancelAnimationFrame(boundaryFrame)
      observer.disconnect()
    }
  }, [beats, initialScrollOffset, sceneBoundaryRanges, sceneBoundaryControlRef])

  useEffect(() => {
      setNativeBoundary({ atTop: false, atBottom: false })
      onViewportBoundaryChange?.({ direction: 0, atTop: false, atBottom: false })
  }, [beats, onViewportBoundaryChange])

  useEffect(() => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    if (!viewport || !flow) return undefined

    const updateFromScroll = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const currentScrollTop = viewport.scrollTop
        onNativeScrollOffset?.(currentScrollTop)
        const direction = Math.sign(currentScrollTop - lastScrollTopRef.current)
        lastScrollTopRef.current = currentScrollTop

        const viewportRect = viewport.getBoundingClientRect()
        const centerY = viewportRect.top + viewportRect.height / 2
        const flowRect = flow.getBoundingClientRect()
        let nearestIndex = 0
        let nearestDistance = Number.POSITIVE_INFINITY

        Array.from(flow.children).forEach((element, index) => {
          if (!(element instanceof HTMLElement) || !element.matches('.reader-stage-beat')) return
          const rect = element.getBoundingClientRect()
          const elementCenter = Number.isFinite(element.offsetTop) && Number.isFinite(element.offsetHeight)
            ? flowRect.top + element.offsetTop + element.offsetHeight / 2
            : rect.top + rect.height / 2
          const distance = Math.abs(elementCenter - centerY)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = index
          }
        })

        if (nearestIndex !== lastReportedIndexRef.current) {
          const accepted = onNativeFocusChange?.(nearestIndex)
          if (accepted !== false) lastReportedIndexRef.current = nearestIndex
        }

        const boundaries = getNativeBoundaries(viewport)
        const nextBoundary = {
          atTop: boundaries.atTop && nearestIndex === 0,
          atBottom: boundaries.atBottom && nearestIndex === beats.length - 1,
        }
        const sceneBoundaryState = getSceneBoundaryState(viewport, flow, sceneBoundaryRanges)
        sceneBoundaryControlRef?.current?.setBoundaryProgress(sceneBoundaryState?.active ? sceneBoundaryState.progress : 1)
        applySceneBoundaryState(sceneBoundaryState, flow)
        setNativeBoundary(current => (
          current.atTop === nextBoundary.atTop && current.atBottom === nextBoundary.atBottom
            ? current
            : nextBoundary
        ))
        onViewportBoundaryChange?.({
          direction,
          ...nextBoundary,
          scrollTop: boundaries.scrollTop,
          maxScrollTop: boundaries.maxScrollTop,
        })

      })
    }

    viewport.addEventListener('scroll', updateFromScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', updateFromScroll)
      cancelAnimationFrame(frameRef.current)
    }
  }, [beats, onNativeFocusChange, onNativeScrollOffset, onViewportBoundaryChange, sceneBoundaryRanges, sceneBoundaryControlRef])

  return (
    <div
      ref={viewportRef}
      className="reader-beat-stack"
      data-native-scroll="true"
      data-language-transition={languageTransitionPhase}
      data-scene-transition-flow="idle"
      data-reader-at-top={nativeBoundary.atTop ? 'true' : 'false'}
      data-reader-at-bottom={nativeBoundary.atBottom ? 'true' : 'false'}
      data-narrative-runtime={narrativeRuntimeEnabled ? 'enabled' : 'disabled'}
      data-narrative-pause={activeNarrativePauseId || 'idle'}
      data-narrative-reveal={activeNarrativeRevealId || 'idle'}
      data-narrative-typewriter={activeNarrativeTypewriterId || 'idle'}
      data-narrative-input-locked={activeNarrativePauseId || activeNarrativeRevealId || activeNarrativeTypewriterId ? 'true' : 'false'}
      aria-live="polite"
    >
      <div
        ref={flowRef}
        className="reader-beat-flow"
        style={{ transform: 'none' }}
      >
        {beats.map((beat, beatIndex) => {
          const distance = Math.abs(beatIndex - focusBeatIndex)
          const gated = localGateBeatIndex >= 0 && beatIndex > localGateBeatIndex
          return (
            <article
              key={beat.id}
              ref={distance === 0 ? focusRef : undefined}
              className="reader-stage-beat"
              aria-current={distance === 0 ? 'true' : undefined}
              aria-hidden={gated ? 'true' : undefined}
              tabIndex={distance === 0 ? -1 : undefined}
              data-distance={Math.min(distance, 4)}
              data-reader-beat-id={beat.id}
              data-reader-gated={gated ? 'true' : 'false'}
              data-display-unit-kind={beat.displayUnit?.kind ?? 'authored'}
            >
              {getBeatBlocksForLanguage(beat, language).map(block => {
                const deliveryState = narrativeDeliveryStates[`${beat.id}:${block.id}`] ?? 'delivered'
                const revealDelivery = deliveryState?.type === 'reveal' ? deliveryState : null
                const pauseDelivery = deliveryState?.type === 'pause' ? deliveryState : null
                const typewriterDelivery = deliveryState?.type === 'typewriter' ? deliveryState : null
                const activePauseBlock = Boolean(activeNarrativePauseId)
                  && beatIndex === focusBeatIndex
                  && pauseDelivery?.eventId === activeNarrativePauseId
                const activeRevealBlock = Boolean(activeNarrativeRevealId)
                  && revealDelivery?.eventId === activeNarrativeRevealId
                  && revealDelivery?.phase === 'revealing'
                const hideWholeBlock = deliveryState === 'pending'
                  || (pauseDelivery?.state === 'pending' && !activePauseBlock)
                return (
                  <p
                    key={`${beat.id}:${block.id}`}
                    className="reader-stage-block"
                    data-block-id={block.id}
                    data-narrative-delivery={revealDelivery?.state ?? pauseDelivery?.state ?? typewriterDelivery?.state ?? deliveryState}
                    data-pause-active={activePauseBlock ? 'true' : undefined}
                    data-pause-phase={pauseDelivery?.phase}
                    aria-hidden={hideWholeBlock ? 'true' : undefined}
                  >
                    {pauseDelivery ? (
                      <>
                        {pauseDelivery.textFrame?.before}
                        {activePauseBlock && pauseDelivery.phase === 'waiting' && (
                          <span className="reader-narrative-pause-rhythm" role="status" aria-label="叙事停顿">……</span>
                        )}
                        <span
                          data-pause-original="true"
                          data-narrative-segment-delivery={pauseDelivery.state === 'revealing' ? 'animating' : pauseDelivery.state === 'delivered' ? 'delivered' : 'pending'}
                          aria-hidden={pauseDelivery.state === 'delivered' ? undefined : 'true'}
                        >
                          {pauseDelivery.textFrame?.delayed ?? block.text}
                        </span>
                        <span
                          data-narrative-segment-delivery={pauseDelivery.state === 'delivered' ? 'delivered' : 'pending'}
                          aria-hidden={pauseDelivery.state === 'delivered' ? undefined : 'true'}
                        >
                          {pauseDelivery.textFrame?.after}
                        </span>
                      </>
                    ) : revealDelivery ? (
                      <>
                        <span className="reader-narrative-frame-before">{revealDelivery.textFrame.before}</span>
                        <span
                          className="reader-narrative-reveal-line"
                          data-narrative-reveal-line={activeRevealBlock ? 'animating' : revealDelivery.state === 'confirmed' ? 'delivered' : 'pending'}
                          data-reveal-presentation={revealDelivery.presentation}
                          style={activeRevealBlock ? { '--reveal-duration': `${revealDelivery.stepDurationMs}ms` } : undefined}
                          aria-hidden={revealDelivery.state === 'confirmed' ? undefined : 'true'}
                        >
                          {revealDelivery.segments.map((segment, segmentIndex) => (
                            <span key={segment.id} data-segment-id={segment.id}>
                              {segment.text}{revealDelivery.textFrame.between[segmentIndex] ?? ''}
                            </span>
                          ))}
                        </span>
                        <span
                          className="reader-narrative-frame-after"
                          data-narrative-segment-delivery={revealDelivery.state === 'confirmed' ? 'delivered' : 'pending'}
                          aria-hidden={revealDelivery.state === 'confirmed' ? undefined : 'true'}
                        >
                          {revealDelivery.textFrame.after}
                        </span>
                      </>
                    ) : typewriterDelivery ? (
                      <>
                        {typewriterDelivery.textFrame.before}
                        <span
                          data-narrative-typewriter-delivery="typed"
                          aria-hidden={typewriterDelivery.state === 'completed' ? undefined : 'true'}
                        >
                          {typewriterDelivery.textFrame.typed.slice(0, typewriterDelivery.visibleCharacterCount)}
                        </span>
                        <span data-narrative-typewriter-delivery="pending" aria-hidden="true">
                          {typewriterDelivery.textFrame.typed.slice(typewriterDelivery.visibleCharacterCount)}
                        </span>
                        <span
                          data-narrative-typewriter-delivery={typewriterDelivery.state === 'completed' ? 'typed' : 'pending'}
                          aria-hidden={typewriterDelivery.state === 'completed' ? undefined : 'true'}
                        >
                          {typewriterDelivery.textFrame.after}
                        </span>
                      </>
                    ) : block.text}
                  </p>
                )
              })}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ReaderBeatStack

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getLocalNarrativeGateBeatIndex } from '../../reader/narrativeGate'
import './ReaderBeatStack.css'

const NATIVE_SCROLL_QUERY = '(hover: none), (pointer: coarse), (max-width: 720px)'
const BOUNDARY_THRESHOLD_PX = 12

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
  focusBeatIndex,
  onFocusMotionEnd,
  focusRef,
  onNativeFocusChange,
  onNativeScrollOffset,
  onViewportBoundaryChange,
  initialScrollOffset = 0,
  narrativeRuntimeEnabled = true,
  narrativeDeliveryStates = {},
  activeNarrativePauseId,
  activeNarrativePausePhase,
  activeNarrativeRevealId,
  activeNarrativeTypewriterId,
}) {
  const viewportRef = useRef(null)
  const flowRef = useRef(null)
  const beatsRef = useRef(beats)
  const frameRef = useRef(0)
  const lastReportedIndexRef = useRef(focusBeatIndex)
  const nativeScrollInitializedRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [nativeBoundary, setNativeBoundary] = useState({ atTop: false, atBottom: false })
  const [nativeScroll, setNativeScroll] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(NATIVE_SCROLL_QUERY).matches
  ))

  const localGateBeatIndex = getLocalNarrativeGateBeatIndex({
    beats,
    focusBeatIndex,
    deliveryStates: narrativeDeliveryStates,
  })

  const reportViewportBoundary = () => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    if (!viewport || !flow) return
    const boundaries = getNativeBoundaries(viewport)
    const nextBoundary = {
      atTop: nativeScroll && boundaries.atTop,
      atBottom: nativeScroll && boundaries.atBottom,
    }
    setNativeBoundary(current => (
      current.atTop === nextBoundary.atTop && current.atBottom === nextBoundary.atBottom
        ? current
        : nextBoundary
    ))
    onViewportBoundaryChange?.({ direction: 0, ...nextBoundary, ...boundaries })
  }

  useEffect(() => {
    const media = window.matchMedia(NATIVE_SCROLL_QUERY)
    const sync = () => {
      if (media.matches) setNativeScroll(true)
    }
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const flow = flowRef.current
    const focused = flow?.children[focusBeatIndex]
    if (!viewport || !flow || !focused) return undefined

    const pageChanged = beatsRef.current !== beats
    beatsRef.current = beats
    lastReportedIndexRef.current = focusBeatIndex

    if (nativeScroll) {
      const syncNativeEdgeSpace = () => {
        const edgeSpace = getNativeEdgeSpace(viewport, flow)
        flow.style.setProperty('--reader-native-edge-space', `${edgeSpace}px`)
      }
      syncNativeEdgeSpace()
      const needsInitialPosition = !nativeScrollInitializedRef.current || pageChanged
      nativeScrollInitializedRef.current = true
      if (needsInitialPosition) {
        const targetTop = focused.offsetTop - (viewport.clientHeight - focused.offsetHeight) / 2
        const nextTop = initialScrollOffset > 0
          ? initialScrollOffset
          : Math.max(0, targetTop)
        viewport.scrollTo({ top: nextTop, behavior: 'auto' })
        lastScrollTopRef.current = nextTop
      }
      const boundaryFrame = requestAnimationFrame(reportViewportBoundary)
      const observer = new ResizeObserver(syncNativeEdgeSpace)
      observer.observe(viewport)
      observer.observe(flow)
      return () => {
        cancelAnimationFrame(boundaryFrame)
        observer.disconnect()
      }
    }

    nativeScrollInitializedRef.current = false
    flow.style.removeProperty('--reader-native-edge-space')

    const centerFocusedBeat = () => {
      const viewportRect = viewport.getBoundingClientRect()
      const pauseTarget = activeNarrativePausePhase === 'revealing' || activeNarrativePausePhase === 'hold'
        ? focused.querySelector('[data-pause-original]')
        : null
      const focusedCenter = pauseTarget instanceof HTMLElement
        ? focused.offsetTop + pauseTarget.offsetTop + pauseTarget.offsetHeight / 2
        : focused.offsetTop + focused.offsetHeight / 2
      const nextOffset = viewportRect.height * 0.5 - focusedCenter
      setOffset(nextOffset)
    }

    const syncReaderLayout = () => {
      if (focused.offsetHeight > viewport.clientHeight) {
        setNativeScroll(true)
        return
      }
      centerFocusedBeat()
    }

    let restoreFrame = 0
    if (pageChanged) {
      flow.style.transition = 'none'
      syncReaderLayout()
      restoreFrame = requestAnimationFrame(() => {
        flow.style.transition = ''
      })
      onFocusMotionEnd({ target: flow, currentTarget: flow })
    } else {
      syncReaderLayout()
    }

    const boundaryFrame = requestAnimationFrame(reportViewportBoundary)

    const observer = new ResizeObserver(syncReaderLayout)
    observer.observe(viewport)
    observer.observe(flow)
    return () => {
      cancelAnimationFrame(restoreFrame)
      cancelAnimationFrame(boundaryFrame)
      observer.disconnect()
    }
  }, [activeNarrativePausePhase, beats, focusBeatIndex, nativeScroll, onFocusMotionEnd])

  useEffect(() => {
      setNativeBoundary({ atTop: false, atBottom: false })
      onViewportBoundaryChange?.({ direction: 0, atTop: false, atBottom: false })
  }, [beats, onViewportBoundaryChange])

  useEffect(() => {
    if (!nativeScroll) return undefined
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
        let nearestIndex = 0
        let nearestDistance = Number.POSITIVE_INFINITY

        Array.from(flow.children).forEach((element, index) => {
          if (!(element instanceof HTMLElement) || !element.matches('.reader-stage-beat')) return
          const rect = element.getBoundingClientRect()
          const distance = Math.abs((rect.top + rect.height / 2) - centerY)
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
  }, [beats, nativeScroll, onNativeFocusChange, onNativeScrollOffset, onViewportBoundaryChange])

  return (
    <div
      ref={viewportRef}
      className="reader-beat-stack"
      data-native-scroll={nativeScroll ? 'true' : 'false'}
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
        style={{ transform: nativeScroll ? 'none' : `translateY(${offset}px)` }}
        onTransitionEnd={(event) => {
          if (!nativeScroll && event.target === event.currentTarget && event.propertyName === 'transform') {
            onFocusMotionEnd(event)
            reportViewportBoundary()
          }
        }}
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

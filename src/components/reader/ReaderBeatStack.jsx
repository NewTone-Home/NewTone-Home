import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ReaderBeatStack.css'

const NATIVE_SCROLL_QUERY = '(hover: none), (pointer: coarse), (max-width: 720px)'
const BOUNDARY_THRESHOLD_PX = 12

function ReaderBeatStack({
  beats,
  focusBeatIndex,
  onFocusMotionEnd,
  focusRef,
  onNativeFocusChange,
  onNativeBoundary,
}) {
  const viewportRef = useRef(null)
  const flowRef = useRef(null)
  const beatsRef = useRef(beats)
  const frameRef = useRef(0)
  const lastReportedIndexRef = useRef(focusBeatIndex)
  const nativeScrollInitializedRef = useRef(false)
  const boundaryLockRef = useRef(null)
  const lastScrollTopRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [nativeScroll, setNativeScroll] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(NATIVE_SCROLL_QUERY).matches
  ))

  useEffect(() => {
    const media = window.matchMedia(NATIVE_SCROLL_QUERY)
    const sync = () => setNativeScroll(media.matches)
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
      const needsInitialPosition = !nativeScrollInitializedRef.current || pageChanged
      nativeScrollInitializedRef.current = true
      if (pageChanged) boundaryLockRef.current = null
      if (needsInitialPosition) {
        const targetTop = focused.offsetTop - (viewport.clientHeight - focused.offsetHeight) / 2
        const nextTop = Math.max(0, targetTop)
        viewport.scrollTo({ top: nextTop, behavior: 'auto' })
        lastScrollTopRef.current = nextTop
      }
      return undefined
    }

    nativeScrollInitializedRef.current = false

    const centerFocusedBeat = () => {
      const viewportRect = viewport.getBoundingClientRect()
      const focusedCenter = focused.offsetTop + focused.offsetHeight / 2
      const nextOffset = viewportRect.height * 0.5 - focusedCenter
      setOffset(nextOffset)
    }

    let restoreFrame = 0
    if (pageChanged) {
      flow.style.transition = 'none'
      centerFocusedBeat()
      restoreFrame = requestAnimationFrame(() => {
        flow.style.transition = ''
      })
      onFocusMotionEnd({ target: flow, currentTarget: flow })
    } else {
      centerFocusedBeat()
    }

    const observer = new ResizeObserver(centerFocusedBeat)
    observer.observe(viewport)
    observer.observe(flow)
    return () => {
      cancelAnimationFrame(restoreFrame)
      observer.disconnect()
    }
  }, [beats, focusBeatIndex, nativeScroll, onFocusMotionEnd])

  useEffect(() => {
    if (!nativeScroll) return undefined
    const viewport = viewportRef.current
    const flow = flowRef.current
    if (!viewport || !flow) return undefined

    const updateFromScroll = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const currentScrollTop = viewport.scrollTop
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
          lastReportedIndexRef.current = nearestIndex
          onNativeFocusChange?.(nearestIndex)
        }

        const atTop = currentScrollTop <= BOUNDARY_THRESHOLD_PX
        const atBottom = currentScrollTop + viewport.clientHeight >= viewport.scrollHeight - BOUNDARY_THRESHOLD_PX

        if (!atTop && !atBottom) boundaryLockRef.current = null

        if (direction > 0 && atBottom && nearestIndex === beats.length - 1 && boundaryLockRef.current !== 'forward') {
          boundaryLockRef.current = 'forward'
          onNativeBoundary?.('forward')
        } else if (direction < 0 && atTop && nearestIndex === 0 && boundaryLockRef.current !== 'backward') {
          boundaryLockRef.current = 'backward'
          onNativeBoundary?.('backward')
        }
      })
    }

    viewport.addEventListener('scroll', updateFromScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', updateFromScroll)
      cancelAnimationFrame(frameRef.current)
    }
  }, [beats, nativeScroll, onNativeBoundary, onNativeFocusChange])

  return (
    <div
      ref={viewportRef}
      className="reader-beat-stack"
      data-native-scroll={nativeScroll ? 'true' : 'false'}
      aria-live="polite"
    >
      <div
        ref={flowRef}
        className="reader-beat-flow"
        style={{ transform: nativeScroll ? 'none' : `translateY(${offset}px)` }}
        onTransitionEnd={(event) => {
          if (!nativeScroll && event.target === event.currentTarget && event.propertyName === 'transform') {
            onFocusMotionEnd(event)
          }
        }}
      >
        {beats.map((beat, beatIndex) => {
          const distance = Math.abs(beatIndex - focusBeatIndex)
          return (
            <article
              key={beat.id}
              ref={distance === 0 ? focusRef : undefined}
              className="reader-stage-beat"
              aria-current={distance === 0 ? 'true' : undefined}
              tabIndex={distance === 0 ? -1 : undefined}
              data-distance={Math.min(distance, 4)}
            >
              {beat.blocks.map((block, blockIndex) => (
                <p key={`${beat.id}-${blockIndex}`}>{block.text}</p>
              ))}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default ReaderBeatStack

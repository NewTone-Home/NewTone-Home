import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './ReaderBeatStack.css'

const NATIVE_SCROLL_QUERY = '(hover: none), (pointer: coarse), (max-width: 720px)'

function ReaderBeatStack({
  beats,
  focusBeatIndex,
  onFocusMotionEnd,
  focusRef,
  onNativeFocusChange,
}) {
  const viewportRef = useRef(null)
  const flowRef = useRef(null)
  const beatsRef = useRef(beats)
  const frameRef = useRef(0)
  const lastReportedIndexRef = useRef(focusBeatIndex)
  const nativeScrollInitializedRef = useRef(false)
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
      if (needsInitialPosition) {
        const targetTop = focused.offsetTop - (viewport.clientHeight - focused.offsetHeight) / 2
        viewport.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' })
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

    const updateFocusFromScroll = () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        const viewportRect = viewport.getBoundingClientRect()
        const centerY = viewportRect.top + viewportRect.height / 2
        let nearestIndex = 0
        let nearestDistance = Number.POSITIVE_INFINITY

        Array.from(flow.children).forEach((element, index) => {
          const rect = element.getBoundingClientRect()
          const distance = Math.abs((rect.top + rect.height / 2) - centerY)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = index
          }
        })

        if (nearestIndex === lastReportedIndexRef.current) return
        lastReportedIndexRef.current = nearestIndex
        onNativeFocusChange?.(nearestIndex)
      })
    }

    viewport.addEventListener('scroll', updateFocusFromScroll, { passive: true })
    updateFocusFromScroll()
    return () => {
      viewport.removeEventListener('scroll', updateFocusFromScroll)
      cancelAnimationFrame(frameRef.current)
    }
  }, [beats, nativeScroll, onNativeFocusChange])

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

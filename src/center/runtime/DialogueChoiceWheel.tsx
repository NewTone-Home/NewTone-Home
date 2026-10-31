'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type * as React from 'react'
import {
  dialogueChoiceWheelCanConfirm,
  dialogueChoiceWheelClampPosition,
  dialogueChoiceWheelIdleDelayMs,
  dialogueChoiceWheelItemGapPx,
  dialogueChoiceWheelNearestIndex,
  dialogueChoiceWheelSnapDurationMs,
} from './dialogueChoiceWheelState'
import './DialogueChoiceWheel.css'

export type DialogueChoiceWheelProps = {
  sessionId: string
  actionId: number
  options: readonly string[]
  phase: 'active' | 'committing' | 'exiting'
  placement: 'wide-right' | 'narrow-bottom'
  /** Use normal document flow when the wide wheel is placed below its prompt. */
  wideLayout?: 'overlay' | 'inline'
  /** First entry only. Manual wheel motion keeps its existing timing. */
  entryDurationMs?: number
  promptAbove?: boolean
  onConfirm: (actionId: number, optionIndex: number) => void
  onEntranceSettled?: (actionId: number, optionIndex: number) => void
  onSelectionLocked?: (actionId: number, optionIndex: number) => void
  onCancel?: (actionId: number) => void
  onExitComplete?: (actionId: number, optionIndex: number) => void
}

type PointerDrag = { pointerId: number; startY: number; startPosition: number; lastY: number; lastAt: number; velocity: number; dragging: boolean }

/**
 * Focus-only wheel: movement never invokes business callbacks. A settled
 * center click is the sole confirmation path.
 */
const dialogueChoiceWheelEntryStart = (optionCount: number) => Math.min(2, Math.max(0, optionCount - 1))

export function DialogueChoiceWheel({ sessionId, actionId, options, phase, placement, wideLayout = 'overlay', entryDurationMs = 1000, promptAbove = false, onConfirm, onEntranceSettled, onSelectionLocked, onCancel, onExitComplete }: DialogueChoiceWheelProps) {
  const [position, setPosition] = useState(0)
  const [entryVisualPosition, setEntryVisualPosition] = useState<number | null>(() => dialogueChoiceWheelEntryStart(options.length))
  const [entryProgress, setEntryProgress] = useState(0)
  const positionRef = useRef(0)
  const [scrolling, setScrolling] = useState(false)
  const [settled, setSettled] = useState(false)
  const [entering, setEntering] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [narrowItemGapsPx, setNarrowItemGapsPx] = useState({ above: dialogueChoiceWheelItemGapPx, below: dialogueChoiceWheelItemGapPx })
  const wheelRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<number | null>(null)
  const entryFrameRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const inertiaFrameRef = useRef<number | null>(null)
  const dragRef = useRef<PointerDrag | null>(null)
  const onConfirmRef = useRef(onConfirm)
  const onEntranceSettledRef = useRef(onEntranceSettled)
  const onSelectionLockedRef = useRef(onSelectionLocked)
  const onCancelRef = useRef(onCancel)
  const onExitCompleteRef = useRef(onExitComplete)
  const exitedActionRef = useRef<number | null>(null)
  const confirmedActionKeyRef = useRef<string | null>(null)
  onConfirmRef.current = onConfirm
  onEntranceSettledRef.current = onEntranceSettled
  onSelectionLockedRef.current = onSelectionLocked
  onCancelRef.current = onCancel
  onExitCompleteRef.current = onExitComplete
  const itemGapPx = placement === 'narrow-bottom' ? narrowItemGapsPx : { above: dialogueChoiceWheelItemGapPx, below: dialogueChoiceWheelItemGapPx }

  useLayoutEffect(() => {
    if (placement !== 'narrow-bottom') return
    const element = wheelRef.current
    if (!element) return
    const updateGap = () => {
      const center = element.querySelector<HTMLElement>('.dialogue-choice-wheel__option--center')
      const centerIndex = center ? Number(center.dataset.dialogueChoiceIndex) : 0
      const safeViewportHeight = element.getBoundingClientRect().height
      const centerRowHeight = center?.getBoundingClientRect().height ?? 48
      const centerFontSize = Number.parseFloat(center ? window.getComputedStyle(center).fontSize : '') || 16
      const previewHeight = centerFontSize * (promptAbove ? 0.75 : 0.8)
      const measureNeighborGap = (index: number) => {
        const neighbor = element.querySelector<HTMLElement>(`.dialogue-choice-wheel__option[data-dialogue-choice-index="${index}"]`)
        if (!neighbor) return 34
        const computed = window.getComputedStyle(neighbor)
        const fontSize = Number.parseFloat(computed.fontSize) || 16
        const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.35
        // Keep the preview beside (not over) the focused row. A multi-line
        // focused choice needs a little more clearance, independent of viewport.
        const previewHeight = fontSize * (promptAbove ? 0.75 : 1.1)
        return Math.round(Math.max(
          promptAbove ? 28 : 34,
          centerRowHeight / 2 + previewHeight / 2 + (promptAbove ? -1 : 1),
          lineHeight * (promptAbove ? 1.3 : 1.58),
        ))
      }
      const above = measureNeighborGap(centerIndex - 1)
      const below = measureNeighborGap(centerIndex + 1)
      const previewExtent = Math.max(above, below) + previewHeight / 2 + 3
      const clipHeight = Math.max(centerRowHeight, Math.min(safeViewportHeight, previewExtent * 2))
      if (clipHeight > 0) element.style.setProperty('--narrow-wheel-clip-height', `${Math.round(clipHeight)}px`)
      setNarrowItemGapsPx(current => current.above === above && current.below === below ? current : { above, below })
    }
    updateGap()
    const observer = new ResizeObserver(updateGap)
    observer.observe(element)
    return () => observer.disconnect()
  }, [options, placement, position, promptAbove])

  useEffect(() => {
    if (phase !== 'exiting' || exitedActionRef.current === actionId) return
    const timer = window.setTimeout(() => {
      if (exitedActionRef.current === actionId) return
      exitedActionRef.current = actionId
      for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) onExitCompleteRef.current?.(actionId, optionIndex)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [actionId, options.length, phase])

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current)
    if (entryFrameRef.current !== null) window.cancelAnimationFrame(entryFrameRef.current)
    idleTimerRef.current = null
    settleTimerRef.current = null
    inertiaFrameRef.current = null
    entryFrameRef.current = null
  }, [])

  const positionDeltaForPixels = (deltaPixels: number) => {
    const gap = deltaPixels < 0 ? itemGapPx.above : itemGapPx.below
    return deltaPixels / Math.max(1, gap)
  }

  const setWheelPosition = useCallback((next: number) => {
    const bounded = dialogueChoiceWheelClampPosition(next, options.length)
    positionRef.current = bounded
    setPosition(bounded)
  }, [options.length])

  const finishSettle = useCallback((next: number) => {
    setScrolling(false)
    setWheelPosition(dialogueChoiceWheelNearestIndex(next, options.length))
    setSettled(false)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      setSettled(true)
    }, dialogueChoiceWheelSnapDurationMs)
  }, [options.length, setWheelPosition])

  const queueIdleSettle = useCallback(() => {
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      finishSettle(positionRef.current)
    }, dialogueChoiceWheelIdleDelayMs)
  }, [finishSettle])

  useLayoutEffect(() => {
    clearTimers()
    const initial = dialogueChoiceWheelClampPosition(0, options.length)
    const entryStart = dialogueChoiceWheelEntryStart(options.length)
    positionRef.current = initial
    setPosition(initial)
    setEntryVisualPosition(entryStart)
    setEntryProgress(0)
    setScrolling(options.length > 1)
    setSettled(false)
    setEntering(true)
    setConfirmed(false)
    confirmedActionKeyRef.current = null
    dragRef.current = null
    if (!options.length) return clearTimers
    const settleEntry = () => {
      if (entryFrameRef.current !== null) window.cancelAnimationFrame(entryFrameRef.current)
      entryFrameRef.current = null
      setEntryVisualPosition(null)
      setEntryProgress(1)
      setEntering(false)
      setScrolling(false)
      setSettled(true)
      onEntranceSettledRef.current?.(actionId, initial)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || options.length < 2) {
      settleEntry()
      return clearTimers
    }
    const duration = Math.max(0, entryDurationMs)
    if (duration <= 0) {
      settleEntry()
      return clearTimers
    }
    let startAt: number | null = null
    const animateEntry = (now: number) => {
      startAt ??= now
      const progress = Math.min(1, Math.max(0, (now - startAt) / duration))
      // A single decelerating pass brings the initially displaced rows to the
      // default choice. This is only the group entrance; manual wheel motion
      // continues to use the existing focus/inertia path below.
      const eased = 1 - Math.pow(1 - progress, 3)
      setEntryVisualPosition(entryStart + (initial - entryStart) * eased)
      setEntryProgress(eased)
      if (progress >= 1) {
        settleEntry()
        return
      }
      entryFrameRef.current = window.requestAnimationFrame(animateEntry)
    }
    entryFrameRef.current = window.requestAnimationFrame(animateEntry)
    return clearTimers
  }, [actionId, clearTimers, entryDurationMs, options.length, sessionId])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (phase !== 'active' || entering || confirmed || options.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    setSettled(false)
    setScrolling(true)
    setWheelPosition(positionRef.current + positionDeltaForPixels(event.deltaY))
    queueIdleSettle()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'active' || entering || confirmed) return
    event.stopPropagation()
    if (options.length < 2 || event.button !== 0) return
    const canTapCenter = event.target instanceof HTMLButtonElement && settled && !scrolling && !entering
    if (!canTapCenter) event.preventDefault()
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: positionRef.current,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
      dragging: !canTapCenter,
    }
    if (!canTapCenter) {
      event.currentTarget.setPointerCapture(event.pointerId)
      setSettled(false)
      setScrolling(true)
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.dragging) {
      if (Math.abs(event.clientY - drag.startY) < 8) return
      drag.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setSettled(false)
      setScrolling(true)
    }
    event.preventDefault()
    event.stopPropagation()
    const elapsed = Math.max(1, event.timeStamp - drag.lastAt)
    drag.velocity = positionDeltaForPixels(drag.lastY - event.clientY) / elapsed
    drag.lastY = event.clientY
    drag.lastAt = event.timeStamp
    setWheelPosition(drag.startPosition + positionDeltaForPixels(drag.startY - event.clientY))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.dragging) return
    event.preventDefault()
    const velocity = Math.max(-.012, Math.min(.012, drag.velocity))
    const startedAt = performance.now()
    let lastAt = startedAt
    const coast = (now: number) => {
      const elapsed = now - startedAt
      const delta = Math.min(32, Math.max(1, now - lastAt))
      lastAt = now
      const decay = Math.exp(-elapsed / 170)
      const current = dialogueChoiceWheelClampPosition(positionRef.current + velocity * delta * decay, options.length)
      setWheelPosition(current)
      if (elapsed < 360 && Math.abs(velocity * decay) > .0007 && current > 0 && current < options.length - 1) {
        inertiaFrameRef.current = window.requestAnimationFrame(coast)
      } else {
        inertiaFrameRef.current = null
        finishSettle(current)
      }
    }
    inertiaFrameRef.current = window.requestAnimationFrame(coast)
  }

  const confirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!dialogueChoiceWheelCanConfirm({ entering, scrolling, settled, position, optionCount: options.length }) || phase !== 'active') return
    const confirmationKey = `${sessionId}:${actionId}`
    if (confirmedActionKeyRef.current === confirmationKey) return
    confirmedActionKeyRef.current = confirmationKey
    setConfirmed(true)
    const selectedIndex = dialogueChoiceWheelNearestIndex(position, options.length)
    onSelectionLockedRef.current?.(actionId, selectedIndex)
    onConfirmRef.current(actionId, selectedIndex)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && phase === 'active') {
      event.preventDefault()
      event.stopPropagation()
      onCancelRef.current?.(actionId)
    }
  }

  if (!options.length) return null
  const centerIndex = dialogueChoiceWheelNearestIndex(position, options.length)
  const visualPosition = entryVisualPosition ?? position
  const indices = Array.from({ length: Math.min(options.length, 5) }, (_, slot) => {
    const first = Math.max(0, Math.min(options.length - Math.min(options.length, 5), centerIndex - 2))
    return first + slot
  })
  const locked = phase !== 'active'
  const entryOffset = 1 - entryProgress
  const entryTransform = placement === 'narrow-bottom'
    ? `translate3d(-50%, ${18 * entryOffset}px, 0) scale(${.98 + .02 * entryProgress})`
    : wideLayout === 'inline'
      ? `translate3d(0, ${10 * entryOffset}px, 0) scale(${.99 + .01 * entryProgress})`
      : `translate3d(${20 * entryOffset}px, -50%, 0) scale(${.98 + .02 * entryProgress})`

  return (
    <div
      ref={wheelRef}
      className={`dialogue-choice-wheel dialogue-choice-wheel--${placement}${placement === 'wide-right' && wideLayout === 'inline' ? ' dialogue-choice-wheel--wide-inline' : ''}${entering ? ' is-entering' : ''}${scrolling ? ' is-scrolling' : ''}${settled ? ' is-settled' : ''}${locked ? ' is-locked' : ''}${confirmed ? ' is-confirmed' : ''}${phase === 'exiting' ? ' is-exiting' : ''}`}
      role="group"
      aria-label="对话选项"
      data-dialogue-choice-wheel="true"
      data-dialogue-choice-session={sessionId}
      data-dialogue-choice-action={actionId}
      data-dialogue-choice-phase={phase}
      data-dialogue-choice-entering={entering}
      data-dialogue-choice-settled={settled}
      data-dialogue-choice-confirmed={confirmed}
      data-dialogue-choice-selected-index={dialogueChoiceWheelNearestIndex(position, options.length)}
      data-dialogue-choice-entry-duration-ms={entryDurationMs}
      style={{
        ['--dialogue-choice-entry-duration' as string]: `${Math.max(0, entryDurationMs)}ms`,
        opacity: .2 + .8 * entryProgress,
        transform: entering ? entryTransform : undefined,
        transition: entering ? 'none' : undefined,
      } as React.CSSProperties}
      data-dialogue-choice-item-gap-above={placement === 'narrow-bottom' ? narrowItemGapsPx.above : undefined}
      data-dialogue-choice-item-gap-below={placement === 'narrow-bottom' ? narrowItemGapsPx.below : undefined}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onClick={event => { event.stopPropagation() }}
    >
      <div className="dialogue-choice-wheel__viewport" aria-live="polite" aria-atomic="true">
        {indices.map(index => {
          const distance = index - visualPosition
          const distanceFromCenter = Math.abs(distance)
          const candidateOpacity = Math.max(.18, 1 - distanceFromCenter * .34)
          const candidateBlurPx = Math.min(5, distanceFromCenter * 2)
          const isCenter = index === centerIndex
          const label = options[index]!
          const candidateStyle = {
            transform: `translate3d(0, ${distance * (distance < 0 ? itemGapPx.above : itemGapPx.below)}px, 0)`,
            opacity: candidateOpacity,
            filter: candidateBlurPx > 0 ? `blur(${candidateBlurPx}px)` : 'none',
          }
          return isCenter
            ? <button
                key={`${sessionId}:${index}`}
                className="dialogue-choice-wheel__option dialogue-choice-wheel__option--center"
                type="button"
                aria-label={`确认：${label}`}
                aria-current={settled && !entering ? 'true' : undefined}
                disabled={locked || !settled || entering || scrolling}
                data-dialogue-choice-index={index}
                style={candidateStyle}
                onClick={confirm}
              >{label}</button>
            : <span
                key={`${sessionId}:${index}`}
                className="dialogue-choice-wheel__option dialogue-choice-wheel__option--neighbor"
                aria-hidden="true"
                data-dialogue-choice-index={index}
                data-dialogue-choice-neighbor-side={distance < 0 ? 'above' : 'below'}
                style={candidateStyle}
              ><span className="dialogue-choice-wheel__neighbor-copy">{label}</span></span>
        })}
      </div>
    </div>
  )
}

import { getGameStorage, rethrowStoppedSession } from '../../save-session.mjs'
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
  /** Desktop priced menu: the first `menu.length` options are shown as menu rows. */
  menu?: readonly { name: string; price: number; description: string | null }[]
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
  /** Locked choices fade out in place instead of disappearing. */
  softExit?: boolean
  onCancel?: (actionId: number) => void
  onExitComplete?: (actionId: number, optionIndex: number) => void
}

type PointerDrag = { pointerId: number; startY: number; startPosition: number; lastY: number; lastAt: number; velocity: number; dragging: boolean }

/**
 * Focus-only wheel: movement never invokes business callbacks. A settled
 * center click is the sole confirmation path.
 */
// Start the rows at least two steps away so the one-second roll is visible even with two options.
const dialogueChoiceHintStorageKey = 'newtone-choice-wheel-hint-seen'
const readChoiceHintSeen = () => { try { return getGameStorage().getItem(dialogueChoiceHintStorageKey) === '1' } catch { rethrowStoppedSession(); return false } }
const writeChoiceHintSeen = () => { try { getGameStorage().setItem(dialogueChoiceHintStorageKey, '1') } catch { rethrowStoppedSession(); /* private mode */ } }
const dialogueChoiceWheelEntryStart = (optionCount: number) => optionCount < 2 ? 0 : Math.min(3, Math.max(2, optionCount - 1))

export function DialogueChoiceWheel({ sessionId, actionId, options, menu, softExit, phase, placement, wideLayout = 'overlay', entryDurationMs = 1000, promptAbove = false, onConfirm, onEntranceSettled, onSelectionLocked, onCancel, onExitComplete }: DialogueChoiceWheelProps) {
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
  const desktopBubble = placement === 'wide-right' && wideLayout === 'inline'
  const [typedCount, setTypedCount] = useState(0)
  const [showHint] = useState(false)
  useEffect(() => {
    if (!desktopBubble) return
    setTypedCount(0)
    let count = 0
    let interval: number | null = null
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        count += 1
        setTypedCount(count)
        if (count >= 60 && interval !== null) window.clearInterval(interval)
      }, 40)
    }, 320)
    return () => { window.clearTimeout(start); if (interval !== null) window.clearInterval(interval) }
  }, [actionId, desktopBubble, sessionId])
  useEffect(() => () => { if (showHint) writeChoiceHintSeen() }, [showHint])
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
  const confirmedStateRef = useRef(false)
  const hasEnteredBeforeRef = useRef(false)
  const confirmedActionKeyRef = useRef<string | null>(null)
  onConfirmRef.current = onConfirm
  confirmedStateRef.current = confirmed
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

  useLayoutEffect(() => {
    if (placement !== 'wide-right') return
    const element = wheelRef.current
    if (!element) return
    const updateWideClip = () => {
      const center = element.querySelector<HTMLElement>('.dialogue-choice-wheel__option--center')
      const centerHeight = center?.getBoundingClientRect().height ?? 0
      if (centerHeight <= 0) return
      const neighborHeights = Array.from(element.querySelectorAll<HTMLElement>('.dialogue-choice-wheel__option--neighbor'))
        .map(node => node.getBoundingClientRect().height)
        .filter(height => height > 0)
      const neighborHeight = neighborHeights.length ? Math.max(...neighborHeights) : centerHeight
      // Rows sit one fixed step apart: keep the whole focused row plus only a thin edge of each neighbour.
      const sliver = Math.max(10, Math.round(Math.min(centerHeight, neighborHeight) * .25))
      const nearEdge = Math.max(centerHeight / 2, dialogueChoiceWheelItemGapPx - neighborHeight / 2)
      const clip = `${Math.round((nearEdge + sliver) * 2)}px`
      if (element.style.getPropertyValue('--wide-wheel-clip-height') !== clip) element.style.setProperty('--wide-wheel-clip-height', clip)
    }
    updateWideClip()
    const observer = new ResizeObserver(updateWideClip)
    observer.observe(element)
    return () => observer.disconnect()
  }, [options, placement, position])

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
    // Another set of options replacing one that was just answered keeps the same box: swap the rows in place, no entrance.
    const swapInPlace = hasEnteredBeforeRef.current && confirmedStateRef.current
    hasEnteredBeforeRef.current = true
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
    if (swapInPlace || window.matchMedia('(prefers-reduced-motion: reduce)').matches || options.length < 2) {
      settleEntry()
      return clearTimers
    }
    // Desktop (inline) choices appear without the slot-machine roll; the frame fades in.
    const duration = placement === 'wide-right' && wideLayout === 'inline' ? 0 : Math.max(0, entryDurationMs)
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
      // Quadratic ease-out: still decelerating into place, but not front-loaded the way a cubic is.
      const eased = 1 - Math.pow(1 - progress, 2)
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

  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  useEffect(() => { setPickedIndex(null) }, [actionId, sessionId])
  const pickTimerRef = useRef<number | null>(null)
  useEffect(() => () => { if (pickTimerRef.current !== null) window.clearTimeout(pickTimerRef.current) }, [])
  const pickOption = (index: number) => {
    if (phase !== 'active' || confirmedActionKeyRef.current === `${sessionId}:${actionId}`) return
    confirmedActionKeyRef.current = `${sessionId}:${actionId}`
    setConfirmed(true)
    setPickedIndex(index)
    // Let the highlight register for a beat before the label moves into the conversation.
    pickTimerRef.current = window.setTimeout(() => {
      pickTimerRef.current = null
      onSelectionLockedRef.current?.(actionId, index)
      onConfirmRef.current(actionId, index)
    }, 220)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && phase === 'active') {
      event.preventDefault()
      event.stopPropagation()
      onCancelRef.current?.(actionId)
    }
  }

  if (!options.length) return null
  if (desktopBubble) {
    const menuRows = menu?.length ? menu : null
    const stateClass = `${phase !== 'active' ? ' is-locked' : ''}${confirmed ? ' is-confirmed' : ''}${phase === 'exiting' ? ' is-exiting' : ''}${softExit ? ' is-soft' : ''}`
    const common = {
      ref: wheelRef,
      role: 'group',
      'aria-label': '对话选项',
      'data-dialogue-choice-wheel': 'true',
      'data-dialogue-choice-session': sessionId,
      'data-dialogue-choice-action': actionId,
      'data-dialogue-choice-phase': phase,
      'data-dialogue-choice-entering': false,
      'data-dialogue-choice-settled': true,
      'data-dialogue-choice-confirmed': confirmed,
      onKeyDown: handleKeyDown,
      onClick: (event: React.MouseEvent) => { event.stopPropagation() },
      onPointerDown: (event: React.PointerEvent) => { event.stopPropagation() },
    } as const
    if (menuRows) {
      const extra = options.slice(menuRows.length).map((label, offset) => ({ label, index: menuRows.length + offset }))
      return (
        <div {...common} className={`dialogue-choice-menu${stateClass}`}>
          <div className="dialogue-choice-menu__panel">
            {menuRows.map((row, index) => (
              <button
                key={`${sessionId}:${index}`}
                type="button"
                className={`dialogue-choice-menu__row${pickedIndex === index ? ' is-picked' : ''}`}
                aria-label={`${row.name} ${row.price}`}
                disabled={phase !== 'active' || confirmed}
                onClick={event => { event.preventDefault(); event.stopPropagation(); pickOption(index) }}
              >
                <span className="dialogue-choice-menu__line">
                  <span className="dialogue-choice-menu__name" data-dialogue-choice-index={index}>{row.name}</span>
                  <span className="dialogue-choice-menu__price">{row.price}</span>
                </span>
                {row.description && <span className="dialogue-choice-menu__desc">{row.description}</span>}
              </button>
            ))}
            {extra.map(({ label, index }) => (
              <button
                key={`${sessionId}:${index}`}
                type="button"
                className={`dialogue-choice-menu__extra${pickedIndex === index ? ' is-picked' : ''}`}
                disabled={phase !== 'active' || confirmed}
                data-dialogue-choice-index={index}
                onClick={event => { event.preventDefault(); event.stopPropagation(); pickOption(index) }}
              >{label}</button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div {...common} className={`dialogue-choice-bubbles${stateClass}`}>
        {options.map((label, index) => (
          <button
            key={`${sessionId}:${actionId}:${index}`}
            type="button"
            className={`dialogue-choice-bubbles__item${pickedIndex === index ? ' is-picked' : ''}`}
            disabled={phase !== 'active' || confirmed}
            data-dialogue-choice-index={index}
            onClick={event => { event.preventDefault(); event.stopPropagation(); pickOption(index) }}
          >{label}</button>
        ))}
      </div>
    )
  }
  const centerIndex = dialogueChoiceWheelNearestIndex(position, options.length)
  const visualPosition = entryVisualPosition ?? position
  const indices = Array.from({ length: Math.min(options.length, 5) }, (_, slot) => {
    const first = Math.max(0, Math.min(options.length - Math.min(options.length, 5), centerIndex - 2))
    return first + slot
  })
  const locked = phase !== 'active'
  const entryOffset = 1 - entryProgress
  const entryTransform = placement === 'narrow-bottom'
    ? `translate3d(var(--dialogue-wheel-entry-x, -50%), ${18 * entryOffset}px, 0) scale(${.98 + .02 * entryProgress})`
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
        // Only while entering: a permanent inline opacity would override the .is-exiting fade-out.
        opacity: entering ? .2 + .8 * entryProgress : undefined,
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
              >{desktopBubble ? <>{label.slice(0, typedCount)}<span style={{ visibility: 'hidden' }}>{label.slice(typedCount)}</span></> : label}</button>
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
      {showHint && phase === 'active' && <span className="dialogue-choice-wheel__hint" aria-hidden="true">⌄</span>}
    </div>
  )
}

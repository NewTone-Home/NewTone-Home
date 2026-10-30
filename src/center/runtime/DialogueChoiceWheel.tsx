'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  onConfirm: (actionId: number, optionIndex: number) => void
  onCancel?: (actionId: number) => void
  onExitComplete?: (actionId: number, optionIndex: number) => void
}

type PointerDrag = { pointerId: number; startY: number; startPosition: number; lastY: number; lastAt: number; velocity: number }

/**
 * Focus-only wheel: movement never invokes business callbacks. A settled
 * center click is the sole confirmation path.
 */
export function DialogueChoiceWheel({ sessionId, actionId, options, phase, placement, onConfirm, onCancel, onExitComplete }: DialogueChoiceWheelProps) {
  const [position, setPosition] = useState(0)
  const positionRef = useRef(0)
  const [scrolling, setScrolling] = useState(false)
  const [settled, setSettled] = useState(false)
  const [entering, setEntering] = useState(true)
  const idleTimerRef = useRef<number | null>(null)
  const enterTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const inertiaFrameRef = useRef<number | null>(null)
  const dragRef = useRef<PointerDrag | null>(null)
  const onConfirmRef = useRef(onConfirm)
  const onCancelRef = useRef(onCancel)
  const onExitCompleteRef = useRef(onExitComplete)
  const exitedActionRef = useRef<number | null>(null)
  onConfirmRef.current = onConfirm
  onCancelRef.current = onCancel
  onExitCompleteRef.current = onExitComplete

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
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current)
    idleTimerRef.current = null
    enterTimerRef.current = null
    settleTimerRef.current = null
    inertiaFrameRef.current = null
  }, [])

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

  useEffect(() => {
    clearTimers()
    const initial = dialogueChoiceWheelClampPosition(0, options.length)
    positionRef.current = initial
    setPosition(initial)
    setScrolling(false)
    setSettled(false)
    setEntering(true)
    dragRef.current = null
    enterTimerRef.current = window.setTimeout(() => {
      enterTimerRef.current = null
      setEntering(false)
      setSettled(true)
    }, 620)
    return clearTimers
  }, [actionId, clearTimers, options.length, sessionId])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (phase !== 'active' || options.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    setSettled(false)
    setScrolling(true)
    setWheelPosition(positionRef.current + event.deltaY / dialogueChoiceWheelItemGapPx)
    queueIdleSettle()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'active') return
    event.stopPropagation()
    if (event.target instanceof HTMLButtonElement && settled && !scrolling && !entering) return
    if (options.length < 2 || event.button !== 0) return
    event.preventDefault()
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current)
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: positionRef.current,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSettled(false)
    setScrolling(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const elapsed = Math.max(1, event.timeStamp - drag.lastAt)
    drag.velocity = ((drag.lastY - event.clientY) / dialogueChoiceWheelItemGapPx) / elapsed
    drag.lastY = event.clientY
    drag.lastAt = event.timeStamp
    setWheelPosition(drag.startPosition + (drag.startY - event.clientY) / dialogueChoiceWheelItemGapPx)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    dragRef.current = null
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
    onConfirmRef.current(actionId, dialogueChoiceWheelNearestIndex(position, options.length))
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
  const indices = Array.from({ length: Math.min(options.length, 5) }, (_, slot) => {
    const first = Math.max(0, Math.min(options.length - Math.min(options.length, 5), centerIndex - 2))
    return first + slot
  })
  const locked = phase !== 'active'

  return (
    <div
      className={`dialogue-choice-wheel dialogue-choice-wheel--${placement}${entering ? ' is-entering' : ''}${scrolling ? ' is-scrolling' : ''}${settled ? ' is-settled' : ''}${locked ? ' is-locked' : ''}${phase === 'exiting' ? ' is-exiting' : ''}`}
      role="group"
      aria-label="对话选项"
      data-dialogue-choice-wheel="true"
      data-dialogue-choice-session={sessionId}
      data-dialogue-choice-action={actionId}
      data-dialogue-choice-phase={phase}
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
          const distance = index - position
          const isCenter = index === centerIndex
          const label = options[index]!
          return isCenter
            ? <button
                key={`${sessionId}:${index}`}
                className="dialogue-choice-wheel__option dialogue-choice-wheel__option--center"
                type="button"
                aria-label={`确认：${label}`}
                aria-pressed={settled && !entering}
                disabled={locked || !settled || entering || scrolling}
                style={{ transform: `translate3d(0, ${distance * dialogueChoiceWheelItemGapPx}px, 0)` }}
                onClick={confirm}
              >{label}</button>
            : <span
                key={`${sessionId}:${index}`}
                className="dialogue-choice-wheel__option dialogue-choice-wheel__option--neighbor"
                aria-hidden="true"
                style={{ transform: `translate3d(0, ${distance * dialogueChoiceWheelItemGapPx}px, 0)` }}
              >{label}</span>
        })}
      </div>
      <span className="dialogue-choice-wheel__hint" aria-hidden="true">停稳后点击中间项</span>
    </div>
  )
}

'use client'

import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './DialogueChoiceSelectionTransfer.css'

export type DialogueChoiceSelectionTransferProps = {
  /** Stable identity for one confirmed choice migration. */
  transferId: string
  text: string
  sourceRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>
  targetRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>
  /** Match the source wheel label and destination history typography. */
  textStyle?: CSSProperties
  durationMs?: number
  onComplete: (transferId: string) => void
}

/**
 * A visual-only copy that lets the selected label travel into its future
 * history-row bounds. The host owns the source/target content handoff and
 * should reveal the target history row when onComplete fires.
 */
export function DialogueChoiceSelectionTransfer({ transferId, text, sourceRect, targetRect, durationMs = 320, textStyle, onComplete }: DialogueChoiceSelectionTransferProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      onCompleteRef.current(transferId)
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 1 : Math.max(0, durationMs)
    const scaleX = sourceRect.width > 0 ? targetRect.width / sourceRect.width : 1
    const scaleY = sourceRect.height > 0 ? targetRect.height / sourceRect.height : 1
    const deltaX = targetRect.left - sourceRect.left
    const deltaY = targetRect.top - sourceRect.top

    if (duration <= 1) {
      finish()
      return
    }
    const animation = element.animate([
      { transform: 'translate3d(0, 0, 0) scale(1, 1)', opacity: 1 },
      { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`, opacity: .08 },
    ], {
      duration,
      easing: 'cubic-bezier(.2,.75,.25,1)',
      fill: 'forwards',
    })
    animation.onfinish = finish
    return () => {
      animation.onfinish = null
      animation.cancel()
    }
  }, [durationMs, sourceRect.height, sourceRect.left, sourceRect.top, sourceRect.width, targetRect.height, targetRect.left, targetRect.top, targetRect.width, transferId])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={elementRef}
      className="dialogue-choice-selection-transfer"
      aria-hidden="true"
      data-dialogue-choice-transfer={transferId}
      style={{ ...textStyle, left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height }}
    >{text}</div>,
    document.body,
  )
}

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
    let frame = 0
    const finish = () => {
      if (completed) return
      completed = true
      onCompleteRef.current(transferId)
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = Math.max(1, reducedMotion ? 1 : durationMs)
    const startedAt = performance.now()
    const update = (now: number) => {
      if (completed) return
      const targetNode = Array.from(document.querySelectorAll<HTMLElement>('[data-choice-transfer-target]'))
        .find(node => node.dataset.choiceTransferTarget === transferId)
      const target = targetNode?.getBoundingClientRect()
      const destination = target && target.width > 0 && target.height > 0 ? target : targetRect
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration))
      const eased = 1 - Math.pow(1 - progress, 3)
      const scaleX = sourceRect.width > 0 ? destination.width / sourceRect.width : 1
      const scaleY = sourceRect.height > 0 ? destination.height / sourceRect.height : 1
      const deltaX = destination.left - sourceRect.left
      const deltaY = destination.top - sourceRect.top
      element.style.transform = `translate3d(${deltaX * eased}px, ${deltaY * eased}px, 0) scale(${1 + (scaleX - 1) * eased}, ${1 + (scaleY - 1) * eased})`
      element.style.opacity = String(1 - .92 * eased)
      if (progress >= 1) {
        finish()
        return
      }
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)
    return () => {
      completed = true
      window.cancelAnimationFrame(frame)
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

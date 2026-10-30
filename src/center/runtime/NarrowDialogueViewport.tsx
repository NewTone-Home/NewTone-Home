'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { AnimationEvent, CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react'
import {
  narrowDialogueIdentityKey,
  narrowDialogueStartsTypewriter,
  narrowDialogueTransition,
} from './NarrowDialogueIdentity'
import type { NarrowDialogueIdentity, NarrowDialogueTransition } from './NarrowDialogueIdentity'
import './NarrowDialogueViewport.css'

export type NarrowDialogueChoice = Readonly<{
  id: string
  label: string
  measuredHeightPx: number
}>

export type NarrowDialogueExitKind = 'aside' | 'conversation'

export type NarrowDialogueViewportProps = Readonly<{
  /** Keep this component mounted for the lifetime of a session so choices and text share one host mask. */
  identity: NarrowDialogueIdentity
  speaker?: ReactNode
  /** Current fully fitted page text; the parent computes it at the actual 18px viewport width. */
  pageText: string
  /** Stable height selected from the maximum fitted page height for this conversation. */
  windowHeightPx: number
  /** Available text width after safe-area insets and horizontal padding. */
  availableWidthPx: number
  /** Height of the already measured current page, including its speaker row. */
  measuredPageHeightPx: number
  /** True only for the last authored line's last fitted page. */
  isFinalLinePage: boolean
  /** Allows hosts with externally controlled typing or a waiting state to keep the same viewport without starting a local typewriter. */
  typewriterEnabled?: boolean
  /** A prior host may own a single opening mask; text starts after its reveal. */
  typewriterStartDelayMs?: number
  choices?: readonly NarrowDialogueChoice[]
  onReady?: (identity: NarrowDialogueIdentity, scope: 'text' | 'options', focusedChoiceId?: string) => void
  /** Reports that the current text page is fully presented, regardless of whether it typed or flipped in. */
  onTextSettled?: (identity: NarrowDialogueIdentity) => void
  onAdvance?: (identity: NarrowDialogueIdentity) => void
  onExitComplete?: (identity: NarrowDialogueIdentity, kind: NarrowDialogueExitKind) => void
  onOptionFocusChange?: (identity: NarrowDialogueIdentity, choiceId: string, index: number) => void
  onOptionConfirm?: (identity: NarrowDialogueIdentity, choiceId: string, index: number) => void
}>

type DisplaySnapshot = Readonly<{
  identity: NarrowDialogueIdentity
  identityKey: string
  pageText: string
  speaker: ReactNode
  transition: NarrowDialogueTransition
  outgoing: boolean
}>

const typewriterIntervalMs = 42
const optionSettleMs = 160
const optionRowGapPx = 10

export function NarrowDialogueViewport({
  identity,
  speaker,
  pageText,
  windowHeightPx,
  availableWidthPx,
  measuredPageHeightPx,
  isFinalLinePage,
  typewriterEnabled = true,
  typewriterStartDelayMs = 300,
  choices = [],
  onReady,
  onTextSettled,
  onAdvance,
  onExitComplete,
  onOptionFocusChange,
  onOptionConfirm,
}: NarrowDialogueViewportProps) {
  const identityKey = narrowDialogueIdentityKey(identity)
  const [snapshot, setSnapshot] = useState<DisplaySnapshot>(() => ({
    identity,
    identityKey,
    pageText,
    speaker,
    transition: 'conversation-start',
    outgoing: false,
  }))
  const [outgoing, setOutgoing] = useState<DisplaySnapshot | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const [textAnimating, setTextAnimating] = useState(false)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ setKey: string; index: number }>({ setKey: identity.optionSetKey ?? '', index: 0 })
  const [choiceSettled, setChoiceSettled] = useState(true)
  const previousRef = useRef<DisplaySnapshot | null>(null)
  const choiceTimerRef = useRef<number | null>(null)
  const recentScrollRef = useRef(false)
  const pointerRef = useRef<{ id: number; y: number; moved: boolean } | null>(null)
  const wheelRemainderRef = useRef(0)
  const lastTypewriterSessionRef = useRef<string | null>(null)
  const motionRunRef = useRef(0)
  const readyCallbackRef = useRef(onReady)
  const latestPropsRef = useRef({ identity, onExitComplete, onAdvance, onTextSettled })
  readyCallbackRef.current = onReady
  latestPropsRef.current = { identity, onExitComplete, onAdvance, onTextSettled }

  const focusedIndex = focus.setKey === (identity.optionSetKey ?? '')
    ? Math.max(0, Math.min(choices.length - 1, focus.index))
    : 0
  const focusedChoice = choices[focusedIndex]
  const isOptions = identity.content === 'options'
  const isReady = readyKey === identityKey
  const presentedSnapshot = snapshot.identityKey === identityKey ? snapshot : {
    identity, identityKey, pageText, speaker,
    transition: narrowDialogueTransition(previousRef.current?.identity ?? null, identity),
    outgoing: false,
  }

  const notifyReady = (focusedChoiceId?: string) => {
    setReadyKey(identityKey)
    if (!isOptions) latestPropsRef.current.onTextSettled?.(identity)
    readyCallbackRef.current?.(identity, isOptions ? 'options' : 'text', focusedChoiceId)
  }

  useLayoutEffect(() => {
    const runId = ++motionRunRef.current
    const prior = previousRef.current
    const transition = prior
      ? narrowDialogueTransition(prior.identity, identity)
      : narrowDialogueTransition(null, identity)
    const priorKey = prior?.identityKey
    const shouldAnimate = prior !== null
      && priorKey !== identityKey
      && (transition === 'line-change' || transition === 'capacity-page' || transition === 'aside-enter' || transition === 'aside-return' || transition === 'options-enter' || transition === 'options-return')
    const next: DisplaySnapshot = { identity, identityKey, pageText, speaker, transition, outgoing: shouldAnimate }
    previousRef.current = next
    setSnapshot(next)
    setReadyKey(null)
    setTextAnimating(false)

    const canType = typewriterEnabled && narrowDialogueStartsTypewriter(transition, identity.kind, identity.content)
      && lastTypewriterSessionRef.current !== identity.sessionKey
    if (canType) {
      lastTypewriterSessionRef.current = identity.sessionKey
      setDisplayedText('')
      setTextAnimating(true)
      const chars = Array.from(pageText)
      let frame = 0
      let startAt: number | null = null
      const animate = (now: number) => {
        if (runId !== motionRunRef.current) return
        startAt ??= now
        const elapsed = Math.max(0, now - startAt)
        const count = Math.min(chars.length, Math.floor(elapsed / typewriterIntervalMs) + 1)
        setDisplayedText(chars.slice(0, count).join(''))
        if (count >= chars.length) {
          setTextAnimating(false)
          notifyReady()
          return
        }
        frame = window.requestAnimationFrame(animate)
      }
      const delay = window.setTimeout(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setDisplayedText(pageText)
          setTextAnimating(false)
          notifyReady()
          return
        }
        frame = window.requestAnimationFrame(animate)
      }, Math.max(0, typewriterStartDelayMs))
      return () => {
        window.clearTimeout(delay)
        if (frame) window.cancelAnimationFrame(frame)
        motionRunRef.current += 1
      }
    }

    setDisplayedText(pageText)
    if (!shouldAnimate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOutgoing(null)
      notifyReady(focusedChoice?.id)
      return
    }
    setOutgoing(prior.identity.content === 'text' ? { ...prior, outgoing: true } : null)
  }, [identityKey, pageText, speaker, typewriterEnabled])

  useLayoutEffect(() => () => {
    motionRunRef.current += 1
    if (choiceTimerRef.current !== null) window.clearTimeout(choiceTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    const setKey = identity.optionSetKey ?? ''
    if (focus.setKey === setKey) return
    setFocus({ setKey, index: 0 })
    setChoiceSettled(true)
    wheelRemainderRef.current = 0
  }, [focus.setKey, identity.optionSetKey])

  const emitOptionFocus = (index: number) => {
    if (!choices.length) return
    const bounded = Math.max(0, Math.min(choices.length - 1, index))
    if (bounded === focusedIndex) return
    setFocus({ setKey: identity.optionSetKey ?? '', index: bounded })
    setChoiceSettled(false)
    setReadyKey(null)
    recentScrollRef.current = true
    if (choiceTimerRef.current !== null) window.clearTimeout(choiceTimerRef.current)
    choiceTimerRef.current = window.setTimeout(() => {
      choiceTimerRef.current = null
      recentScrollRef.current = false
      setChoiceSettled(true)
      const choice = choices[bounded]
      if (choice) {
        onOptionFocusChange?.(identity, choice.id, bounded)
        readyCallbackRef.current?.(identity, 'options', choice.id)
      }
    }, optionSettleMs)
    const choice = choices[bounded]
    if (choice) onOptionFocusChange?.(identity, choice.id, bounded)
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!isOptions || choices.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    wheelRemainderRef.current += event.deltaY
    if (Math.abs(wheelRemainderRef.current) >= 28) {
      const direction = Math.sign(wheelRemainderRef.current)
      wheelRemainderRef.current = 0
      emitOptionFocus(focusedIndex + direction)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOptions) return
    pointerRef.current = { id: event.pointerId, y: event.clientY, moved: false }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (!isOptions || !pointer || pointer.id !== event.pointerId) return
    const delta = pointer.y - event.clientY
    if (Math.abs(delta) < 24) return
    if (!pointer.moved) event.currentTarget.setPointerCapture(event.pointerId)
    pointer.moved = true
    pointer.y = event.clientY
    emitOptionFocus(focusedIndex + Math.sign(delta))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current
    if (pointer?.id !== event.pointerId) return
    if (pointer.moved) recentScrollRef.current = true
    pointerRef.current = null
  }

  const handleReadyAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName === 'narrow-dialogue-typewriter') return
    setOutgoing(null)
    notifyReady(focusedChoice?.id)
  }

  const handleAdvance = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isOptions) {
      event.stopPropagation()
      return
    }
    if (!isReady || textAnimating) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (onAdvance) {
      event.preventDefault()
      event.stopPropagation()
      onAdvance(identity)
      return
    }
    if (!isReady || textAnimating) return
    if (identity.kind === 'aside') {
      onExitComplete?.(identity, 'aside')
      return
    }
    if (isFinalLinePage) {
      setReadyKey(null)
      setTextAnimating(true)
      const chars = Array.from(pageText)
      let frame = 0
      let startAt: number | null = null
      const runId = ++motionRunRef.current
      const animate = (now: number) => {
        if (runId !== motionRunRef.current) return
        startAt ??= now
        const elapsed = Math.max(0, now - startAt)
        const remaining = Math.max(0, chars.length - Math.floor(elapsed / typewriterIntervalMs) - 1)
        setDisplayedText(chars.slice(0, remaining).join(''))
        if (remaining <= 0) {
          setTextAnimating(false)
          latestPropsRef.current.onExitComplete?.(latestPropsRef.current.identity, 'conversation')
          return
        }
        frame = window.requestAnimationFrame(animate)
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || chars.length === 0) {
        setDisplayedText('')
        setTextAnimating(false)
        latestPropsRef.current.onExitComplete?.(latestPropsRef.current.identity, 'conversation')
      } else frame = window.requestAnimationFrame(animate)
      return
    }
  }

  const confirmFocusedChoice = () => {
    if (!isOptions || !isReady || !choiceSettled || recentScrollRef.current || !focusedChoice) return
    onOptionConfirm?.(identity, focusedChoice.id, focusedIndex)
  }

  const style = {
    '--narrow-dialogue-window-height': `${Math.max(1, windowHeightPx)}px`,
    '--narrow-dialogue-available-width': `${Math.max(1, availableWidthPx)}px`,
    '--narrow-dialogue-page-height': `${Math.max(1, Math.min(windowHeightPx, measuredPageHeightPx))}px`,
  } as CSSProperties

  const outgoingSnapshot = outgoing
  const choiceNeighbors = choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ index }) => Math.abs(index - focusedIndex) <= 1)
  const choiceOffset = (index: number) => {
    if (index === focusedIndex) return 0
    if (index < focusedIndex) return -(Math.max(1, choices[index]?.measuredHeightPx ?? 36) + optionRowGapPx)
    return Math.max(1, choices[focusedIndex]?.measuredHeightPx ?? 36) + optionRowGapPx
  }

  return <div
    className="narrow-dialogue-content"
    style={style}
    data-narrow-dialogue="true"
    data-narrow-dialogue-session={identity.sessionKey}
    data-narrow-dialogue-kind={identity.kind}
    data-narrow-dialogue-transition={presentedSnapshot.transition}
    data-narrow-dialogue-line={identity.lineKey}
    data-narrow-dialogue-page={identity.pageIndex}
    data-narrow-dialogue-page-key={identity.pageKey}
    data-narrow-dialogue-ready={String(isReady)}
    data-narrow-dialogue-content={identity.content}
    onWheel={handleWheel}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerCancel={handlePointerUp}
    onClick={handleAdvance}
  >
    {outgoingSnapshot && <div
      className="narrow-dialogue-slot narrow-dialogue-slot--outgoing"
      aria-hidden="true"
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) setOutgoing(null) }}
    >
      {outgoingSnapshot.speaker && <div className="narrow-dialogue-speaker">{outgoingSnapshot.speaker}</div>}
      <div className="narrow-dialogue-text">{outgoingSnapshot.pageText}</div>
    </div>}
    <div
      className={`narrow-dialogue-slot narrow-dialogue-slot--current${presentedSnapshot.outgoing ? ' narrow-dialogue-slot--incoming' : ''}${isOptions ? ' narrow-dialogue-slot--options' : ''}`}
      style={{ height: 'var(--narrow-dialogue-page-height)' }}
      onAnimationEnd={handleReadyAnimationEnd}
    >
      {isOptions ? <div className="narrow-dialogue-choice-window" role="listbox" aria-label="对话选项" aria-activedescendant={focusedChoice?.id}>
        {choiceNeighbors.map(({ choice, index }) => <button
          type="button"
          key={choice.id}
          id={choice.id}
          role="option"
          aria-selected={index === focusedIndex}
          tabIndex={-1}
          className={`narrow-dialogue-choice${index === focusedIndex ? ' is-focused' : ' is-neighbor'}`}
          style={{ transform: `translate(-50%, calc(-50% + ${choiceOffset(index)}px))`, maxHeight: `${Math.max(1, choice.measuredHeightPx)}px` }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (index === focusedIndex) confirmFocusedChoice() }}
        >{choice.label}</button>)}
      </div> : <>
        {speaker && <div className="narrow-dialogue-speaker">{speaker}</div>}
        <div className={`narrow-dialogue-text${textAnimating ? ' is-animating' : ''}`}>
          {displayedText || (!isReady && !textAnimating ? '' : displayedText)}
        </div>
      </>}
    </div>
  </div>
}

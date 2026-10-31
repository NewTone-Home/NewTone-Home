'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
export type NarrowDialogueTextMotion = 'typing' | 'static' | 'deleting' | 'deleted'

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
  /** Motion owned by the parent lifecycle; deleting must report completion back to that owner. */
  textMotion?: NarrowDialogueTextMotion
  /** A prior host may own a single opening mask; text starts after its reveal. */
  typewriterStartDelayMs?: number
  /** Positions a manual-order prompt above its wheel without changing session. */
  choicePrompt?: boolean
  choices?: readonly NarrowDialogueChoice[]
  overlay?: React.ReactNode
  onReady?: (identity: NarrowDialogueIdentity, scope: 'text' | 'options', focusedChoiceId?: string) => void
  /** Reports that the current text page is fully presented, regardless of whether it typed or flipped in. */
  onTextSettled?: (identity: NarrowDialogueIdentity, motion: 'typing' | 'deleting') => string | void
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
  choicePrompt = false,
  typewriterEnabled = true,
  textMotion = typewriterEnabled ? 'typing' : 'static',
  typewriterStartDelayMs = 300,
  choices = [],
  overlay,
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
  const [displayedTextIdentityKey, setDisplayedTextIdentityKey] = useState(identityKey)
  const [textAnimating, setTextAnimating] = useState(false)
  const [readyKey, setReadyKey] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ setKey: string; index: number }>({ setKey: identity.optionSetKey ?? '', index: 0 })
  const [choiceSettled, setChoiceSettled] = useState(true)
  const previousRef = useRef<DisplaySnapshot | null>(null)
  const visiblePageRef = useRef<{ identityKey: string; text: string } | null>(null)
  const choiceTimerRef = useRef<number | null>(null)
  const recentScrollRef = useRef(false)
  const pointerRef = useRef<{ id: number; y: number; moved: boolean } | null>(null)
  const wheelRemainderRef = useRef(0)
  const lastTypewriterSessionRef = useRef<string | null>(null)
  const motionRunRef = useRef(0)
  const motionCompletionSerialRef = useRef(0)
  const lastMotionCompletionKeyRef = useRef<string | null>(null)
  const [motionCompletionDiagnostic, setMotionCompletionDiagnostic] = useState('0:none')
  const [transitionDiagnostic, setTransitionDiagnostic] = useState({ id: 0, phase: 'initial', completion: 'none' })
  const readyCallbackRef = useRef(onReady)
  const latestPropsRef = useRef({ identity, onExitComplete, onAdvance, onTextSettled })
  const currentSlotRef = useRef<HTMLDivElement | null>(null)
  const transitionRunRef = useRef(0)
  const completedTransitionRef = useRef<number | null>(null)
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
  const currentPageText = displayedTextIdentityKey === identityKey
    ? displayedText
    : typewriterEnabled
      && narrowDialogueStartsTypewriter(presentedSnapshot.transition, identity.kind, identity.content)
      && lastTypewriterSessionRef.current !== identity.sessionKey
      ? ''
      : pageText
  const visibleCharacterCount = Array.from(currentPageText).length
  const prelaidCharacters = Array.from(pageText)

  // Capture the actual rendered glyphs as they type or delete. A later
  // identity transition must not resurrect the authored full-text snapshot.
  if (displayedTextIdentityKey === identityKey) {
    visiblePageRef.current = { identityKey, text: currentPageText }
  }

  const notifyReady = (focusedChoiceId?: string) => {
    setReadyKey(identityKey)
    readyCallbackRef.current?.(identity, isOptions ? 'options' : 'text', focusedChoiceId)
  }

  const completeRollIn = (targetIdentityKey: string, transitionRun: number, completion: string) => {
    if (identityKey !== targetIdentityKey || transitionRunRef.current !== transitionRun || completedTransitionRef.current === transitionRun || textAnimating) return
    completedTransitionRef.current = transitionRun
    setOutgoing(null)
    setTransitionDiagnostic({ id: transitionRun, phase: 'ready', completion })
    notifyReady(focusedChoice?.id)
    if (identity.content === 'text' && textMotion === 'typing') reportTextMotionComplete('typing')
  }

  const reportTextMotionComplete = (motion: 'typing' | 'deleting') => {
    const completionKey = `${identityKey}:${motion}`
    if (lastMotionCompletionKeyRef.current === completionKey) return
    lastMotionCompletionKeyRef.current = completionKey
    const serial = ++motionCompletionSerialRef.current
    const result = latestPropsRef.current.onTextSettled?.(identity, motion)
    setMotionCompletionDiagnostic(`${serial}:${motion}:${typeof result === 'string' ? result : result === undefined ? 'sent' : 'accepted'}`)
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
      && (transition === 'line-change' || transition === 'capacity-page' || transition === 'options-enter' || transition === 'options-return')
    const transitionRun = priorKey === identityKey ? transitionRunRef.current : ++transitionRunRef.current
    // A content prop can settle in a follow-up render while the same identity
    // is rolling in. Preserve both slots until that animation actually ends.
    if (priorKey === identityKey && prior?.outgoing && completedTransitionRef.current !== transitionRun) return
    completedTransitionRef.current = null
    setTransitionDiagnostic({ id: transitionRun, phase: shouldAnimate ? 'animating' : 'settling', completion: shouldAnimate ? 'awaiting-roll-in' : 'identity-settled' })
    const next: DisplaySnapshot = { identity, identityKey, pageText, speaker, transition, outgoing: shouldAnimate }
    previousRef.current = next
    setSnapshot(next)
    setReadyKey(null)
    setTextAnimating(false)

    const canType = typewriterEnabled && narrowDialogueStartsTypewriter(transition, identity.kind, identity.content)
      && lastTypewriterSessionRef.current !== identity.sessionKey
    if (canType) {
      lastTypewriterSessionRef.current = identity.sessionKey
      setDisplayedTextIdentityKey(identityKey)
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
          reportTextMotionComplete('typing')
          return
        }
        frame = window.requestAnimationFrame(animate)
      }
      const delay = window.setTimeout(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setDisplayedText(pageText)
          setTextAnimating(false)
          notifyReady()
          reportTextMotionComplete('typing')
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

    if (identity.content === 'text' && textMotion === 'deleted') {
      setDisplayedTextIdentityKey(identityKey)
      setDisplayedText('')
      setReadyKey(null)
      setTextAnimating(false)
      setOutgoing(null)
      return
    }

    if (identity.content === 'text' && textMotion === 'deleting') {
      setDisplayedTextIdentityKey(identityKey)
      setReadyKey(null)
      setDisplayedText(pageText)
      setTextAnimating(true)
      setOutgoing(null)
      const chars = Array.from(pageText)
      let frame = 0
      let startAt: number | null = null
      const animateDelete = (now: number) => {
        if (runId !== motionRunRef.current) return
        startAt ??= now
        const elapsed = Math.max(0, now - startAt)
        const remaining = Math.max(0, chars.length - Math.floor(elapsed / typewriterIntervalMs) - 1)
        setDisplayedText(chars.slice(0, remaining).join(''))
        if (remaining <= 0) {
          setTextAnimating(false)
          reportTextMotionComplete('deleting')
          return
        }
        frame = window.requestAnimationFrame(animateDelete)
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || chars.length === 0) {
        setDisplayedText('')
        setTextAnimating(false)
        reportTextMotionComplete('deleting')
      } else frame = window.requestAnimationFrame(animateDelete)
      return () => {
        if (frame) window.cancelAnimationFrame(frame)
        motionRunRef.current += 1
      }
    }

    setDisplayedTextIdentityKey(identityKey)
    setDisplayedText(pageText)
    if (!shouldAnimate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOutgoing(null)
      setTransitionDiagnostic({ id: transitionRun, phase: 'ready', completion: shouldAnimate ? 'reduced-motion' : 'no-transition' })
      notifyReady(focusedChoice?.id)
      if (identity.content === 'text' && textMotion === 'typing') reportTextMotionComplete('typing')
      return
    }
    const visiblePriorText = visiblePageRef.current?.identityKey === prior.identityKey
      ? visiblePageRef.current.text
      : prior.pageText
    setOutgoing(prior.identity.content === 'text' ? { ...prior, pageText: visiblePriorText, outgoing: true } : null)
  }, [identityKey, pageText, speaker, typewriterEnabled, textMotion])

  useEffect(() => {
    if (snapshot.identityKey !== identityKey || !snapshot.outgoing) return
    const transitionRun = transitionRunRef.current
    const element = currentSlotRef.current
    if (!element) return
    const rollIn = element.getAnimations().find((animation) => (animation as CSSAnimation).animationName === 'narrow-dialogue-roll-in')
    if (!rollIn) return
    rollIn.finished.then(
      () => completeRollIn(identityKey, transitionRun, 'waapi-animation-finished'),
      () => {
        if (transitionRunRef.current === transitionRun && completedTransitionRef.current !== transitionRun) {
          setTransitionDiagnostic({ id: transitionRun, phase: 'animation-cancelled', completion: 'waapi-animation-cancelled' })
        }
      },
    )
  }, [identityKey, snapshot.identityKey, snapshot.outgoing])

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
    if (event.target !== event.currentTarget || event.animationName !== 'narrow-dialogue-roll-in' || textAnimating) return
    completeRollIn(identityKey, transitionRunRef.current, 'animationend-event')
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
    '--narrow-dialogue-copy-speaker-offset': '-16.2px',
  } as CSSProperties

  const outgoingSnapshot = outgoing
  const motionDiagnosticParts = motionCompletionDiagnostic.split(':')
  const choiceNeighbors = choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ index }) => Math.abs(index - focusedIndex) <= 1)
  const choiceOffset = (index: number) => {
    if (index === focusedIndex) return 0
    if (index < focusedIndex) return -(Math.max(1, choices[index]?.measuredHeightPx ?? 36) + optionRowGapPx)
    return Math.max(1, choices[focusedIndex]?.measuredHeightPx ?? 36) + optionRowGapPx
  }

  return <div
    className={`narrow-dialogue-content${choicePrompt ? ' narrow-dialogue-content--choice-prompt' : ''}`}
    style={style}
    data-narrow-dialogue="true"
    data-narrow-dialogue-session={identity.sessionKey}
    data-narrow-dialogue-kind={identity.kind}
    data-narrow-dialogue-transition={presentedSnapshot.transition}
    data-narrow-dialogue-line={identity.lineKey}
    data-narrow-dialogue-page={identity.pageIndex}
    data-narrow-dialogue-page-key={identity.pageKey}
    data-narrow-dialogue-ready={String(isReady)}
    data-narrow-dialogue-transition-id={transitionDiagnostic.id}
    data-narrow-dialogue-transition-phase={transitionDiagnostic.phase}
    data-narrow-dialogue-transition-completion={transitionDiagnostic.completion}
    data-narrow-dialogue-content={identity.content}
    data-narrow-dialogue-text-motion={identity.content === 'text' ? textMotion : undefined}
    data-narrow-dialogue-motion-completion={motionCompletionDiagnostic}
    data-narrow-dialogue-motion-event-serial={motionDiagnosticParts[0]}
    data-narrow-dialogue-motion-reject-reason={motionDiagnosticParts.slice(2).join(':')}
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
      <div className={`narrow-dialogue-copy${outgoingSnapshot.speaker ? ' narrow-dialogue-copy--speaker' : ''}`}>
        {outgoingSnapshot.speaker && <div className="narrow-dialogue-speaker">{outgoingSnapshot.speaker}</div>}
        <div className="narrow-dialogue-text">{outgoingSnapshot.pageText}</div>
      </div>
    </div>}
    <div
      ref={currentSlotRef}
      className={`narrow-dialogue-slot narrow-dialogue-slot--current${presentedSnapshot.outgoing ? ' narrow-dialogue-slot--incoming' : ''}${isOptions ? ' narrow-dialogue-slot--options' : ''}${choicePrompt ? ' narrow-dialogue-slot--choice-prompt' : ''}`}
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
      </div> : <div className={`narrow-dialogue-copy${presentedSnapshot.speaker ? ' narrow-dialogue-copy--speaker' : ''}`}>
        {presentedSnapshot.speaker && <div className="narrow-dialogue-speaker">{presentedSnapshot.speaker}</div>}
        <div className="narrow-dialogue-text-stack">
          <div className="narrow-dialogue-text narrow-dialogue-text--measure" aria-hidden="true">
            {pageText}
          </div>
          <div className={`narrow-dialogue-text${textAnimating ? ' is-animating' : ''}`}>
            {prelaidCharacters.map((character, index) => <span
              key={`${identityKey}:${index}`}
              style={{ visibility: index < visibleCharacterCount ? 'visible' : 'hidden' }}
            >{character}</span>)}
          </div>
        </div>
      </div>}
    </div>
    {overlay}
  </div>
}

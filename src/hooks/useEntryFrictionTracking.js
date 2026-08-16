import { useCallback, useEffect, useRef } from 'react'
import { trackEvent } from '../services/analytics'

const STEP_BY_PHASE = Object.freeze({
  'landing-leaving': 'entry:landing-transition',
  'language-active': 'entry:language',
  'mode-active': 'entry:mode',
  'reader-preparing': 'entry:reader-handoff',
})

const COMPLETION_PHASE_BY_STEP_PHASE = Object.freeze({
  'language-active': 'language-leaving',
  'mode-active': 'mode-leaving',
  'reader-preparing': 'transition-leaving',
})

export function resolveEntryStepId(phase) {
  return STEP_BY_PHASE[phase] ?? null
}

export function resolveEntryStepExitReason(fromPhase, toPhase) {
  if (fromPhase === 'landing-leaving') {
    return ['language-active', 'mode-active', 'reader-preparing'].includes(toPhase) ? 'completed' : 'abandoned'
  }
  return COMPLETION_PHASE_BY_STEP_PHASE[fromPhase] === toPhase ? 'completed' : 'abandoned'
}

export function resolveEntryBlockedStepId(phase, isGlobalTransitioning = false) {
  const currentStep = resolveEntryStepId(phase)
  if (currentStep) return currentStep
  if (phase === 'language-leaving') return 'entry:language'
  if (phase === 'mode-leaving') return 'entry:mode'
  if (phase === 'transition-leaving') return 'entry:reader-handoff'
  if (isGlobalTransitioning) return 'entry:global-transition'
  return 'entry:landing-transition'
}

function pauseVisibleTime(active, now = Date.now()) {
  if (active.visibleStartedAt === null) return
  active.dwellMs += Math.max(0, now - active.visibleStartedAt)
  active.visibleStartedAt = null
}

export function useEntryFrictionTracking(phase, context) {
  const activeRef = useRef(null)
  const contextRef = useRef(context)
  const phaseRef = useRef(phase)
  contextRef.current = context
  phaseRef.current = phase

  const beginEntryStep = useCallback((nextPhase) => {
    const stepId = resolveEntryStepId(nextPhase)
    if (!stepId || activeRef.current?.phase === nextPhase) return
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
    activeRef.current = {
      phase: nextPhase,
      stepId,
      dwellMs: 0,
      visibleStartedAt: visible ? Date.now() : null,
    }
    trackEvent('entry_step_shown', { ...contextRef.current, stepId })
  }, [])

  const closeEntryStep = useCallback((exitReason, keepalive = false) => {
    const active = activeRef.current
    if (!active) return
    pauseVisibleTime(active)
    activeRef.current = null
    trackEvent('entry_step_dwell', {
      ...contextRef.current,
      stepId: active.stepId,
      dwellMs: active.dwellMs,
      exitReason,
    }, { keepalive })
  }, [])

  useEffect(() => {
    const previous = activeRef.current
    if (previous && previous.phase !== phase) {
      closeEntryStep(resolveEntryStepExitReason(previous.phase, phase))
    }
    beginEntryStep(phase)
  }, [beginEntryStep, closeEntryStep, phase])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined

    const handleVisibility = () => {
      const active = activeRef.current
      if (!active) return
      if (document.visibilityState === 'hidden') {
        pauseVisibleTime(active)
      } else if (active.visibleStartedAt === null) {
        active.visibleStartedAt = Date.now()
      }
    }

    const handlePageHide = () => closeEntryStep('unload', true)
    const handlePageShow = () => beginEntryStep(phaseRef.current)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [beginEntryStep, closeEntryStep])
}

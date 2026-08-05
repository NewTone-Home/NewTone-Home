import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPendingRevealDelivery,
  createRevealDelivery,
  getFlowRevealEventsCrossed,
  getFocusRevealEvent,
  getRevealDeliveryKey,
  getRevealTargetLocation,
  NARRATIVE_REVEAL_STATES,
} from '../reader/narrativeReveal'
import { xiujieNarrativeEventMap } from '../reader/narrativeEventMap'
import { useNarrativeProgressStore } from '../stores/narrativeProgressStore'
import { getNarrativePlaybackEventIds, hasNarrativeEventPlayed, markNarrativeEventPlayed } from '../reader/narrativePlaybackSession'

const REVEAL_EVENTS = xiujieNarrativeEventMap.events.filter(event => event.type === 'reveal')
const REVEAL_VIEWPORT_SETTLE_MS = 860

export function useNarrativeRevealRuntime({ navigateTo, clearInputAccumulator }) {
  const beginEvent = useNarrativeProgressStore(state => state.beginEvent)
  const completeEvent = useNarrativeProgressStore(state => state.completeEvent)
  const activeRef = useRef(null)
  const timerRef = useRef(null)
  const [activeReveal, setActiveReveal] = useState(null)

  const playedEventIds = getNarrativePlaybackEventIds()

  const releaseRevealHold = useCallback(() => {
    const active = activeRef.current
    if (active?.phase !== 'hold') return false
    activeRef.current = null
    setActiveReveal(null)
    return true
  }, [])

  const finishReveal = useCallback(() => {
    const active = activeRef.current
    if (!active || active.phase !== 'revealing') return false
    window.clearTimeout(timerRef.current)
    timerRef.current = null
    completeEvent(active.event.id)
    markNarrativeEventPlayed(active.event.id)
    const held = {
      ...active,
      phase: 'hold',
      delivery: {
        ...active.delivery,
        phase: 'hold',
        state: NARRATIVE_REVEAL_STATES.CONFIRMED,
        visibleSegmentCount: active.event.target.segments.length,
        holdFuture: true,
      },
    }
    activeRef.current = held
    setActiveReveal(held)
    return true
  }, [completeEvent])

  const scheduleReveal = useCallback((event) => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const active = activeRef.current
      if (active?.event.id !== event.id || active.phase !== 'settling') return
      const revealing = {
        ...active,
        phase: 'revealing',
        delivery: { ...active.delivery, phase: 'revealing' },
      }
      activeRef.current = revealing
      setActiveReveal(revealing)
      timerRef.current = window.setTimeout(finishReveal, event.stepDurationMs)
    }, REVEAL_VIEWPORT_SETTLE_MS)
  }, [finishReveal])

  const startReveal = useCallback((event, { navigateOnStart = false } = {}) => {
    if (hasNarrativeEventPlayed(event.id)) return false
    beginEvent(event.id)
    const active = {
      event,
      deliveryKey: getRevealDeliveryKey(event),
      phase: 'settling',
      delivery: { ...createRevealDelivery(event), phase: 'settling' },
      targetLocation: getRevealTargetLocation(event),
    }
    activeRef.current = active
    setActiveReveal(active)
    if (navigateOnStart) navigateTo(active.targetLocation)
    scheduleReveal(event)
    clearInputAccumulator()
    return true
  }, [beginEvent, clearInputAccumulator, navigateTo, scheduleReveal])

  const handleFocusInputDuringReveal = useCallback((steps) => {
    if (!activeRef.current) return false
    if (activeRef.current.phase === 'hold') {
      releaseRevealHold()
      return false
    }
    clearInputAccumulator()
    return Math.sign(steps) !== 0
  }, [clearInputAccumulator, releaseRevealHold])

  const startFocusReveal = useCallback(({ fromLocation, toLocation }) => {
    const event = getFocusRevealEvent({ fromLocation, toLocation, completedEventIds: playedEventIds })
    return event ? startReveal(event, { navigateOnStart: true }) : false
  }, [playedEventIds, startReveal])

  const handleFlowFocusChange = useCallback(({ fromLocation, toLocation }) => {
    const active = activeRef.current
    if (active?.phase === 'hold') {
      releaseRevealHold()
      return true
    }
    if (active) return false

    const crossed = getFlowRevealEventsCrossed({ fromLocation, toLocation, completedEventIds: getNarrativePlaybackEventIds() })
    const firstCrossed = crossed[0]
    if (!firstCrossed) return true
    startReveal(firstCrossed.event, { navigateOnStart: true })
    return false
  }, [releaseRevealHold, startReveal])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const deliveryStates = useMemo(() => {
    const completed = new Set(playedEventIds)
    const states = Object.fromEntries(REVEAL_EVENTS.map(event => [
      getRevealDeliveryKey(event),
      completed.has(event.id) ? NARRATIVE_REVEAL_STATES.CONFIRMED : createPendingRevealDelivery(event),
    ]))
    if (activeReveal) states[activeReveal.deliveryKey] = activeReveal.delivery
    return states
  }, [activeReveal, playedEventIds])

  return {
    activeRevealId: activeReveal && activeReveal.phase !== 'hold' ? activeReveal.event.id : null,
    deliveryStates,
    handleFlowFocusChange,
    handleFocusInputDuringReveal,
    startFocusReveal,
  }
}

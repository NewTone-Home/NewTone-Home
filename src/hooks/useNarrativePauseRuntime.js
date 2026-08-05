import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getFlowPauseEventsCrossed,
  getFocusPauseEvent,
  getPauseDeliveryKey,
  getPauseTargetLocation,
  isBetweenBeatPause,
  createPendingPauseDelivery,
} from '../reader/narrativePause'
import { xiujieNarrativeEventMap } from '../reader/narrativeEventMap'
import { useNarrativeProgressStore } from '../stores/narrativeProgressStore'
import { getNarrativePlaybackEventIds, hasNarrativeEventPlayed, markNarrativeEventPlayed } from '../reader/narrativePlaybackSession'

const PAUSE_EVENTS = xiujieNarrativeEventMap.events.filter(event => event.type === 'pause')
const PAUSE_EVENT_IDS = new Set(PAUSE_EVENTS.map(event => event.id))
const PAUSE_DELIVERY_MS = 880

export function useNarrativePauseRuntime({ navigateTo, clearInputAccumulator }) {
  const chapters = useNarrativeProgressStore(state => state.chapters)
  const beginEvent = useNarrativeProgressStore(state => state.beginEvent)
  const completeEvent = useNarrativeProgressStore(state => state.completeEvent)
  const activeRef = useRef(null)
  const timerRef = useRef(null)
  const [activePause, setActivePause] = useState(null)

  const playedEventIds = getNarrativePlaybackEventIds()

  const releasePauseHold = useCallback(() => {
    const active = activeRef.current
    if (active?.phase !== 'hold') return false
    activeRef.current = null
    setActivePause(null)
    return true
  }, [])

  const finishPause = useCallback(() => {
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
        state: 'delivered',
        holdFuture: true,
      },
    }
    activeRef.current = held
    setActivePause(held)
    return true
  }, [completeEvent])

  const startPause = useCallback((event, { deliveryMode, navigateOnStart = false } = {}) => {
    if (hasNarrativeEventPlayed(event.id)) return false
    beginEvent(event.id)
    const active = {
      event,
      deliveryKey: getPauseDeliveryKey(event),
      deliveryMode,
      phase: 'waiting',
      delivery: createPendingPauseDelivery(event),
      targetLocation: getPauseTargetLocation(event),
    }
    activeRef.current = active
    setActivePause(active)
    if (navigateOnStart) navigateTo(active.targetLocation)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const current = activeRef.current
      if (current?.event.id !== event.id || current.phase !== 'waiting') return
      if (current.deliveryMode === 'before-target') navigateTo(current.targetLocation)
      const revealing = {
        ...current,
        phase: 'revealing',
        delivery: {
          ...current.delivery,
          phase: 'revealing',
          state: 'revealing',
        },
      }
      activeRef.current = revealing
      setActivePause(revealing)
      timerRef.current = window.setTimeout(finishPause, PAUSE_DELIVERY_MS)
    }, event.durationMs)
    clearInputAccumulator()
    return true
  }, [beginEvent, clearInputAccumulator, finishPause, navigateTo])

  const handleFocusInputDuringPause = useCallback((steps) => {
    if (!activeRef.current) return false
    if (activeRef.current.phase === 'hold') {
      releasePauseHold()
      return false
    }
    clearInputAccumulator()
    return Math.sign(steps) !== 0
  }, [clearInputAccumulator, releasePauseHold])

  const startFocusPause = useCallback(({ fromLocation, toLocation }) => {
    const event = getFocusPauseEvent({ fromLocation, toLocation, completedEventIds: playedEventIds })
    if (!event) return false
    const betweenBeats = isBetweenBeatPause(event)
    return startPause(event, {
      deliveryMode: betweenBeats ? 'before-target' : 'at-target',
      navigateOnStart: !betweenBeats,
    })
  }, [playedEventIds, startPause])

  const handleFlowFocusChange = useCallback(({ fromLocation, toLocation }) => {
    const active = activeRef.current
    if (active?.phase === 'hold') {
      releasePauseHold()
      return true
    }
    if (active) return false

    const crossed = getFlowPauseEventsCrossed({ fromLocation, toLocation, completedEventIds: getNarrativePlaybackEventIds() })
    const firstCrossed = crossed[0]
    if (!firstCrossed) return true
    startPause(firstCrossed.event, { deliveryMode: 'at-target', navigateOnStart: true })
    return false
  }, [releasePauseHold, startPause])

  useEffect(() => {
    Object.values(chapters).forEach(chapter => {
      const inFlightEvent = chapter.inFlightEvent
      if (inFlightEvent && PAUSE_EVENT_IDS.has(inFlightEvent.eventId) && activeRef.current?.event.id !== inFlightEvent.eventId) {
        completeEvent(inFlightEvent.eventId)
      }
    })
  }, [chapters, completeEvent])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const deliveryStates = useMemo(() => {
    const played = new Set(playedEventIds)
    const states = Object.fromEntries(PAUSE_EVENTS
      .filter(event => !played.has(event.id))
      .map(event => [getPauseDeliveryKey(event), createPendingPauseDelivery(event)]))
    if (activePause) states[activePause.deliveryKey] = activePause.delivery
    return states
  }, [activePause, playedEventIds])

  return {
    activePauseId: activePause && activePause.phase !== 'hold' ? activePause.event.id : null,
    activePausePhase: activePause?.phase ?? 'idle',
    deliveryStates,
    handleFlowFocusChange,
    handleFocusInputDuringPause,
    startFocusPause,
  }
}

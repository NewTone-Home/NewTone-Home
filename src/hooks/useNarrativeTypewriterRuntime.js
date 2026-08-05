import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readerNarrativeEventMap } from '../reader/narrativeEventMap'
import {
  createTypewriterDelivery,
  getFlowTypewriterEventsCrossed,
  getFocusTypewriterEvent,
  getTypewriterDeliveryKey,
  getTypewriterTargetLocation,
} from '../reader/narrativeTypewriter'
import { useNarrativeProgressStore } from '../stores/narrativeProgressStore'
import { getNarrativePlaybackEventIds, hasNarrativeEventPlayed, markNarrativeEventPlayed } from '../reader/narrativePlaybackSession'

const TYPEWRITER_EVENTS = readerNarrativeEventMap.events.filter(event => event.type === 'typewriter')

export function useNarrativeTypewriterRuntime({ navigateTo, clearInputAccumulator }) {
  const beginEvent = useNarrativeProgressStore(state => state.beginEvent)
  const completeEvent = useNarrativeProgressStore(state => state.completeEvent)
  const activeRef = useRef(null)
  const timerRef = useRef(null)
  const [activeTypewriter, setActiveTypewriter] = useState(null)
  const playedEventIds = getNarrativePlaybackEventIds()

  const finishTypewriter = useCallback(() => {
    const active = activeRef.current
    if (!active) return false
    window.clearTimeout(timerRef.current)
    completeEvent(active.event.id)
    markNarrativeEventPlayed(active.event.id)
    activeRef.current = null
    setActiveTypewriter(null)
    return true
  }, [completeEvent])

  const scheduleNextCharacter = useCallback((delayMs) => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const active = activeRef.current
      if (!active) return
      const nextCount = active.delivery.visibleCharacterCount + 1
      if (nextCount >= active.event.target.textFrame.typed.length) {
        finishTypewriter()
        return
      }
      const next = { ...active, delivery: createTypewriterDelivery(active.event, nextCount) }
      activeRef.current = next
      setActiveTypewriter(next)
      scheduleNextCharacter(active.event.characterDurationMs)
    }, delayMs)
  }, [finishTypewriter])

  const startTypewriter = useCallback((event, { navigateOnStart = false } = {}) => {
    if (hasNarrativeEventPlayed(event.id)) return false
    beginEvent(event.id)
    const active = {
      event,
      deliveryKey: getTypewriterDeliveryKey(event),
      delivery: createTypewriterDelivery(event),
      targetLocation: getTypewriterTargetLocation(event),
    }
    activeRef.current = active
    setActiveTypewriter(active)
    if (navigateOnStart) navigateTo(active.targetLocation)
    scheduleNextCharacter(event.characterDurationMs)
    clearInputAccumulator()
    return true
  }, [beginEvent, clearInputAccumulator, navigateTo, scheduleNextCharacter])

  const handleFocusInputDuringTypewriter = useCallback(steps => {
    if (!activeRef.current) return false
    clearInputAccumulator()
    return Math.sign(steps) !== 0
  }, [clearInputAccumulator])

  const startFocusTypewriter = useCallback(({ fromLocation, toLocation }) => {
    const event = getFocusTypewriterEvent({ fromLocation, toLocation, completedEventIds: playedEventIds })
    return event ? startTypewriter(event, { navigateOnStart: true }) : false
  }, [playedEventIds, startTypewriter])

  const handleFlowFocusChange = useCallback(({ fromLocation, toLocation }) => {
    const active = activeRef.current
    if (active) return false
    const firstCrossed = getFlowTypewriterEventsCrossed({
      fromLocation,
      toLocation,
      completedEventIds: getNarrativePlaybackEventIds(),
    })[0]
    if (!firstCrossed) return true
    startTypewriter(firstCrossed.event, { navigateOnStart: true })
    return false
  }, [startTypewriter])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const deliveryStates = useMemo(() => {
    const completed = new Set(playedEventIds)
    const states = Object.fromEntries(TYPEWRITER_EVENTS.map(event => [
      getTypewriterDeliveryKey(event),
      completed.has(event.id) ? 'delivered' : createTypewriterDelivery(event),
    ]))
    if (activeTypewriter) states[activeTypewriter.deliveryKey] = activeTypewriter.delivery
    return states
  }, [activeTypewriter, playedEventIds])

  return {
    activeTypewriterId: activeTypewriter?.event.id ?? null,
    deliveryStates,
    handleFlowFocusChange,
    handleFocusInputDuringTypewriter,
    startFocusTypewriter,
  }
}

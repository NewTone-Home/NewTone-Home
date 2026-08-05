import { comparePosition, resolvePosition } from './readerPosition'
import { resolveNarrativeBeatAddress, xiujieNarrativeEventMap } from './narrativeEventMap'

export const NARRATIVE_REVEAL_STATES = Object.freeze({
  UNCONFIRMED: 'unconfirmed',
  PARTIAL: 'partial',
  CONFIRMED: 'confirmed',
})

const REVEAL_EVENTS = xiujieNarrativeEventMap.events.filter(event => event.type === 'reveal')

function persistedLocation(location) {
  const resolved = resolvePosition(location)
  return {
    phaseId: resolved.phaseId,
    pageId: resolved.pageId,
    beatIndex: resolved.beatIndex,
  }
}

function eventTargetLocation(event) {
  const resolved = resolveNarrativeBeatAddress(event.trigger.to)
  return {
    phaseId: resolved.phase.id,
    pageId: resolved.page.id,
    beatIndex: resolved.beatIndex,
  }
}

function matchesBeatAddress(location, address) {
  const resolved = resolveNarrativeBeatAddress(address)
  const current = resolvePosition(location)
  return current.phaseId === resolved.phase.id
    && current.pageId === resolved.page.id
    && current.beatIndex === resolved.beatIndex
}

export function getRevealDeliveryKey(event) {
  if (event?.type !== 'reveal') throw new TypeError('Reveal delivery key requires a Reveal event')
  return `${event.target.beatId}:${event.target.blockId}`
}

export function getFocusRevealEvent({ fromLocation, toLocation, completedEventIds = [] }) {
  if (comparePosition(persistedLocation(toLocation), persistedLocation(fromLocation)) <= 0) return null
  const completed = new Set(completedEventIds)
  return REVEAL_EVENTS.find(event => (
    !completed.has(event.id) && matchesBeatAddress(toLocation, event.trigger.to)
  )) ?? null
}

export function getFlowRevealEventsCrossed({ fromLocation, toLocation, completedEventIds = [] }) {
  const from = persistedLocation(fromLocation)
  const to = persistedLocation(toLocation)
  if (comparePosition(to, from) <= 0) return []
  const completed = new Set(completedEventIds)

  return REVEAL_EVENTS
    .filter(event => {
      if (completed.has(event.id)) return false
      const target = eventTargetLocation(event)
      return comparePosition(target, from) > 0 && comparePosition(target, to) <= 0
    })
    .map(event => ({
      event,
      targetLocation: eventTargetLocation(event),
      landedOnTarget: matchesBeatAddress(to, event.trigger.to),
    }))
}

export function createRevealDelivery(event) {
  if (event?.type !== 'reveal') throw new TypeError('Reveal delivery requires a Reveal event')
  return Object.freeze({
    type: 'reveal',
    eventId: event.id,
    presentation: event.presentation,
    stepDurationMs: event.stepDurationMs,
    phase: 'revealing',
    state: NARRATIVE_REVEAL_STATES.UNCONFIRMED,
    delivery: event.delivery,
    visibleSegmentCount: event.delivery === 'clarify' ? event.target.segments.length : 1,
    segments: event.target.segments,
    textFrame: event.target.textFrame,
  })
}

export function createPendingRevealDelivery(event) {
  return Object.freeze({
    ...createRevealDelivery(event),
    phase: 'pending',
    visibleSegmentCount: event.delivery === 'clarify' ? event.target.segments.length : 0,
  })
}

export function advanceRevealDelivery(delivery) {
  if (delivery?.type !== 'reveal') throw new TypeError('Reveal delivery state is required')
  if (delivery.delivery === 'clarify') {
    return Object.freeze({
      ...delivery,
      state: delivery.state === NARRATIVE_REVEAL_STATES.UNCONFIRMED
        ? NARRATIVE_REVEAL_STATES.PARTIAL
        : NARRATIVE_REVEAL_STATES.CONFIRMED,
    })
  }
  const visibleSegmentCount = Math.min(delivery.segments.length, delivery.visibleSegmentCount + 1)
  return Object.freeze({
    ...delivery,
    visibleSegmentCount,
    state: visibleSegmentCount === delivery.segments.length
      ? NARRATIVE_REVEAL_STATES.CONFIRMED
      : NARRATIVE_REVEAL_STATES.PARTIAL,
  })
}

export function getRevealTargetLocation(event) {
  if (event?.type !== 'reveal') throw new TypeError('Reveal target location requires a Reveal event')
  return eventTargetLocation(event)
}

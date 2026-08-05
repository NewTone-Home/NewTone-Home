import { comparePosition, resolvePosition } from './readerPosition'
import { resolveNarrativeBeatAddress, xiujieNarrativeEventMap } from './narrativeEventMap'

export const NARRATIVE_DELIVERY_STATES = Object.freeze({
  PENDING: 'pending',
  DELIVERED: 'delivered',
})

const PAUSE_EVENTS = xiujieNarrativeEventMap.events.filter(event => event.type === 'pause')

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

export function getPauseDeliveryKey(event) {
  if (event?.type !== 'pause') throw new TypeError('Pause delivery key requires a Pause event')
  return `${event.target.beatId}:${event.target.blockId}`
}

export function createPendingPauseDelivery(event) {
  if (event?.type !== 'pause') throw new TypeError('Pause delivery requires a Pause event')
  return Object.freeze({
    type: 'pause',
    eventId: event.id,
    phase: 'waiting',
    state: NARRATIVE_DELIVERY_STATES.PENDING,
    textFrame: event.target.textFrame ?? null,
  })
}

export function getFocusPauseEvent({ fromLocation, toLocation, completedEventIds = [] }) {
  if (comparePosition(persistedLocation(toLocation), persistedLocation(fromLocation)) <= 0) return null
  const completed = new Set(completedEventIds)
  return PAUSE_EVENTS.find(event => {
    if (completed.has(event.id) || !matchesBeatAddress(toLocation, event.trigger.to)) return false
    return !event.trigger.from || matchesBeatAddress(fromLocation, event.trigger.from)
  }) ?? null
}

export function getFlowPauseEventsCrossed({ fromLocation, toLocation, completedEventIds = [] }) {
  const from = persistedLocation(fromLocation)
  const to = persistedLocation(toLocation)
  if (comparePosition(to, from) <= 0) return []
  const completed = new Set(completedEventIds)

  return PAUSE_EVENTS
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

export function getPauseTargetLocation(event) {
  if (event?.type !== 'pause') throw new TypeError('Pause target location requires a Pause event')
  return eventTargetLocation(event)
}

export function isBetweenBeatPause(event) {
  return event?.type === 'pause' && Boolean(event.trigger.from)
}

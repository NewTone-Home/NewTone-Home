import { comparePosition, resolvePosition } from './readerPosition'
import { resolveNarrativeBeatAddress, readerNarrativeEventMap } from './narrativeEventMap'

export const NARRATIVE_TYPEWRITER_STATES = Object.freeze({ PENDING: 'pending', TYPING: 'typing', COMPLETED: 'completed' })
const TYPEWRITER_EVENTS = readerNarrativeEventMap.events.filter(event => event.type === 'typewriter')

const persistedLocation = location => {
  const resolved = resolvePosition(location)
  return { phaseId: resolved.phaseId, pageId: resolved.pageId, beatIndex: resolved.beatIndex }
}

function eventTargetLocation(event) {
  const resolved = resolveNarrativeBeatAddress(event.trigger.to)
  return { phaseId: resolved.phase.id, pageId: resolved.page.id, beatIndex: resolved.beatIndex }
}

function matchesBeatAddress(location, address) {
  const resolved = resolveNarrativeBeatAddress(address)
  const current = resolvePosition(location)
  return current.phaseId === resolved.phase.id && current.pageId === resolved.page.id && current.beatIndex === resolved.beatIndex
}

export function getTypewriterDeliveryKey(event) {
  if (event?.type !== 'typewriter') throw new TypeError('Typewriter delivery key requires a Typewriter event')
  return `${event.target.beatId}:${event.target.blockId}`
}

export function getFocusTypewriterEvent({ fromLocation, toLocation, completedEventIds = [] }) {
  if (comparePosition(persistedLocation(toLocation), persistedLocation(fromLocation)) <= 0) return null
  const completed = new Set(completedEventIds)
  return TYPEWRITER_EVENTS.find(event => !completed.has(event.id) && matchesBeatAddress(toLocation, event.trigger.to)) ?? null
}

export function getFlowTypewriterEventsCrossed({ fromLocation, toLocation, completedEventIds = [] }) {
  const from = persistedLocation(fromLocation)
  const to = persistedLocation(toLocation)
  if (comparePosition(to, from) <= 0) return []
  const completed = new Set(completedEventIds)
  return TYPEWRITER_EVENTS
    .filter(event => {
      if (completed.has(event.id)) return false
      const target = eventTargetLocation(event)
      return comparePosition(target, from) > 0 && comparePosition(target, to) <= 0
    })
    .map(event => ({ event, landedOnTarget: matchesBeatAddress(to, event.trigger.to) }))
}

export function createTypewriterDelivery(event, visibleCharacterCount = 0) {
  if (event?.type !== 'typewriter') throw new TypeError('Typewriter delivery requires a Typewriter event')
  const completed = visibleCharacterCount >= event.target.textFrame.typed.length
  return Object.freeze({
    type: 'typewriter',
    eventId: event.id,
    state: completed ? NARRATIVE_TYPEWRITER_STATES.COMPLETED : visibleCharacterCount > 0 ? NARRATIVE_TYPEWRITER_STATES.TYPING : NARRATIVE_TYPEWRITER_STATES.PENDING,
    visibleCharacterCount: Math.min(visibleCharacterCount, event.target.textFrame.typed.length),
    textFrame: event.target.textFrame,
  })
}

export function getTypewriterTargetLocation(event) {
  if (event?.type !== 'typewriter') throw new TypeError('Typewriter target location requires a Typewriter event')
  return eventTargetLocation(event)
}

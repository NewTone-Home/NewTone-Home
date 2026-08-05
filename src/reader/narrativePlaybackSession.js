import { comparePosition, resolvePosition } from './readerPosition'
import { resolveNarrativeBeatAddress, xiujieNarrativeEventMap } from './narrativeEventMap'

let sessionId = 0
let playedEventIds = new Set()

// Runtime delivery is intentionally paused for the continuous-reading shell.
// Event data, playback bookkeeping and hooks remain intact for later re-enable.
export const NARRATIVE_RUNTIME_ENABLED = false

function eventLocation(event) {
  const resolved = resolveNarrativeBeatAddress(event.trigger.to)
  return { phaseId: resolved.phase.id, pageId: resolved.page.id, beatIndex: resolved.beatIndex }
}

export function beginNarrativePlaybackSession(startLocation) {
  sessionId += 1
  const start = startLocation ? resolvePosition(startLocation) : null
  playedEventIds = new Set(start
    ? xiujieNarrativeEventMap.events
      .filter(event => comparePosition(eventLocation(event), start) < 0)
      .map(event => event.id)
    : [])
  return sessionId
}

export function getNarrativePlaybackEventIds() {
  return [...playedEventIds]
}

export function hasNarrativeEventPlayed(eventId) {
  return playedEventIds.has(eventId)
}

export function markNarrativeEventPlayed(eventId) {
  playedEventIds.add(eventId)
}

export function getNarrativePlaybackSessionId() {
  return sessionId
}

import { comparePosition } from '../reader/readerPosition'
import { resolveReaderDisplayLocation } from '../data/readerContent'
import { resolveNarrativeBeatAddress, readerNarrativeEventMap } from '../reader/narrativeEventMap'

export const NARRATIVE_PROGRESS_STORAGE_KEY = 'newtone-narrative-progress-v2'
export const NARRATIVE_PROGRESS_VERSION = 2
export const NARRATIVE_RECOVERY_POLICY = 'resolve_and_complete'
const LEGACY_STORAGE_KEY = 'newtone-narrative-progress-v1'

const EVENT_MAP = readerNarrativeEventMap
const EVENTS_BY_ID = new Map(EVENT_MAP.events.map(event => [event.id, event]))
const CHAPTER_IDS = [...new Set(EVENT_MAP.events.map(event => event.chapterId))]
const EVENT_IDS_BY_CHAPTER = Object.fromEntries(CHAPTER_IDS.map(chapterId => [
  chapterId,
  EVENT_MAP.events.filter(event => event.chapterId === chapterId).map(event => event.id),
]))

const cloneInFlightEvent = inFlightEvent => inFlightEvent
  ? { eventId: inFlightEvent.eventId, recoveryPolicy: NARRATIVE_RECOVERY_POLICY }
  : null

function chapterState(eventMapVersion, completedEvents = [], inFlightEvent = null) {
  return { eventMapVersion, completedEvents: [...completedEvents], inFlightEvent: cloneInFlightEvent(inFlightEvent) }
}

export function createInitialNarrativeProgressState() {
  return {
    _version: NARRATIVE_PROGRESS_VERSION,
    chapters: Object.fromEntries(CHAPTER_IDS.map(chapterId => [
      chapterId,
      chapterState(EVENT_MAP.eventMapVersion),
    ])),
  }
}

function normalizeCompletedEvents(chapterId, value) {
  const validIds = EVENT_IDS_BY_CHAPTER[chapterId]
  const completed = new Set(Array.isArray(value) ? value.filter(eventId => validIds.includes(eventId)) : [])
  return validIds.filter(eventId => completed.has(eventId))
}

function normalizeInFlightEvent(chapterId, value) {
  if (!value || typeof value !== 'object') return null
  const event = EVENTS_BY_ID.get(value.eventId)
  if (!event || event.chapterId !== chapterId || value.recoveryPolicy !== NARRATIVE_RECOVERY_POLICY) return null
  return cloneInFlightEvent(value)
}

function completedEventsAt(chapterId, furthestLocation) {
  if (!furthestLocation) return []
  const resolvedFurthestLocation = resolveReaderDisplayLocation(furthestLocation)
  return EVENT_MAP.events
    .filter(event => event.chapterId === chapterId)
    .filter(event => {
      try {
        const target = resolveNarrativeBeatAddress(event.trigger.to)
        return comparePosition(resolvedFurthestLocation, {
          phaseId: target.phase.id,
          pageId: target.page.id,
          beatIndex: target.beatIndex,
        }) >= 0
      } catch {
        return false
      }
    })
    .map(event => event.id)
}

export function migrateNarrativeProgressFromReader(readerProgress) {
  return {
    _version: NARRATIVE_PROGRESS_VERSION,
    chapters: Object.fromEntries(CHAPTER_IDS.map(chapterId => [
      chapterId,
      chapterState(EVENT_MAP.eventMapVersion, completedEventsAt(chapterId, readerProgress?.furthestLocation)),
    ])),
  }
}

export function sanitizeNarrativeProgressState(value, readerProgress) {
  const source = value && typeof value === 'object' ? value : {}
  const sourceChapters = source.chapters && typeof source.chapters === 'object' ? source.chapters : {}
  const fallback = migrateNarrativeProgressFromReader(readerProgress)
  return {
    _version: NARRATIVE_PROGRESS_VERSION,
    chapters: Object.fromEntries(CHAPTER_IDS.map(chapterId => {
      const sourceChapter = sourceChapters[chapterId] ?? fallback.chapters[chapterId]
      return [chapterId, chapterState(
        EVENT_MAP.eventMapVersion,
        normalizeCompletedEvents(chapterId, sourceChapter?.completedEvents),
        normalizeInFlightEvent(chapterId, sourceChapter?.inFlightEvent),
      )]
    })),
  }
}

export function recoverNarrativeProgressState(value, readerProgress) {
  let clean = sanitizeNarrativeProgressState(value, readerProgress)
  Object.values(clean.chapters).forEach(chapter => {
    if (chapter.inFlightEvent) clean = completeNarrativeEvent(clean, chapter.inFlightEvent.eventId)
  })
  return clean
}

function parseStorageValue(storage, key) {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function migrateLegacyState(storage) {
  const legacy = parseStorageValue(storage, LEGACY_STORAGE_KEY)
  const oldChapter = legacy?.chapters?.['xj-ch1']
  if (!oldChapter) return null
  return {
    _version: NARRATIVE_PROGRESS_VERSION,
    chapters: {
      'xiujie-01': {
        completedEvents: oldChapter.completedEvents,
        inFlightEvent: oldChapter.inFlightEvent,
      },
    },
  }
}

export function saveNarrativeProgressState(storage, state) {
  storage?.setItem(NARRATIVE_PROGRESS_STORAGE_KEY, JSON.stringify(sanitizeNarrativeProgressState(state)))
}

export function loadNarrativeProgressState(storage, readerProgress) {
  const stored = parseStorageValue(storage, NARRATIVE_PROGRESS_STORAGE_KEY)
  const source = stored?._version === NARRATIVE_PROGRESS_VERSION ? stored : migrateLegacyState(storage)
  const state = source ? recoverNarrativeProgressState(source, readerProgress) : migrateNarrativeProgressFromReader(readerProgress)
  saveNarrativeProgressState(storage, state)
  return state
}

export function clearNarrativeProgressStorage(storage) {
  storage?.removeItem(NARRATIVE_PROGRESS_STORAGE_KEY)
  storage?.removeItem(LEGACY_STORAGE_KEY)
}

export function beginNarrativeEvent(state, eventId) {
  const event = EVENTS_BY_ID.get(eventId)
  if (!event) throw new RangeError(`Unknown Narrative event: ${String(eventId)}`)
  const clean = sanitizeNarrativeProgressState(state)
  const chapter = clean.chapters[event.chapterId]
  if (chapter.completedEvents.includes(eventId) || chapter.inFlightEvent?.eventId === eventId) return clean
  if (chapter.inFlightEvent) throw new Error(`Narrative event already in flight: ${chapter.inFlightEvent.eventId}`)
  return {
    ...clean,
    chapters: {
      ...clean.chapters,
      [event.chapterId]: chapterState(EVENT_MAP.eventMapVersion, chapter.completedEvents, {
        eventId,
        recoveryPolicy: NARRATIVE_RECOVERY_POLICY,
      }),
    },
  }
}

export function completeNarrativeEvent(state, eventId) {
  const event = EVENTS_BY_ID.get(eventId)
  if (!event) throw new RangeError(`Unknown Narrative event: ${String(eventId)}`)
  const clean = sanitizeNarrativeProgressState(state)
  const chapter = clean.chapters[event.chapterId]
  if (chapter.inFlightEvent && chapter.inFlightEvent.eventId !== eventId) {
    throw new Error(`Cannot complete ${eventId} while ${chapter.inFlightEvent.eventId} is in flight`)
  }
  return {
    ...clean,
    chapters: {
      ...clean.chapters,
      [event.chapterId]: chapterState(
        EVENT_MAP.eventMapVersion,
        normalizeCompletedEvents(event.chapterId, [...chapter.completedEvents, eventId]),
        null,
      ),
    },
  }
}

export function completeSkippedNarrativeEvent(state, eventId) {
  const event = EVENTS_BY_ID.get(eventId)
  if (!event) throw new RangeError(`Unknown Narrative event: ${String(eventId)}`)
  const clean = sanitizeNarrativeProgressState(state)
  const chapter = clean.chapters[event.chapterId]
  if (chapter.inFlightEvent?.eventId === eventId) return completeNarrativeEvent(clean, eventId)
  return {
    ...clean,
    chapters: {
      ...clean.chapters,
      [event.chapterId]: chapterState(
        EVENT_MAP.eventMapVersion,
        normalizeCompletedEvents(event.chapterId, [...chapter.completedEvents, eventId]),
        chapter.inFlightEvent,
      ),
    },
  }
}

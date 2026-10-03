import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { createSessionActivityTracker } from './sessionActivityTracker.js'

const VISITOR_KEY = 'newtone-analytics-visitor-v1'
const SESSION_KEY = 'newtone-analytics-session-v1'
const EVENTS = new Set([
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
  'admin_login', 'admin_draft_saved', 'admin_published',
  'center_entry_requested', 'center_scene_entered', 'center_scene_exited',
  'center_object_interacted', 'center_door_attempted', 'center_door_blocked',
  'center_door_crossed', 'center_phone_opened', 'center_phone_closed', 'center_ride_ready',
  'center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked',
  'center_position_sample', 'center_reading_started', 'center_reading_ended', 'session_checkpoint',
  'center_feedback_opened', 'center_feedback_submitted',
  'commercial_street_entered', 'commercial_question_triggered', 'commercial_question_completed',
  'commercial_storefront_interacted', 'milk_tea_app_unlocked', 'milk_tea_order_started',
  'milk_tea_order_confirmed', 'milk_tea_order_ready', 'milk_tea_order_picked_up',
  'cafe_storefront_revealed', 'cafe_entered', 'cafe_story_stage_reached',
  'cafe_coffee_ordered', 'cafe_ready_to_leave', 'cafe_completed',
])
const LANGUAGES = new Set(['zh', 'en'])
const MODES = new Set(['immersive', 'standard'])
const EXIT_REASONS = new Set(['return', 'landing', 'hidden', 'unload', 'completed', 'abandoned', 'browser_back'])
const PHONE_DEVICES = new Set(['surface', 'inner'])
const MILESTONES = [0.25, 0.5, 0.75, 1]
const PENDING_EVENTS_KEY = 'newtone-analytics-pending-v1'
const MAX_PENDING_EVENTS = 2000
const PENDING_BATCH_SIZE = 20
const KEEPALIVE_BATCH_SIZE = 10
const MAX_SEQUENCE = 100000
const MAX_ACTIVITY_MS = 31_536_000_000
let flushPromise = null
let sessionActivityTracker = null
let analyticsPhoneDevice = null
const lifecycleObservers = new Set()

const nonDroppableEvents = new Set([
  'center_entry_requested', 'center_object_interacted',
  'center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked',
  'center_scene_entered', 'center_scene_exited', 'center_door_attempted', 'center_door_blocked',
  'center_door_crossed', 'center_phone_opened', 'center_phone_closed', 'center_ride_ready', 'session_end',
  'commercial_street_entered', 'commercial_question_triggered', 'commercial_question_completed',
  'commercial_storefront_interacted', 'milk_tea_app_unlocked', 'milk_tea_order_started',
  'milk_tea_order_confirmed', 'milk_tea_order_ready', 'milk_tea_order_picked_up',
  'cafe_storefront_revealed', 'cafe_entered', 'cafe_story_stage_reached', 'cafe_coffee_ordered',
  'cafe_ready_to_leave', 'cafe_completed', 'center_feedback_opened', 'center_feedback_submitted',
])

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? null
}

function safeRead(storage, key) {
  try { return storage?.getItem(key) ?? null } catch { return null }
}

function safeWrite(storage, key, value) {
  try { storage?.setItem(key, value); return true } catch { return false }
}

function readPendingEvents(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(safeRead(storage, PENDING_EVENTS_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(event => event && typeof event === 'object' && typeof event.client_event_id === 'string')
      : []
  } catch {
    return []
  }
}

function writePendingEvents(events, storage = globalThis.localStorage) {
  return safeWrite(storage, PENDING_EVENTS_KEY, JSON.stringify(compactPendingEvents(events)))
}

export function compactPendingEvents(events) {
  const kept = [...events]
  while (kept.length > MAX_PENDING_EVENTS) {
    let dropIndex = kept.findIndex(event => event?.event_name === 'center_position_sample')
    if (dropIndex < 0) dropIndex = kept.findIndex(event => event?.event_name === 'session_checkpoint')
    if (dropIndex < 0) dropIndex = kept.findIndex(event => !nonDroppableEvents.has(event?.event_name))
    // Important semantic events are never evicted to make room for trajectory
    // telemetry. In a prolonged offline session this makes the cap soft.
    if (dropIndex < 0) break
    kept.splice(dropIndex, 1)
  }
  return kept
}

function enqueuePendingEvent(payload, storage = globalThis.localStorage) {
  const pending = readPendingEvents(storage)
  if (pending.some(event => event.client_event_id === payload.client_event_id)) return true
  return writePendingEvents([...pending, payload], storage)
}

function analyticsUrl() {
  return `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events?on_conflict=client_event_id`
}

function analyticsHeaders() {
  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=ignore-duplicates,return=minimal',
  }
}

async function sendPendingBatch(events, keepalive) {
  if (keepalive && typeof fetch === 'function') {
    const response = await fetch(analyticsUrl(), {
      method: 'POST',
      keepalive: true,
      headers: analyticsHeaders(),
      body: JSON.stringify(events),
    })
    return response.ok
  }
  const { error } = await supabase.from('analytics_events').insert(events)
  if (!error) return true
  if (error.code !== '23505') return false
  for (const event of events) {
    const { error: singleError } = await supabase.from('analytics_events').insert(event)
    if (singleError && singleError.code !== '23505') return false
  }
  return true
}

export function flushAnalyticsQueue({ keepalive = false, storage = globalThis.localStorage } = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false)
  if (flushPromise) return flushPromise
  flushPromise = (async () => {
    let allSent = true
    while (true) {
      const pending = readPendingEvents(storage)
      if (pending.length === 0) break
      const batch = pending.slice(0, keepalive ? KEEPALIVE_BATCH_SIZE : PENDING_BATCH_SIZE)
      try {
        const sent = await sendPendingBatch(batch, keepalive)
        if (!sent) {
          allSent = false
          break
        }
        const sentIds = new Set(batch.map(event => event.client_event_id))
        writePendingEvents(
          readPendingEvents(storage).filter(event => !sentIds.has(event.client_event_id)),
          storage,
        )
        if (keepalive) break
      } catch {
        allSent = false
        break
      }
    }
    return allSent
  })().finally(() => {
    flushPromise = null
  })
  return flushPromise
}

function ensureVisitor(storage = globalThis.localStorage) {
  const existing = safeRead(storage, VISITOR_KEY)
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
  const id = uuid()
  if (id) safeWrite(storage, VISITOR_KEY, id)
  return id
}

function ensureSession(storage = globalThis.sessionStorage) {
  try {
    const parsed = JSON.parse(safeRead(storage, SESSION_KEY) ?? 'null')
    if (parsed?.id && Array.isArray(parsed.milestones)) {
      parsed.sequence = Number.isInteger(parsed.sequence) ? Math.max(0, Math.min(MAX_SEQUENCE, parsed.sequence)) : 0
      parsed.startedAt = Number.isFinite(Number(parsed.startedAt)) ? Number(parsed.startedAt) : Date.now()
      parsed.visibleTotalMs = Number.isFinite(Number(parsed.visibleTotalMs)) ? Number(parsed.visibleTotalMs) : 0
      parsed.activity = parsed.activity && typeof parsed.activity === 'object' ? parsed.activity : null
      return parsed
    }
  } catch { /* start a new anonymous session */ }
  const now = Date.now()
  const state = { id: uuid(), sequence: 0, milestones: [], startedAt: now, visibleAt: now, visibleTotalMs: 0, activity: null }
  safeWrite(storage, SESSION_KEY, JSON.stringify(state))
  return state
}

function saveSession(state, storage = globalThis.sessionStorage) {
  safeWrite(storage, SESSION_KEY, JSON.stringify(state))
}

function updateSession(mutator, storage = globalThis.sessionStorage) {
  const session = ensureSession(storage)
  mutator(session)
  saveSession(session, storage)
  return session
}

function cleanStepId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,96}$/.test(value) ? value : null
}

function cleanAnalyticsId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value) ? value : null
}

function cleanChoice(value, choices) {
  return typeof value === 'string' && choices.includes(value) ? value : null
}

function cleanOrderNumber(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999 ? value : null
}

function cleanQueueAhead(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 12 ? value : null
}

function cleanActivityMs(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_ACTIVITY_MS, Math.max(0, Math.floor(value)))
    : null
}

function cleanWorldCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000
    ? value
    : null
}

/**
 * Chapter Two only permits small, enumerated analytics fields. This prevents
 * interaction copy, feedback text, or any arbitrary client object from being
 * written into the analytics payload.
 */
function cleanEventData(eventName, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  if (eventName === 'commercial_storefront_interacted') {
    const slotId = cleanAnalyticsId(value.slotId)
    const storeType = cleanChoice(value.storeType, ['果茶店', '服装店', '花店', '眼镜店', '美妆店', '书店', '甜品店', '鞋店', '潮玩店', '香氛店', '奶茶店', '周边店', '首饰店'])
    return slotId && storeType ? { slotId, storeType } : {}
  }
  if (eventName === 'milk_tea_order_confirmed') {
    const drink = cleanChoice(value.drink, ['原味奶茶', '黑糖珍珠奶茶', '芋泥奶茶', '茉莉奶绿'])
    const sugar = cleanChoice(value.sugar, ['少糖', '正常', '多糖'])
    const ice = cleanChoice(value.ice, ['少冰', '正常冰', '去冰'])
    const orderNumber = cleanOrderNumber(value.orderNumber)
    const queueAheadAtOrder = cleanQueueAhead(value.queueAheadAtOrder)
    return drink && sugar && ice && orderNumber !== null && queueAheadAtOrder !== null
      ? { drink, sugar, ice, orderNumber, queueAheadAtOrder }
      : {}
  }
  if (eventName === 'milk_tea_order_ready' || eventName === 'milk_tea_order_picked_up') {
    const orderNumber = cleanOrderNumber(value.orderNumber)
    return orderNumber === null ? {} : { orderNumber }
  }
  if (eventName === 'cafe_story_stage_reached') {
    const stage = cleanChoice(value.stage, ['meeting-started', 'mine-lead', 'yonghe-lead', 'ready-to-leave', 'complete'])
    return stage ? { stage } : {}
  }
  if (eventName === 'session_checkpoint') {
    const keys = ['elapsedMs', 'foregroundMs', 'engagedMs', 'idleMs', 'movementMs', 'readingMs', 'phoneMs']
    const entries = keys.map(key => [key, cleanActivityMs(value[key])])
    return Object.fromEntries(entries.filter(([, metric]) => metric !== null))
  }
  return {}
}

export function buildAnalyticsEvent(eventName, fields = {}, dependencies = {}) {
  if (!EVENTS.has(eventName)) return null
  const visitorId = dependencies.visitorId ?? ensureVisitor(dependencies.localStorage)
  const session = dependencies.session ?? ensureSession(dependencies.sessionStorage)
  const clientEventId = dependencies.clientEventId ?? uuid()
  if (!visitorId || !session?.id || !clientEventId) return null
  if ((session.sequence ?? 0) >= MAX_SEQUENCE) return null
  session.sequence = (session.sequence ?? 0) + 1
  saveSession(session, dependencies.sessionStorage)
  const ratio = Number(fields.progressRatio)
  const dwell = Number(fields.dwellMs)
  const positionX = eventName === 'center_position_sample' ? cleanWorldCoordinate(fields.positionX) : null
  const positionY = eventName === 'center_position_sample' ? cleanWorldCoordinate(fields.positionY) : null
  if (eventName === 'center_position_sample' && (positionX === null || positionY === null)) return null
  return {
    client_event_id: clientEventId,
    visitor_id: visitorId,
    session_id: session.id,
    sequence: session.sequence,
    occurred_at: new Date(dependencies.now?.() ?? Date.now()).toISOString(),
    event_name: eventName,
    step_id: cleanStepId(fields.stepId),
    language: LANGUAGES.has(fields.language) ? fields.language : null,
    reading_mode: MODES.has(fields.readingMode) ? fields.readingMode : null,
    progress_ratio: Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : null,
    dwell_ms: Number.isFinite(dwell) ? Math.min(86400000, Math.max(0, Math.round(dwell))) : null,
    exit_reason: EXIT_REASONS.has(fields.exitReason) ? fields.exitReason : null,
    scene_id: cleanAnalyticsId(fields.sceneId),
    object_id: cleanAnalyticsId(fields.objectId),
    object_kind: cleanAnalyticsId(fields.objectKind),
    destination_scene_id: cleanAnalyticsId(fields.destinationSceneId),
    device: PHONE_DEVICES.has(fields.device) ? fields.device : null,
    outcome: cleanAnalyticsId(fields.outcome),
    position_x: positionX,
    position_y: positionY,
    event_data: cleanEventData(eventName, fields.eventData),
  }
}

export function trackEvent(eventName, fields = {}, options = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false)
  const payload = buildAnalyticsEvent(eventName, fields, options.dependencies)
  if (!payload) return Promise.resolve(false)
  enqueuePendingEvent(payload, options.storage ?? globalThis.localStorage)
  if (options.deferred) {
    if (options.keepalive) return flushAnalyticsQueue({ keepalive: true, storage: options.storage ?? globalThis.localStorage })
    if (readPendingEvents(options.storage ?? globalThis.localStorage).length >= PENDING_BATCH_SIZE) {
      return flushAnalyticsQueue({ storage: options.storage ?? globalThis.localStorage })
    }
    return Promise.resolve(true)
  }
  return flushAnalyticsQueue({ keepalive: options.keepalive, storage: options.storage ?? globalThis.localStorage })
}

function ensureSessionActivityTracker() {
  if (sessionActivityTracker && !sessionActivityTracker.isDisposed()) return sessionActivityTracker
  const session = ensureSession()
  const now = Date.now()
  sessionActivityTracker = createSessionActivityTracker({
    startedAt: session.startedAt,
    // A document reload is not foreground activity. Keep all accumulated
    // totals, but begin a fresh accounting interval with feature states reset.
    lastAt: now,
    initialTotals: session.activity ?? {},
    onCheckpoint: (snapshot, { keepalive } = {}) => {
      persistAnalyticsSessionActivity(snapshot)
      trackEvent('session_checkpoint', {
        sceneId: snapshot.sceneId,
        eventData: {
          elapsedMs: snapshot.elapsedMs,
          foregroundMs: snapshot.foregroundMs,
          engagedMs: snapshot.engagedMs,
          idleMs: snapshot.idleMs,
          movementMs: snapshot.movementMs,
          readingMs: snapshot.readingMs,
          phoneMs: snapshot.phoneMs,
        },
      }, { deferred: true, keepalive: Boolean(keepalive) })
    },
    onReadingTransition: (reading, snapshot) => {
      trackEvent(reading ? 'center_reading_started' : 'center_reading_ended', {
        sceneId: snapshot.sceneId,
        outcome: reading ? 'started' : 'ended',
      })
    },
    onPhoneTransition: (open, snapshot) => {
      trackEvent(open ? 'center_phone_opened' : 'center_phone_closed', {
        sceneId: snapshot.sceneId,
        device: PHONE_DEVICES.has(analyticsPhoneDevice) ? analyticsPhoneDevice : null,
        outcome: open ? 'opened' : 'closed',
      })
    },
  })
  return sessionActivityTracker
}

/** Global user-input activity, shared by Landing, Reader, and Center. */
export function markSessionActivity(at = Date.now()) {
  return ensureSessionActivityTracker().markActivity(at)
}

/** Feature-specific counters are reported by their existing product owners. */
export function setCenterMovementActive(moving, at = Date.now()) {
  return ensureSessionActivityTracker().setMoving(moving, at)
}

export function setCenterReadingActive(reading, at = Date.now()) {
  return ensureSessionActivityTracker().setReading(reading, at)
}

export function setAnalyticsPhoneOpen(open, device = null, at = Date.now()) {
  if (device !== null) analyticsPhoneDevice = device
  return ensureSessionActivityTracker().setPhoneOpen(open, at)
}

export function setAnalyticsCurrentScene(sceneId, at = Date.now()) {
  return ensureSessionActivityTracker().setScene(sceneId, at)
}

export function checkpointSessionActivityIfDue(at = Date.now()) {
  return ensureSessionActivityTracker().checkpointIfDue(at)
}

export function getSessionActivitySnapshot(at = Date.now()) {
  return ensureSessionActivityTracker().snapshot(at)
}

export function getAnalyticsIdentity({ localStorage, sessionStorage } = {}) {
  const session = ensureSession(sessionStorage)
  return {
    visitorId: ensureVisitor(localStorage),
    sessionId: session?.id ?? null,
    startedAt: session?.startedAt ?? Date.now(),
    activity: session?.activity ?? null,
  }
}

export function persistAnalyticsSessionActivity(activity) {
  updateSession(session => {
    session.activity = {
      startedAt: Number.isFinite(activity?.startedAt) ? Math.max(0, Math.floor(activity.startedAt)) : session.startedAt,
      foregroundMs: cleanActivityMs(activity?.foregroundMs) ?? 0,
      idleMs: cleanActivityMs(activity?.idleMs) ?? 0,
      movementMs: cleanActivityMs(activity?.movementMs) ?? 0,
      readingMs: cleanActivityMs(activity?.readingMs) ?? 0,
      phoneMs: cleanActivityMs(activity?.phoneMs) ?? 0,
      elapsedMs: cleanActivityMs(activity?.elapsedMs) ?? 0,
      engagedMs: cleanActivityMs(activity?.engagedMs) ?? 0,
      lastMeaningfulActivityAt: Number.isFinite(activity?.lastMeaningfulActivityAt)
        ? Math.max(0, Math.floor(activity.lastMeaningfulActivityAt))
        : null,
      lastAccountedAt: Number.isFinite(activity?.lastAccountedAt)
        ? Math.max(0, Math.floor(activity.lastAccountedAt))
        : null,
      lastCheckpointAt: Number.isFinite(activity?.lastCheckpointAt)
        ? Math.max(0, Math.floor(activity.lastCheckpointAt))
        : 0,
    }
  })
}

export function registerAnalyticsLifecycleObserver(observer) {
  if (!observer || typeof observer !== 'object') return () => {}
  lifecycleObservers.add(observer)
  return () => lifecycleObservers.delete(observer)
}

function notifyLifecycleObservers(method, ...args) {
  for (const observer of lifecycleObservers) {
    try { observer[method]?.(...args) } catch { /* analytics observers never own gameplay */ }
  }
}

export function trackReaderProgress(stepId, progressRatio, context = {}) {
  markSessionActivity()
  const ratio = Math.min(1, Math.max(0, Number(progressRatio) || 0))
  trackEvent('beat_reached', { ...context, stepId, progressRatio: ratio })
  const session = ensureSession()
  const reached = MILESTONES.filter(value => ratio >= value && !session.milestones.includes(value))
  session.milestones.push(...reached)
  saveSession(session)
  reached.forEach(value => {
    trackEvent('progress_milestone', {
      ...context,
      stepId: `progress:${Math.round(value * 100)}`,
      progressRatio: value,
    })
  })
}

export function installDwellTracking({ trackInputActivity = true } = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  const initial = ensureSession()
  const tracker = ensureSessionActivityTracker()
  let visible = document.visibilityState !== 'hidden'
  let visibleAt = Date.now()
  let visibleTotalMs = Number(initial.visibleTotalMs) || 0

  if (visible) {
    updateSession(session => {
      session.visibleAt = visibleAt
      session.visibleTotalMs = visibleTotalMs
    })
  }

  const closeVisibleSegment = () => {
    if (!visible) return 0
    const now = Date.now()
    const segmentMs = Math.max(0, now - visibleAt)
    visibleTotalMs += segmentMs
    visible = false
    updateSession(session => {
      session.visibleAt = now
      session.visibleTotalMs = visibleTotalMs
    })
    return segmentMs
  }

  const visibility = () => {
    if (document.visibilityState === 'hidden') {
      tracker.setVisible(false, Date.now())
      notifyLifecycleObservers('onVisibilityChange', false, Date.now())
      const segmentMs = closeVisibleSegment()
      if (segmentMs > 0) trackEvent('visibility_dwell', { dwellMs: segmentMs, exitReason: 'hidden' }, { keepalive: true })
      return
    }
    if (!visible) {
      visible = true
      visibleAt = Date.now()
      tracker.setVisible(true, visibleAt)
      notifyLifecycleObservers('onVisibilityChange', true, visibleAt)
      updateSession(session => {
        session.visibleAt = visibleAt
        session.visibleTotalMs = visibleTotalMs
      })
    }
  }

  const pagehide = () => {
    tracker.checkpoint(Date.now(), { force: true, keepalive: true })
    notifyLifecycleObservers('onPagehide', Date.now())
    if (visible) closeVisibleSegment()
    trackEvent('session_end', { dwellMs: visibleTotalMs, exitReason: 'unload' }, { keepalive: true })
    flushAnalyticsQueue({ keepalive: true })
  }

  const online = () => {
    tracker.checkpointIfDue(Date.now())
    notifyLifecycleObservers('onOnline', Date.now())
    flushAnalyticsQueue()
  }
  const inputActivity = () => markSessionActivity()

  document.addEventListener('visibilitychange', visibility)
  if (trackInputActivity) {
    document.addEventListener('pointerdown', inputActivity, { passive: true })
    document.addEventListener('keydown', inputActivity, { passive: true })
  }
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('online', online)
  flushAnalyticsQueue()
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    if (trackInputActivity) {
      document.removeEventListener('pointerdown', inputActivity)
      document.removeEventListener('keydown', inputActivity)
    }
    window.removeEventListener('pagehide', pagehide)
    window.removeEventListener('online', online)
  }
}

export const ANALYTICS_STORAGE_KEYS = Object.freeze({
  visitor: VISITOR_KEY,
  session: SESSION_KEY,
  pending: PENDING_EVENTS_KEY,
})

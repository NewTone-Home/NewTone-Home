import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

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
  'center_door_crossed', 'center_phone_opened', 'center_ride_ready',
  'center_feedback_prompt_shown', 'center_feedback_opened', 'center_feedback_submitted',
])
const LANGUAGES = new Set(['zh', 'en'])
const MODES = new Set(['immersive', 'standard'])
const EXIT_REASONS = new Set(['return', 'landing', 'hidden', 'unload', 'completed', 'abandoned', 'browser_back'])
const PHONE_DEVICES = new Set(['surface', 'inner'])
const MILESTONES = [0.25, 0.5, 0.75, 1]
const PENDING_EVENTS_KEY = 'newtone-analytics-pending-v1'
const MAX_PENDING_EVENTS = 200
const PENDING_BATCH_SIZE = 25
const KEEPALIVE_BATCH_SIZE = 10
let flushPromise = null

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
  return safeWrite(storage, PENDING_EVENTS_KEY, JSON.stringify(events.slice(-MAX_PENDING_EVENTS)))
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
      parsed.visibleTotalMs = Number.isFinite(Number(parsed.visibleTotalMs)) ? Number(parsed.visibleTotalMs) : 0
      return parsed
    }
  } catch { /* start a new anonymous session */ }
  const now = Date.now()
  const state = { id: uuid(), sequence: 0, milestones: [], startedAt: now, visibleAt: now, visibleTotalMs: 0 }
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

export function buildAnalyticsEvent(eventName, fields = {}, dependencies = {}) {
  if (!EVENTS.has(eventName)) return null
  const visitorId = dependencies.visitorId ?? ensureVisitor(dependencies.localStorage)
  const session = dependencies.session ?? ensureSession(dependencies.sessionStorage)
  const clientEventId = dependencies.clientEventId ?? uuid()
  if (!visitorId || !session?.id || !clientEventId) return null
  session.sequence = Math.min((session.sequence ?? 0) + 1, 10000)
  saveSession(session, dependencies.sessionStorage)
  const ratio = Number(fields.progressRatio)
  const dwell = Number(fields.dwellMs)
  return {
    client_event_id: clientEventId,
    visitor_id: visitorId,
    session_id: session.id,
    sequence: session.sequence,
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
  }
}

export function trackEvent(eventName, fields = {}, options = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false)
  const payload = buildAnalyticsEvent(eventName, fields)
  if (!payload) return Promise.resolve(false)
  enqueuePendingEvent(payload)
  return flushAnalyticsQueue({ keepalive: options.keepalive })
}

export function getAnalyticsIdentity() {
  const session = ensureSession()
  return { visitorId: ensureVisitor(), sessionId: session?.id ?? null }
}

export function trackReaderProgress(stepId, progressRatio, context = {}) {
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

export function installDwellTracking() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  const initial = ensureSession()
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
      const segmentMs = closeVisibleSegment()
      if (segmentMs > 0) trackEvent('visibility_dwell', { dwellMs: segmentMs, exitReason: 'hidden' }, { keepalive: true })
      return
    }
    if (!visible) {
      visible = true
      visibleAt = Date.now()
      updateSession(session => {
        session.visibleAt = visibleAt
        session.visibleTotalMs = visibleTotalMs
      })
    }
  }

  const pagehide = () => {
    if (visible) closeVisibleSegment()
    trackEvent('session_end', { dwellMs: visibleTotalMs, exitReason: 'unload' }, { keepalive: true })
    flushAnalyticsQueue({ keepalive: true })
  }

  const online = () => flushAnalyticsQueue()

  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('online', online)
  flushAnalyticsQueue()
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', pagehide)
    window.removeEventListener('online', online)
  }
}

export const ANALYTICS_STORAGE_KEYS = Object.freeze({
  visitor: VISITOR_KEY,
  session: SESSION_KEY,
  pending: PENDING_EVENTS_KEY,
})

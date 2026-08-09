import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const VISITOR_KEY = 'newtone-analytics-visitor-v1'
const SESSION_KEY = 'newtone-analytics-session-v1'
const EVENTS = new Set([
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'admin_login', 'admin_draft_saved', 'admin_published',
])
const LANGUAGES = new Set(['zh', 'en'])
const MODES = new Set(['immersive', 'standard'])
const EXIT_REASONS = new Set(['return', 'landing', 'hidden', 'unload', 'completed', 'abandoned', 'browser_back'])
const MILESTONES = [0.25, 0.5, 0.75, 1]

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? null
}

function safeRead(storage, key) {
  try { return storage?.getItem(key) ?? null } catch { return null }
}

function safeWrite(storage, key, value) {
  try { storage?.setItem(key, value); return true } catch { return false }
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
  }
}

export function trackEvent(eventName, fields = {}, options = {}) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve(false)
  const payload = buildAnalyticsEvent(eventName, fields)
  if (!payload) return Promise.resolve(false)
  if (options.keepalive && typeof fetch === 'function') {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/analytics_events`
    return fetch(url, {
      method: 'POST', keepalive: true,
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).then(response => response.ok).catch(() => false)
  }
  return supabase.from('analytics_events').insert(payload)
    .then(({ error }) => !error).catch(() => false)
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
  }

  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', pagehide)
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', pagehide)
  }
}

export const ANALYTICS_STORAGE_KEYS = Object.freeze({ visitor: VISITOR_KEY, session: SESSION_KEY })

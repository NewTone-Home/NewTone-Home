import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

const VISITOR_KEY = 'newtone-analytics-visitor-v1'
const SESSION_KEY = 'newtone-analytics-session-v1'
const EVENTS = new Set([
  'landing_entry', 'language_selected', 'mode_selected', 'reading_started',
  'beat_reached', 'progress_milestone', 'reader_return', 'reader_exit',
  'visibility_dwell', 'session_end', 'admin_login', 'admin_draft_saved', 'admin_published',
])
const LANGUAGES = new Set(['zh', 'en'])
const MODES = new Set(['immersive', 'standard'])
const EXIT_REASONS = new Set(['return', 'landing', 'hidden', 'unload', 'completed', 'abandoned'])
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
    if (parsed?.id && Array.isArray(parsed.milestones)) return parsed
  } catch { /* start a new anonymous session */ }
  const state = { id: uuid(), sequence: 0, milestones: [], startedAt: Date.now(), visibleAt: Date.now() }
  safeWrite(storage, SESSION_KEY, JSON.stringify(state))
  return state
}

function saveSession(state, storage = globalThis.sessionStorage) {
  safeWrite(storage, SESSION_KEY, JSON.stringify(state))
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

export function trackReaderProgress(stepId, progressRatio) {
  const ratio = Math.min(1, Math.max(0, Number(progressRatio) || 0))
  trackEvent('beat_reached', { stepId, progressRatio: ratio })
  const session = ensureSession()
  const reached = MILESTONES.filter(value => ratio >= value && !session.milestones.includes(value))
  session.milestones.push(...reached)
  saveSession(session)
  reached.forEach(value => {
    trackEvent('progress_milestone', { stepId: `progress:${Math.round(value * 100)}`, progressRatio: value })
  })
}

export function installDwellTracking() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  const session = ensureSession()
  const emitDwell = (eventName, exitReason, keepalive = false) => {
    const now = Date.now()
    const dwellMs = Math.max(0, now - (session.visibleAt ?? session.startedAt ?? now))
    trackEvent(eventName, { dwellMs, exitReason }, { keepalive })
  }
  const visibility = () => {
    if (document.visibilityState === 'hidden') emitDwell('visibility_dwell', 'hidden', true)
    else { session.visibleAt = Date.now(); saveSession(session) }
  }
  const pagehide = () => emitDwell('session_end', 'unload', true)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', pagehide)
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', pagehide)
  }
}

export const ANALYTICS_STORAGE_KEYS = Object.freeze({ visitor: VISITOR_KEY, session: SESSION_KEY })

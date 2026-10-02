import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getAnalyticsIdentity, trackEvent } from './analytics'

const MAX_FREE_TEXT_LENGTH = 2000
const SOURCES = new Set(['phone'])

function cleanText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FREE_TEXT_LENGTH) : ''
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? null
}

export async function submitCenterFeedback({
  freeText = '',
  source = 'phone',
} = {}) {
  const text = cleanText(freeText)
  if (!SOURCES.has(source)) return { ok: false, reason: 'invalid-source' }
  if (!text) return { ok: false, reason: 'empty-feedback' }
  if (!isSupabaseConfigured || !supabase) return { ok: false, reason: 'configuration-missing' }

  const identity = getAnalyticsIdentity()
  const clientSubmissionId = uuid()
  if (!identity.visitorId || !identity.sessionId || !clientSubmissionId) return { ok: false, reason: 'identity-missing' }

  const { error } = await supabase.from('center_feedback_submissions').insert({
    client_submission_id: clientSubmissionId,
    visitor_id: identity.visitorId,
    session_id: identity.sessionId,
    source,
    free_text: text || null,
  })
  if (error) return { ok: false, reason: 'submission-failed' }

  trackEvent('center_feedback_submitted', { outcome: 'saved' })
  return { ok: true }
}

import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { getAnalyticsIdentity, trackEvent } from './analytics'

const COMPLETION_PROMPT_SHOWN_KEY = 'newtone-center-feedback-completion-shown-v1'
const COMPLETION_SUBMITTED_KEY = 'newtone-center-feedback-completion-submitted-v1'
const LEGACY_PROMPT_SHOWN_KEY = 'newtone-center-feedback-prompt-shown-v1'
const MAX_FREE_TEXT_LENGTH = 2000

const EXPERIENCE_LENGTH = new Set(['too-short', 'okay', 'cannot-understand'])
const PORTRAIT_ADAPTATION = new Set(['yes', 'no'])
const CONTINUATION_INTEREST = new Set(['yes', 'no-interest'])
const SOURCES = new Set(['completion-prompt', 'exit-prompt', 'phone'])

function safeRead(storage, key) {
  try { return storage?.getItem(key) ?? null } catch { return null }
}

function safeWrite(storage, key, value) {
  try { storage?.setItem(key, value); return true } catch { return false }
}

function safeRemove(storage, key) {
  try { storage?.removeItem(key); return true } catch { return false }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FREE_TEXT_LENGTH) : ''
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? null
}

export function hasShownCenterCompletionFeedbackPrompt(storage = globalThis.localStorage) {
  return safeRead(storage, COMPLETION_PROMPT_SHOWN_KEY) === '1'
}

export function markCenterCompletionFeedbackPromptShown(storage = globalThis.localStorage) {
  return safeWrite(storage, COMPLETION_PROMPT_SHOWN_KEY, '1')
}

export function clearCenterCompletionFeedbackPrompt(storage = globalThis.localStorage) {
  return safeRemove(storage, COMPLETION_PROMPT_SHOWN_KEY)
}

export function hasSubmittedCenterCompletionFeedback(storage = globalThis.localStorage) {
  return safeRead(storage, COMPLETION_SUBMITTED_KEY) === '1'
}

export function markCenterCompletionFeedbackSubmitted(storage = globalThis.localStorage) {
  return safeWrite(storage, COMPLETION_SUBMITTED_KEY, '1')
}

export function clearCenterCompletionFeedbackSubmitted(storage = globalThis.localStorage) {
  return safeRemove(storage, COMPLETION_SUBMITTED_KEY)
}

// Keep the previous storage/API names readable for old staging tools and
// historical clients. The current UI never emits exit-prompt.
export function hasShownCenterFeedbackPrompt(storage = globalThis.localStorage) {
  return safeRead(storage, LEGACY_PROMPT_SHOWN_KEY) === '1'
}

export function markCenterFeedbackPromptShown(storage = globalThis.localStorage) {
  return safeWrite(storage, LEGACY_PROMPT_SHOWN_KEY, '1')
}

export function clearCenterFeedbackPrompt(storage = globalThis.localStorage) {
  return safeRemove(storage, LEGACY_PROMPT_SHOWN_KEY)
}

export async function submitCenterFeedback({
  experienceLength = null,
  portraitAdaptation = null,
  continuationInterest = null,
  freeText = '',
  source = 'phone',
} = {}) {
  const text = cleanText(freeText)
  if (!SOURCES.has(source)) return { ok: false, reason: 'invalid-source' }
  if ((source === 'completion-prompt' || source === 'exit-prompt') && (
    !EXPERIENCE_LENGTH.has(experienceLength)
    || !PORTRAIT_ADAPTATION.has(portraitAdaptation)
    || !CONTINUATION_INTEREST.has(continuationInterest)
  )) return { ok: false, reason: 'incomplete-questionnaire' }
  if (source === 'phone' && !text) return { ok: false, reason: 'empty-feedback' }
  if (!isSupabaseConfigured || !supabase) return { ok: false, reason: 'configuration-missing' }

  const identity = getAnalyticsIdentity()
  const clientSubmissionId = uuid()
  if (!identity.visitorId || !identity.sessionId || !clientSubmissionId) return { ok: false, reason: 'identity-missing' }

  const { error } = await supabase.from('center_feedback_submissions').insert({
    client_submission_id: clientSubmissionId,
    visitor_id: identity.visitorId,
    session_id: identity.sessionId,
    source,
    experience_length: experienceLength,
    portrait_adaptation: portraitAdaptation,
    continuation_interest: continuationInterest,
    free_text: text || null,
  })
  if (error) return { ok: false, reason: 'submission-failed' }

  trackEvent('center_feedback_submitted', { outcome: 'saved' })
  return { ok: true }
}

export const CENTER_FEEDBACK_STORAGE_KEYS = Object.freeze({
  completionPromptShown: COMPLETION_PROMPT_SHOWN_KEY,
  completionSubmitted: COMPLETION_SUBMITTED_KEY,
})

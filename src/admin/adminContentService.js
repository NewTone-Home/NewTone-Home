import { supabase } from '../lib/supabaseClient'
import { PUBLICATION_SLUG } from '../services/publishedContent'
import { normalizeWorkspace as normalizeLegacyWorkspace } from './contentWorkspace'
import { normalizeWorkspace as normalizeSceneWorkspace } from './sceneWorkspace'

function normalizeDraftWorkspace(value) {
  return value?.schemaVersion === 2
    ? normalizeSceneWorkspace(value)
    : normalizeLegacyWorkspace(value)
}

export async function loadOwnerDraft(userId) {
  const { data, error } = await supabase.from('reader_drafts')
    .select('id, slug, workspace, base_publication_id, published_version, updated_at')
    .eq('slug', PUBLICATION_SLUG).eq('owner_id', userId).maybeSingle()
  if (error) throw error
  if (data) return { ...data, workspace: normalizeDraftWorkspace(data.workspace) }
  const { data: created, error: createError } = await supabase.from('reader_drafts')
    .insert({ slug: PUBLICATION_SLUG, owner_id: userId, workspace: normalizeLegacyWorkspace(null) })
    .select('id, slug, workspace, base_publication_id, published_version, updated_at').single()
  if (createError) {
    const denied = new Error('此账户不在 owner allow-list 中。')
    denied.cause = createError
    denied.code = 'OWNER_NOT_AUTHORIZED'
    throw denied
  }
  return { ...created, workspace: normalizeDraftWorkspace(created.workspace) }
}

export async function saveOwnerDraft(draftId, workspace) {
  const { data, error } = await supabase.from('reader_drafts')
    .update({ workspace: normalizeDraftWorkspace(workspace), updated_at: new Date().toISOString() })
    .eq('id', draftId).select('id, workspace, updated_at').single()
  if (error) throw error
  return data
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function publishOwnerDraft(draftId, content) {
  const { data, error } = await supabase.from('reader_drafts').update({
    publish_content: content,
    publish_sha256: await sha256(content),
    updated_at: new Date().toISOString(),
  }).eq('id', draftId).select('base_publication_id, published_version, updated_at').single()
  if (error) throw error
  return data
}

import { historyEnabled } from '../services/playerHistory.js'
import { supabase } from '../lib/supabaseClient'

export async function loadCenterAnalytics() {
  if (!supabase) throw new Error('Supabase 环境变量尚未配置。')
  const { data, error } = await supabase.rpc('owner_center_analytics')
  if (error) throw error
  return data
}

// Separate from legacy all-time Reader/taxi reports. RLS remains owner-only.
export async function loadReleaseAnalytics({ environment = 'production', from, to } = {}) {
  if (!supabase) throw new Error('Supabase unavailable')
  const { data, error } = await supabase.rpc('owner_release_analytics', {
    p_release: '0.3.0', p_environment: environment,
    p_from: from ?? new Date(Date.now() - 7 * 86400000).toISOString(),
    p_to: to ?? new Date().toISOString(),
  })
  if (error) throw error
  return data
}

export async function loadPlayerHistory({ from, to, environment = 'production', visitorId = null, cursor = null, search = '', internal = 'all' }) {
  if (!supabase) throw new Error('Supabase unavailable')
  const { data, error } = await supabase.rpc(historyEnabled() ? 'owner_player_history_v2' : 'owner_player_history', {
    ...(historyEnabled()?{p_search:search,p_internal:internal}:{}),
    p_release: '0.3.0', p_environment: environment, p_from: from, p_to: to,
    p_visitor: visitorId || null, p_before_time: cursor?.at ?? null, p_before_id: cursor?.id ?? null,
  })
  if (error) throw error
  return data
}

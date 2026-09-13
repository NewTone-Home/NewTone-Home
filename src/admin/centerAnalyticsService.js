import { supabase } from '../lib/supabaseClient'

export async function loadCenterAnalytics() {
  if (!supabase) throw new Error('Supabase 环境变量尚未配置。')
  const { data, error } = await supabase.rpc('owner_center_analytics')
  if (error) throw error
  return data
}

import { materializePublishedContent } from './publicationContent'
import { setReaderContent } from '../data/readerContent'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
export const PUBLICATION_SLUG = 'main-reader'
let requestSequence = 0
/** Optional catalogue acquisition cannot indefinitely strand Center entry. */
export async function loadPublishedContent({ activate = true } = {}) {
  if (!isSupabaseConfigured) return { status: 'configuration-missing' }
  const sequence = ++requestSequence
  let timer
  const fetched = Promise.resolve().then(async () => {
    const { data, error } = await supabase.from('reader_publications')
      .select('id, slug, version, content, published_at')
      .eq('slug', PUBLICATION_SLUG).eq('status', 'published').maybeSingle()
    if (error) return { status: 'error', error }
    if (!data) return { status: 'empty' }
    return materializePublishedContent(data, { activate: false })
  }).catch(error => ({ status: 'error', error }))
  try {
    const result = await Promise.race([fetched, new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'timeout' }), 3000) })])
    if (sequence !== requestSequence) return { status: 'superseded' }
    if (result.status === 'ready' && activate) setReaderContent(result.content)
    return result
  } catch (error) { return { status: 'invalid', error } } finally { clearTimeout(timer) }
}

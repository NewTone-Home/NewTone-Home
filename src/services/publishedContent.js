import { collapseReaderPagesByChapter, setReaderContent } from '../data/readerContent'
import { compileScenePublicationToReader } from '../data/scenePublication'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

export const PUBLICATION_SLUG = 'main-reader'

export async function loadPublishedContent() {
  if (!isSupabaseConfigured) return { status: 'configuration-missing' }
  const { data, error } = await supabase
    .from('reader_publications')
    .select('id, slug, version, content, published_at')
    .eq('slug', PUBLICATION_SLUG)
    .eq('status', 'published')
    .maybeSingle()

  if (error) return { status: 'error', error }
  if (!data) return { status: 'empty' }
  try {
    const readerContent = Array.isArray(data.content)
      ? collapseReaderPagesByChapter(data.content)
      : compileScenePublicationToReader(data.content)
    setReaderContent(readerContent)
    return { status: 'ready', publication: data }
  } catch (error) {
    return { status: 'invalid', error }
  }
}

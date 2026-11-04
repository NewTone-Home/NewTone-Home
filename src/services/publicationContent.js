import { collapseReaderPagesByChapter, setReaderContent } from '../data/readerContent'
import { compileScenePublicationToReader, expandSceneReaderFocusUnits } from '../data/scenePublication'
// Shared by the real read-only fetcher and the explicitly selected offline QA loader.
export function materializePublishedContent(data, { activate = true } = {}) {
  try {
    const content=Array.isArray(data.content)
      ?collapseReaderPagesByChapter(data.content)
      :expandSceneReaderFocusUnits(compileScenePublicationToReader(data.content))
    if (activate) setReaderContent(content)
    return {status:'ready',publication:data,content}
  } catch(error) { return {status:'invalid',error} }
}

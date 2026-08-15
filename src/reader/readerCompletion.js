import { readerContent } from '../data/readerContent'
import { READER_STEP_ACTIONS } from './readerAdvance'
import { createReaderIndex, resolvePosition } from './readerPosition'

export function isReaderFinalLocation(location, content = readerContent) {
  const index = createReaderIndex(content, { allowEmpty: true })
  if (index.entries.length === 0) return false
  const resolved = resolvePosition(location, content)
  return resolved.linearIndex === index.entries.length - 1
}

export function canCompleteReader({ location, action, readerCompleted, content = readerContent }) {
  return readerCompleted !== true
    && action?.type === READER_STEP_ACTIONS.CHAPTER_END
    && isReaderFinalLocation(location, content)
}

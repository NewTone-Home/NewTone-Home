import { readerContentIndex, resolvePosition } from './readerPosition'

export function isReaderFinalLocation(location) {
  const resolved = resolvePosition(location)
  return resolved.linearIndex === readerContentIndex.entries.length - 1
}

export function canCompleteReader({ location, forwardExit, readerCompleted }) {
  return readerCompleted !== true
    && forwardExit?.action === 'complete-reader'
    && isReaderFinalLocation(location)
}

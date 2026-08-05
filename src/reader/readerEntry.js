export function hasStableReaderProgress(state) {
  return state?.readerStarted === true
    || state?.readerCompleted === true
}

export function getReaderEntryIntent(state) {
  return hasStableReaderProgress(state) ? 'continue' : 'start'
}

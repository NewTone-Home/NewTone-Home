import { useEffect, useState } from 'react'

/**
 * Rebuild reading measurements once when fonts that were still loading at the
 * start of a reading session finish. There is no polling; the listener is
 * removed after the first completion event and when the session ends.
 */
export function subscribeToMainlineReadingFontCompletion(
  sessionActive: boolean,
  onComplete: () => void,
  fontSet: FontFaceSet | null = typeof document === 'undefined' ? null : document.fonts,
  observedStatus: FontFaceSetLoadStatus = fontSet?.status ?? 'loaded',
) {
  if (!sessionActive || !fontSet || observedStatus !== 'loading') return () => undefined

  // The font may finish between render and this effect attaching its listener.
  // Compare against the status observed during render and consume that race
  // exactly once instead of waiting for a second event that will never arrive.
  if (fontSet.status !== 'loading') {
    onComplete()
    return () => undefined
  }

  let completed = false
  const finish = () => {
    if (completed) return
    completed = true
    fontSet.removeEventListener('loadingdone', finish)
    onComplete()
  }
  fontSet.addEventListener('loadingdone', finish)
  // `ready` covers a font completion that races effect subscription; the
  // one-shot guard prevents the event and promise from causing two rebuilds.
  void fontSet.ready.then(finish)

  return () => {
    completed = true
    fontSet.removeEventListener('loadingdone', finish)
  }
}

export function useMainlineReadingFontRevision(sessionKey: string | null) {
  const [revision, setRevision] = useState(0)
  const status = typeof document === 'undefined' ? 'server' : document.fonts?.status ?? 'unknown'
  useEffect(() => subscribeToMainlineReadingFontCompletion(Boolean(sessionKey), () => setRevision(value => value + 1), typeof document === 'undefined' ? null : document.fonts, status === 'loading' ? 'loading' : 'loaded'), [sessionKey])
  return `${status}:${revision}`
}

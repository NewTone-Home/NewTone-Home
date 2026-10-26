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
) {
  if (!sessionActive || !fontSet || fontSet.status !== 'loading') return () => undefined

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
  useEffect(() => subscribeToMainlineReadingFontCompletion(Boolean(sessionKey), () => setRevision(value => value + 1)), [sessionKey])
  const status = typeof document === 'undefined' ? 'server' : document.fonts?.status ?? 'unknown'
  return `${status}:${revision}`
}

import { useLayoutEffect, useRef } from 'react'
import { createReaderRestoreCoordinator } from '../reader/readerRestore'

export function useReaderRestore({
  rootRef,
  focusRef,
  clearResumeRequest,
  onReaderReady,
}) {
  const coordinatorRef = useRef(null)
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createReaderRestoreCoordinator()
    coordinatorRef.current.markLocationRestored()
  }

  useLayoutEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled || !rootRef.current || !focusRef.current) return

      rootRef.current.getBoundingClientRect()
      coordinatorRef.current.markViewportMeasured()
      focusRef.current.focus({ preventScroll: true })
      coordinatorRef.current.markFocusPositioned()

      if (coordinatorRef.current.commitReady()) {
        clearResumeRequest()
        onReaderReady?.()
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [clearResumeRequest, focusRef, onReaderReady, rootRef])
}

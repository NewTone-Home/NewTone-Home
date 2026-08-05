import { useCallback, useRef, useState } from 'react'
import {
  beginReaderNavigation,
  createReaderNavigationState,
  finishReaderNavigation,
  retargetReaderNavigation,
  syncReaderNavigation,
  targetReaderNavigation,
} from '../reader/readerNavigation'

export function useReaderNavigation({ initialLocation, reducedMotion, commitLocation, content }) {
  const [navigation, setNavigation] = useState(() => createReaderNavigationState(initialLocation, content))
  const navigationRef = useRef(navigation)

  const navigate = useCallback((intent) => {
    const next = beginReaderNavigation(navigationRef.current, intent, { reducedMotion, content })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return !reducedMotion
  }, [commitLocation, content, reducedMotion])

  const navigateSteps = useCallback((steps) => {
    const next = retargetReaderNavigation(navigationRef.current, steps, { reducedMotion, content })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return true
  }, [commitLocation, content, reducedMotion])

  const navigateTo = useCallback((location) => {
    const next = targetReaderNavigation(navigationRef.current, location, { reducedMotion, content })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return true
  }, [commitLocation, content, reducedMotion])

  const syncTo = useCallback((location) => {
    const next = syncReaderNavigation(navigationRef.current, location, content)
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return true
  }, [commitLocation, content])

  const finishTransition = useCallback(() => {
    const current = navigationRef.current
    const next = finishReaderNavigation(current)
    if (next === current) return
    navigationRef.current = next
    commitLocation(next.committedLocation)
    setNavigation(next)
  }, [commitLocation])

  return {
    ...navigation,
    navigate,
    navigateSteps,
    navigateTo,
    syncTo,
    finishTransition,
  }
}

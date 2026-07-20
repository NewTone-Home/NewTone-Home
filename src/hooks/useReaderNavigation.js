import { useCallback, useRef, useState } from 'react'
import {
  beginReaderNavigation,
  createReaderNavigationState,
  finishReaderNavigation,
  retargetReaderNavigation,
  targetReaderNavigation,
} from '../reader/readerNavigation'

export function useReaderNavigation({ initialLocation, reducedMotion, commitLocation }) {
  const [navigation, setNavigation] = useState(() => createReaderNavigationState(initialLocation))
  const navigationRef = useRef(navigation)

  const navigate = useCallback((intent) => {
    const next = beginReaderNavigation(navigationRef.current, intent, { reducedMotion })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return !reducedMotion
  }, [commitLocation, reducedMotion])

  const navigateSteps = useCallback((steps) => {
    const next = retargetReaderNavigation(navigationRef.current, steps, { reducedMotion })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return true
  }, [commitLocation, reducedMotion])

  const navigateTo = useCallback((location) => {
    const next = targetReaderNavigation(navigationRef.current, location, { reducedMotion })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    commitLocation(next.displayLocation)
    return true
  }, [commitLocation, reducedMotion])

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
    finishTransition,
  }
}

import { useCallback, useRef, useState } from 'react'
import {
  beginReaderNavigation,
  createReaderNavigationState,
  finishReaderNavigation,
} from '../reader/readerNavigation'

export function useReaderNavigation({ initialLocation, reducedMotion, commitLocation }) {
  const [navigation, setNavigation] = useState(() => createReaderNavigationState(initialLocation))
  const navigationRef = useRef(navigation)

  const navigate = useCallback((intent) => {
    const next = beginReaderNavigation(navigationRef.current, intent, { reducedMotion })
    if (next === navigationRef.current) return false
    navigationRef.current = next
    setNavigation(next)
    if (reducedMotion) commitLocation(next.committedLocation)
    return !reducedMotion
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
    animationLocked: navigation.transitionTarget !== null,
    navigate,
    finishTransition,
  }
}

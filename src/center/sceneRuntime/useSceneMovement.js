import { useCallback, useEffect, useRef, useState } from 'react'

export function getMovementDuration(from, to) {
  const distance = Math.hypot((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0))
  return Math.round(Math.min(520, Math.max(180, 150 + distance * 4.2)))
}

export function useSceneMovement(initialPosition) {
  const [position, setPosition] = useState(initialPosition)
  const [movement, setMovement] = useState(null)
  const timeoutRef = useRef(null)

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
  }, [])

  const moveTo = useCallback((target, onArrive) => {
    if (!target || movement) return { accepted: false, duration: 0 }

    const duration = getMovementDuration(position, target)
    setMovement({ target, duration })
    setPosition(target)
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      setMovement(null)
      onArrive?.()
    }, duration)
    return { accepted: true, duration }
  }, [movement, position])

  return {
    position,
    movement,
    isMoving: Boolean(movement),
    moveTo,
  }
}

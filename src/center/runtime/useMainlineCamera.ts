import { useEffect, useRef, useState } from 'react'
import { advanceMainlineCamera, mainlineCameraFollowAxes, mainlineCameraOffset, mainlineCameraTarget, type MainlineViewportProjection } from './mainlineViewport'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'

export function useMainlineCamera(scene: MainlineSceneDefinition, position: Point, embedded: boolean, projection: MainlineViewportProjection) {
  const [offset, setOffset] = useState(() => mainlineCameraOffset(scene, position, embedded, projection))
  const current = useRef(offset)
  const responsiveFixedFrame = !embedded && scene.viewport === 'fixed-frame'
    && Object.values(mainlineCameraFollowAxes(scene, projection)).some(Boolean)
  useEffect(() => {
    if (responsiveFixedFrame) return
    if (embedded || scene.viewport === 'fixed-frame') {
      const next = mainlineCameraOffset(scene, position, embedded, projection)
      if (next.x !== current.current.x || next.y !== current.current.y) {
        current.current = next
        setOffset(next)
      }
      return
    }
    let frame = 0
    let previous = performance.now()
    const follow = (now: number) => {
      const target = mainlineCameraTarget(scene, position, current.current, embedded, projection)
      const remaining = Math.hypot(target.x - current.current.x, target.y - current.current.y)
      if (remaining < .005) return
      current.current = advanceMainlineCamera(current.current, target, now - previous)
      previous = now
      setOffset(current.current)
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [embedded, position.x, position.y, projection, responsiveFixedFrame, scene])
  return responsiveFixedFrame ? mainlineCameraOffset(scene, position, embedded, projection) : offset
}

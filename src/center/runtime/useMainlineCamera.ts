import { useEffect, useRef, useState } from 'react'
import { advanceMainlineCamera, mainlineCameraOffset, mainlineCameraTarget } from './mainlineViewport'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'

export function useMainlineCamera(scene: MainlineSceneDefinition, position: Point, embedded: boolean, regionAnchor?: Point) {
  const cameraPosition = regionAnchor ?? position
  const [offset, setOffset] = useState(() => mainlineCameraOffset(scene, cameraPosition, embedded))
  const current = useRef(offset)
  useEffect(() => {
    if (embedded || scene.viewport === 'fixed-frame') {
      current.current = mainlineCameraOffset(scene, cameraPosition, embedded)
      setOffset(current.current)
      return
    }
    let frame = 0
    let previous = performance.now()
    const follow = (now: number) => {
      const target = mainlineCameraTarget(scene, cameraPosition, current.current, embedded)
      const remaining = Math.hypot(target.x - current.current.x, target.y - current.current.y)
      if (remaining < .005) return
      current.current = advanceMainlineCamera(current.current, target, now - previous)
      previous = now
      setOffset(current.current)
      frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [cameraPosition.x, cameraPosition.y, embedded, scene])
  return offset
}

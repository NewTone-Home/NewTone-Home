import { useEffect, useRef, useState } from 'react'
import { advanceMainlineCamera, mainlineCameraOffset, mainlineCameraTarget, mainlineWorldScale } from './mainlineViewport'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { commercialStreetCameraPages, commercialStreetPageIndex, usesCommercialStreetPages } from './commercialStreetCamera'

export function useMainlineCamera(
  scene: MainlineSceneDefinition,
  position: Point,
  embedded: boolean,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
) {
  const [offset, setOffset] = useState(() => {
    if (!embedded && usesCommercialStreetPages(scene, position)) {
      const pages = commercialStreetCameraPages(scene, screenMetrics, scene.id === 'yonghe-mining-perimeter' ? position.y : undefined)
      const index = commercialStreetPageIndex(pages.centers, position.x, pages.span)
      return { x: 50 - pages.centers[index]!, y: pages.yOffset }
    }
    return mainlineCameraOffset(scene, position, embedded, screenMetrics)
  })
  const current = useRef(offset)
  const streetPage = useRef<{ key: string; index: number } | null>(null)
  useEffect(() => {
    let pageTarget: Point | undefined
    const useStreetPages = !embedded && usesCommercialStreetPages(scene, position)
    if (useStreetPages) {
      const pages = commercialStreetCameraPages(scene, screenMetrics, scene.id === 'yonghe-mining-perimeter' ? position.y : undefined)
      const key = `${scene.id}:${screenMetrics.width}:${screenMetrics.height}:${mainlineWorldScale(screenMetrics)}`
      const index = commercialStreetPageIndex(pages.centers, position.x, pages.span,
        streetPage.current?.key === key ? streetPage.current.index : undefined)
      streetPage.current = { key, index }
      pageTarget = { x: 50 - pages.centers[index]!, y: pages.yOffset }
    } else streetPage.current = null
    if (embedded || scene.viewport === 'fixed-frame') {
      current.current = mainlineCameraOffset(scene, position, embedded, screenMetrics)
      setOffset(current.current)
      return
    }
    let frame = 0
    let previous = performance.now()
    const follow = (now: number) => {
      const target = pageTarget ?? mainlineCameraTarget(scene, position, current.current, embedded, screenMetrics)
      const remaining = Math.hypot(target.x - current.current.x, target.y - current.current.y)
      if (remaining < .005) return
      current.current = advanceMainlineCamera(current.current, target, now - previous)
      previous = now
      const remainingAfterStep = Math.hypot(target.x - current.current.x, target.y - current.current.y)
      setOffset(current.current)
      if (remainingAfterStep >= .005) frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(frame)
  }, [embedded, position.x, position.y, scene, screenMetrics])
  return offset
}

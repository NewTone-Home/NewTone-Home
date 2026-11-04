import { useEffect, useRef, useState } from 'react'
import { advanceMainlineCamera, mainlineCameraOffset, mainlineCameraTarget, mainlineWorldScale } from './mainlineViewport'
import type { MainlineSceneDefinition } from './mainlineScenes'
import type { Point } from './sceneGeometry'
import { defaultSceneScreenMetrics, type SceneScreenMetrics } from './sceneBoundaryGrid'
import { commercialStreetCameraPages, commercialStreetPageIndex, usesCommercialStreetPages } from './commercialStreetCamera'

/** One door crossing (zoom + horizontal + vertical camera) takes this long. The indoor zoom tween uses the same value so both land together. */
export const mainlineCameraGlideMs = 550

export function useMainlineCamera(
  scene: MainlineSceneDefinition,
  position: Point,
  embedded: boolean,
  screenMetrics: SceneScreenMetrics = defaultSceneScreenMetrics,
  glideKey: unknown = null,
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
  // Going through a door switches between street pages and follow, and the zoom changes with it. All of that moves as ONE eased glide
  // from wherever the camera is now, instead of zoom first and a fast lurch to the new target afterwards.
  const glide = useRef<{ from: Point; startedAt: number } | null>(null)
  const lastMode = useRef<{ pages: boolean; glideKey: unknown; sceneId: string } | null>(null)
  useEffect(() => {
    let pageTarget: Point | undefined
    const useStreetPages = !embedded && usesCommercialStreetPages(scene, position)
    if (useStreetPages) {
      const pages = commercialStreetCameraPages(scene, screenMetrics, scene.id === 'yonghe-mining-perimeter' ? position.y : undefined)
      // The zoom level is deliberately not part of the key: it changes while a door glide runs and must not reset the remembered page.
      const key = `${scene.id}:${screenMetrics.width}:${screenMetrics.height}`
      const index = commercialStreetPageIndex(pages.centers, position.x, pages.span,
        streetPage.current?.key === key ? streetPage.current.index : undefined)
      streetPage.current = { key, index }
      pageTarget = { x: 50 - pages.centers[index]!, y: pages.yOffset }
    }
    // The remembered street page survives a visit indoors, so coming back out returns to the page you left.
    const previousMode = lastMode.current
    lastMode.current = { pages: useStreetPages, glideKey, sceneId: scene.id }
    if (previousMode && previousMode.sceneId === scene.id && (previousMode.pages !== useStreetPages || previousMode.glideKey !== glideKey) && !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) {
      glide.current = { from: { ...current.current }, startedAt: performance.now() }
    }
    if (embedded || scene.viewport === 'fixed-frame') {
      current.current = mainlineCameraOffset(scene, position, embedded, screenMetrics)
      setOffset(current.current)
      return
    }
    let frame = 0
    let previous = performance.now()
    const follow = (now: number) => {
      const target = pageTarget ?? mainlineCameraTarget(scene, position, current.current, embedded, screenMetrics)
      const moving = glide.current
      if (moving) {
        const progress = Math.min(1, (now - moving.startedAt) / mainlineCameraGlideMs)
        const eased = progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2
        current.current = { x: moving.from.x + (target.x - moving.from.x) * eased, y: moving.from.y + (target.y - moving.from.y) * eased }
        previous = now
        setOffset(current.current)
        if (progress < 1) { frame = requestAnimationFrame(follow); return }
        glide.current = null
      }
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
  }, [embedded, glideKey, position.x, position.y, scene, screenMetrics])
  return offset
}

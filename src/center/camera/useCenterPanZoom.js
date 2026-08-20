import { useCallback, useEffect, useRef } from 'react'
import Panzoom from '@panzoom/panzoom'

const MOVE_EPSILON = 3

function getDetailLevel(scale) {
  if (scale < .96) return 'overview'
  if (scale >= 1.72) return 'detail'
  return 'standard'
}

export function useCenterPanZoom({ canvasRef, sceneRef, rootRef, onCameraFrame }) {
  const panzoomRef = useRef(null)
  const cameraFrameRef = useRef(onCameraFrame)
  const gestureRef = useRef({ start: null, moved: false, suppressUntil: 0 })
  cameraFrameRef.current = onCameraFrame

  useEffect(() => {
    const canvas = canvasRef.current
    const scene = sceneRef.current
    const root = rootRef.current
    if (!canvas || !scene || !root) return undefined

    const panzoom = Panzoom(scene, {
      canvas: true,
      cursor: 'grab',
      maxScale: 3.4,
      minScale: 0.72,
      pinchAndPan: true,
      startScale: 1,
      step: 0.12,
      touchAction: 'none',
      handleStartEvent(event) {
        event.preventDefault()
      },
    })
    panzoomRef.current = panzoom
    scene.dataset.detailLevel = getDetailLevel(1)

    let frame = 0
    const requestCameraFrame = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        cameraFrameRef.current?.()
      })
    }

    const handleWheel = event => {
      event.preventDefault()
      panzoom.zoomWithWheel(event)
    }

    const handleStart = event => {
      const detail = event.detail || {}
      gestureRef.current.start = { x: detail.x || 0, y: detail.y || 0, scale: detail.scale || 1 }
      gestureRef.current.moved = false
      root.dataset.cameraMoving = 'true'
    }

    const handleChange = event => {
      const start = gestureRef.current.start
      const detail = event.detail || {}
      const detailLevel = getDetailLevel(detail.scale || 1)
      if (scene.dataset.detailLevel !== detailLevel) scene.dataset.detailLevel = detailLevel
      if (start) {
        const distance = Math.hypot((detail.x || 0) - start.x, (detail.y || 0) - start.y)
        const scaleDistance = Math.abs((detail.scale || 1) - start.scale) * 100
        if (distance > MOVE_EPSILON || scaleDistance > MOVE_EPSILON) gestureRef.current.moved = true
      }
      requestCameraFrame()
    }

    const handleEnd = () => {
      root.dataset.cameraMoving = 'false'
      if (gestureRef.current.moved) gestureRef.current.suppressUntil = performance.now() + 140
      gestureRef.current.start = null
      requestCameraFrame()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    scene.addEventListener('panzoomstart', handleStart)
    scene.addEventListener('panzoomchange', handleChange)
    scene.addEventListener('panzoomend', handleEnd)

    const initialFrame = window.requestAnimationFrame(requestCameraFrame)
    return () => {
      window.cancelAnimationFrame(initialFrame)
      window.cancelAnimationFrame(frame)
      canvas.removeEventListener('wheel', handleWheel)
      scene.removeEventListener('panzoomstart', handleStart)
      scene.removeEventListener('panzoomchange', handleChange)
      scene.removeEventListener('panzoomend', handleEnd)
      panzoom.destroy()
      panzoomRef.current = null
    }
  }, [canvasRef, rootRef, sceneRef])

  const zoomIn = useCallback(() => panzoomRef.current?.zoomIn({ animate: true }), [])
  const zoomOut = useCallback(() => panzoomRef.current?.zoomOut({ animate: true }), [])
  const reset = useCallback(() => panzoomRef.current?.reset({ animate: true }), [])
  const shouldSuppressClick = useCallback(() => performance.now() < gestureRef.current.suppressUntil, [])

  return { zoomIn, zoomOut, reset, shouldSuppressClick }
}

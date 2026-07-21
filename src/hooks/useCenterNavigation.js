import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CENTER_ROOT_ID, getCenterChildren, getCenterNode } from '../data/center/centerWorld'

const HOVER_FOCUS_MS = 760
const MOVE_TOLERANCE_PX = 9
const MOVE_COOLDOWN_MS = 220
const ANNOTATION_FADE_MS = 220
const DETAIL_FADE_MS = 240
const WHEEL_THRESHOLD = 34
const EDGE_RATIO = 0.13
const MIN_ZOOM = 1
const MAX_ZOOM = 1.65
const ZOOM_STEP = 0.1
const ZOOM_NOTICE_MS = 900

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getPanBounds(viewport, zoom) {
  if (!viewport || zoom <= MIN_ZOOM) return { maxX: 0, maxY: 0 }

  const stage = viewport.querySelector('.center-world-stage')
  if (!stage) return { maxX: 0, maxY: 0 }

  const overflowScale = zoom - MIN_ZOOM

  return {
    maxX: stage.offsetWidth * overflowScale / 2,
    maxY: stage.offsetHeight * overflowScale / 2,
  }
}

function clampCamera(camera, bounds) {
  return {
    x: clamp(camera.x, -bounds.maxX, bounds.maxX),
    y: clamp(camera.y, -bounds.maxY, bounds.maxY),
  }
}

export function useCenterNavigation({ onExitTop, onExitBottom, onOpenContent } = {}) {
  const [currentNodeId, setCurrentNodeId] = useState(CENTER_ROOT_ID)
  const [focusedNodeId, setFocusedNodeId] = useState(null)
  const [annotationLeaving, setAnnotationLeaving] = useState(false)
  const [hoveringNodeId, setHoveringNodeId] = useState(null)
  const [hoverProgress, setHoverProgress] = useState(0)
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false })
  const [edgeIntent, setEdgeIntent] = useState(null)
  const [detailNodeId, setDetailNodeId] = useState(null)
  const [detailClosing, setDetailClosing] = useState(false)
  const [selectedContentId, setSelectedContentId] = useState(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [zoomNoticeVisible, setZoomNoticeVisible] = useState(false)

  const historyRef = useRef([])
  const hoverFrameRef = useRef(0)
  const resumeTimerRef = useRef(0)
  const annotationTimerRef = useRef(0)
  const detailTimerRef = useRef(0)
  const zoomNoticeTimerRef = useRef(0)
  const hoverNodeRef = useRef(null)
  const lastMotionRef = useRef(null)
  const wheelAccumulatorRef = useRef(0)
  const dragRef = useRef(null)
  const touchRef = useRef(null)

  const currentNode = getCenterNode(currentNodeId)
  const children = useMemo(() => getCenterChildren(currentNodeId), [currentNodeId])
  const focusedNode = focusedNodeId ? getCenterNode(focusedNodeId) : null
  const detailNode = detailNodeId ? getCenterNode(detailNodeId) : null

  const showZoomNotice = useCallback(() => {
    window.clearTimeout(zoomNoticeTimerRef.current)
    setZoomNoticeVisible(true)
    zoomNoticeTimerRef.current = window.setTimeout(() => setZoomNoticeVisible(false), ZOOM_NOTICE_MS)
  }, [])

  const stopHoverProgress = useCallback(() => {
    cancelAnimationFrame(hoverFrameRef.current)
    hoverFrameRef.current = 0
    setHoveringNodeId(null)
    setHoverProgress(0)
  }, [])

  const beginProgress = useCallback((nodeId) => {
    stopHoverProgress()
    setHoveringNodeId(nodeId)
    const startedAt = performance.now()

    const animate = now => {
      const progress = Math.min(1, (now - startedAt) / HOVER_FOCUS_MS)
      setHoverProgress(progress)
      if (progress >= 1) {
        setFocusedNodeId(nodeId)
        setAnnotationLeaving(false)
        setHoveringNodeId(null)
        hoverFrameRef.current = 0
        return
      }
      hoverFrameRef.current = requestAnimationFrame(animate)
    }

    hoverFrameRef.current = requestAnimationFrame(animate)
  }, [stopHoverProgress])

  const scheduleResume = useCallback((nodeId) => {
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setCursor(previous => ({ ...previous, visible: false }))
    resumeTimerRef.current = window.setTimeout(() => {
      if (hoverNodeRef.current === nodeId && focusedNodeId !== nodeId) {
        setCursor(previous => ({ ...previous, visible: true }))
        beginProgress(nodeId)
      }
    }, MOVE_COOLDOWN_MS)
  }, [beginProgress, focusedNodeId, stopHoverProgress])

  const beginHover = useCallback((nodeId, event) => {
    window.clearTimeout(annotationTimerRef.current)
    window.clearTimeout(resumeTimerRef.current)
    hoverNodeRef.current = nodeId
    lastMotionRef.current = { x: event.clientX, y: event.clientY }
    setAnnotationLeaving(false)
    setCursor({ x: event.clientX, y: event.clientY + 16, visible: focusedNodeId !== nodeId })
    setEdgeIntent(null)
    if (focusedNodeId !== nodeId) beginProgress(nodeId)
  }, [beginProgress, focusedNodeId])

  const fadeFocusedAnnotation = useCallback(() => {
    if (!focusedNodeId || annotationLeaving) return
    window.clearTimeout(annotationTimerRef.current)
    setAnnotationLeaving(true)
    annotationTimerRef.current = window.setTimeout(() => {
      setFocusedNodeId(null)
      setAnnotationLeaving(false)
    }, ANNOTATION_FADE_MS)
  }, [annotationLeaving, focusedNodeId])

  const endHover = useCallback(() => {
    hoverNodeRef.current = null
    lastMotionRef.current = null
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setCursor(previous => ({ ...previous, visible: false }))
    fadeFocusedAnnotation()
  }, [fadeFocusedAnnotation, stopHoverProgress])

  const keepFocus = useCallback(() => {
    window.clearTimeout(annotationTimerRef.current)
    setAnnotationLeaving(false)
  }, [])

  const closeDetail = useCallback(() => {
    if (!detailNodeId || detailClosing) return
    setDetailClosing(true)
    window.clearTimeout(detailTimerRef.current)
    detailTimerRef.current = window.setTimeout(() => {
      setDetailNodeId(null)
      setDetailClosing(false)
      setSelectedContentId(null)
    }, DETAIL_FADE_MS)
  }, [detailClosing, detailNodeId])

  const cancelFocus = useCallback(() => {
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setCursor(previous => ({ ...previous, visible: false }))
    if (focusedNodeId) fadeFocusedAnnotation()
    if (detailNodeId) closeDetail()
  }, [closeDetail, detailNodeId, fadeFocusedAnnotation, focusedNodeId, stopHoverProgress])

  const openDetail = useCallback((nodeId) => {
    const node = getCenterNode(nodeId)
    window.clearTimeout(annotationTimerRef.current)
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setCursor(previous => ({ ...previous, visible: false }))
    setAnnotationLeaving(true)
    setDetailClosing(false)
    setDetailNodeId(nodeId)
    setEdgeIntent(null)
    setSelectedContentId(node.contentOptions?.find(option => !option.locked)?.id ?? null)
    annotationTimerRef.current = window.setTimeout(() => {
      setFocusedNodeId(null)
      setAnnotationLeaving(false)
    }, ANNOTATION_FADE_MS)
  }, [stopHoverProgress])

  const resetViewForLayer = useCallback(() => {
    setCamera({ x: 0, y: 0 })
    setZoom(1)
    setZoomNoticeVisible(false)
    wheelAccumulatorRef.current = 0
    dragRef.current = null
  }, [])

  const recenterCamera = resetViewForLayer

  const enterNode = useCallback((node) => {
    if (!node || node.type === 'locked') return false

    if (node.nodes.length > 0) {
      historyRef.current = [...historyRef.current, currentNodeId]
      setCurrentNodeId(node.id)
      setFocusedNodeId(null)
      setAnnotationLeaving(false)
      setDetailNodeId(null)
      setDetailClosing(false)
      setEdgeIntent(null)
      resetViewForLayer()
      return true
    }

    const firstContent = node.contentOptions?.find(option => !option.locked)
    if (firstContent) {
      onOpenContent?.(node, firstContent.id)
      return true
    }
    return false
  }, [currentNodeId, onOpenContent, resetViewForLayer])

  const goBack = useCallback(() => {
    if (detailNodeId) {
      closeDetail()
      return true
    }
    if (historyRef.current.length === 0) return false

    const previous = historyRef.current.at(-1)
    historyRef.current = historyRef.current.slice(0, -1)
    setCurrentNodeId(previous)
    setFocusedNodeId(null)
    setAnnotationLeaving(false)
    setEdgeIntent(null)
    resetViewForLayer()
    return true
  }, [closeDetail, detailNodeId, resetViewForLayer])

  const applyCenteredZoom = useCallback((event, zoomDirection) => {
    const nextZoom = clamp(Number((zoom + zoomDirection * ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM)
    if (nextZoom === zoom) return

    const bounds = getPanBounds(event.currentTarget, nextZoom)
    setCamera(previous => nextZoom === MIN_ZOOM
      ? { x: 0, y: 0 }
      : clampCamera(previous, bounds))
    setZoom(nextZoom)
    showZoomNotice()
  }, [showZoomNotice, zoom])

  const onWheel = useCallback((event) => {
    event.preventDefault()
    wheelAccumulatorRef.current += event.deltaY
    if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) return

    const direction = Math.sign(wheelAccumulatorRef.current)
    wheelAccumulatorRef.current = 0

    if (detailNode) {
      if (direction < 0) closeDetail()
      else if (selectedContentId) onOpenContent?.(detailNode, selectedContentId)
      return
    }

    if (!focusedNode && edgeIntent === 'top' && direction < 0) {
      onExitTop?.()
      return
    }
    if (!focusedNode && currentNodeId === CENTER_ROOT_ID && edgeIntent === 'bottom' && direction > 0) {
      onExitBottom?.()
      return
    }

    if (focusedNode) {
      if (direction > 0) enterNode(focusedNode)
      else fadeFocusedAnnotation()
      return
    }

    applyCenteredZoom(event, direction < 0 ? 1 : -1)
  }, [applyCenteredZoom, closeDetail, currentNodeId, detailNode, edgeIntent, enterNode, fadeFocusedAnnotation, focusedNode, onExitBottom, onExitTop, onOpenContent, selectedContentId])

  const onPointerMove = useCallback((event) => {
    const atRoot = currentNodeId === CENTER_ROOT_ID && !focusedNodeId && !detailNodeId
    if (atRoot && event.clientY <= window.innerHeight * EDGE_RATIO) setEdgeIntent('top')
    else if (atRoot && event.clientY >= window.innerHeight * (1 - EDGE_RATIO)) setEdgeIntent('bottom')
    else setEdgeIntent(null)

    setCursor({
      x: event.clientX,
      y: event.clientY + 16,
      visible: Boolean(hoverNodeRef.current) && hoveringNodeId !== null,
    })

    if (hoverNodeRef.current && event.pointerType === 'mouse' && !focusedNodeId) {
      const previous = lastMotionRef.current
      const moved = previous ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y) : 0
      if (moved > MOVE_TOLERANCE_PX) {
        lastMotionRef.current = { x: event.clientX, y: event.clientY }
        scheduleResume(hoverNodeRef.current)
      }
    }

    if (event.pointerType === 'touch' && touchRef.current) {
      if (zoom <= MIN_ZOOM) return

      const dx = event.clientX - touchRef.current.x
      const dy = event.clientY - touchRef.current.y
      const bounds = getPanBounds(event.currentTarget, zoom)
      setCamera(previous => clampCamera({ x: previous.x + dx, y: previous.y + dy }, bounds))
      touchRef.current.x = event.clientX
      touchRef.current.y = event.clientY
      touchRef.current.moved = true
    }
  }, [currentNodeId, detailNodeId, focusedNodeId, hoveringNodeId, scheduleResume, zoom])

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'touch') {
      touchRef.current = { x: event.clientX, y: event.clientY, moved: false }
      return
    }

    if (event.button !== 2 || zoom <= MIN_ZOOM) return
    const bounds = getPanBounds(event.currentTarget, zoom)
    if (bounds.maxX === 0 && bounds.maxY === 0) return

    event.preventDefault()
    dragRef.current = {
      viewport: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    }
  }, [camera, zoom])

  const onPointerUp = useCallback((event) => {
    if (event.pointerType === 'touch' && touchRef.current) {
      touchRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleWindowPointerMove = event => {
      const drag = dragRef.current
      if (!drag) return

      if ((event.buttons & 2) === 0) {
        dragRef.current = null
        return
      }

      const bounds = getPanBounds(drag.viewport, zoom)
      setCamera(clampCamera({
        x: drag.cameraX + event.clientX - drag.x,
        y: drag.cameraY + event.clientY - drag.y,
      }, bounds))
    }

    const stopWindowDrag = () => {
      dragRef.current = null
    }

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', stopWindowDrag)
    window.addEventListener('blur', stopWindowDrag)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', stopWindowDrag)
      window.removeEventListener('blur', stopWindowDrag)
    }
  }, [zoom])

  useEffect(() => () => {
    cancelAnimationFrame(hoverFrameRef.current)
    window.clearTimeout(resumeTimerRef.current)
    window.clearTimeout(annotationTimerRef.current)
    window.clearTimeout(detailTimerRef.current)
    window.clearTimeout(zoomNoticeTimerRef.current)
    dragRef.current = null
  }, [])

  return {
    currentNode,
    currentNodeId,
    children,
    focusedNode,
    annotationLeaving,
    detailNode,
    detailClosing,
    selectedContentId,
    hoveringNodeId,
    hoverProgress,
    cursor,
    edgeIntent,
    camera,
    zoom,
    zoomNoticeVisible,
    beginHover,
    endHover,
    keepFocus,
    cancelFocus,
    openDetail,
    closeDetail,
    recenterCamera,
    resetViewForLayer,
    setSelectedContentId,
    enterNode,
    goBack,
    onWheel,
    onPointerMove,
    onPointerDown,
    onPointerUp,
  }
}

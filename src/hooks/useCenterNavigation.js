import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CENTER_ROOT_ID, getCenterChildren, getCenterNode } from '../data/center/centerWorld'

const HOVER_FOCUS_MS = 760
const MOVE_TOLERANCE_PX = 9
const MOVE_COOLDOWN_MS = 220
const HOVER_CLEAR_GRACE_MS = 180
const WHEEL_THRESHOLD = 34
const EDGE_RATIO = 0.13

export function useCenterNavigation({ onExitTop, onExitBottom, onOpenContent } = {}) {
  const [currentNodeId, setCurrentNodeId] = useState(CENTER_ROOT_ID)
  const [focusedNodeId, setFocusedNodeId] = useState(null)
  const [hoveringNodeId, setHoveringNodeId] = useState(null)
  const [hoverProgress, setHoverProgress] = useState(0)
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false })
  const [edgeIntent, setEdgeIntent] = useState(null)
  const [detailNodeId, setDetailNodeId] = useState(null)
  const [selectedContentId, setSelectedContentId] = useState(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })

  const historyRef = useRef([])
  const hoverFrameRef = useRef(0)
  const resumeTimerRef = useRef(0)
  const clearTimerRef = useRef(0)
  const hoverNodeRef = useRef(null)
  const lastMotionRef = useRef(null)
  const wheelAccumulatorRef = useRef(0)
  const dragRef = useRef(null)
  const touchRef = useRef(null)

  const currentNode = getCenterNode(currentNodeId)
  const children = useMemo(() => getCenterChildren(currentNodeId), [currentNodeId])
  const focusedNode = focusedNodeId ? getCenterNode(focusedNodeId) : null
  const detailNode = detailNodeId ? getCenterNode(detailNodeId) : null

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
    window.clearTimeout(clearTimerRef.current)
    window.clearTimeout(resumeTimerRef.current)
    hoverNodeRef.current = nodeId
    lastMotionRef.current = { x: event.clientX, y: event.clientY }
    setCursor({ x: event.clientX, y: event.clientY, visible: true })
    setEdgeIntent(null)
    if (focusedNodeId !== nodeId) beginProgress(nodeId)
  }, [beginProgress, focusedNodeId])

  const endHover = useCallback(() => {
    hoverNodeRef.current = null
    lastMotionRef.current = null
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setCursor(previous => ({ ...previous, visible: false }))
    window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = window.setTimeout(() => {
      if (!detailNodeId) setFocusedNodeId(null)
    }, HOVER_CLEAR_GRACE_MS)
  }, [detailNodeId, stopHoverProgress])

  const keepFocus = useCallback(() => {
    window.clearTimeout(clearTimerRef.current)
  }, [])

  const cancelFocus = useCallback(() => {
    window.clearTimeout(clearTimerRef.current)
    window.clearTimeout(resumeTimerRef.current)
    stopHoverProgress()
    setFocusedNodeId(null)
    setDetailNodeId(null)
    setSelectedContentId(null)
  }, [stopHoverProgress])

  const openDetail = useCallback((nodeId) => {
    const node = getCenterNode(nodeId)
    setFocusedNodeId(nodeId)
    setDetailNodeId(nodeId)
    setEdgeIntent(null)
    setSelectedContentId(node.contentOptions?.find(option => !option.locked)?.id ?? null)
  }, [])

  const closeDetail = useCallback(() => {
    setDetailNodeId(null)
    setSelectedContentId(null)
  }, [])

  const enterNode = useCallback((node) => {
    if (!node || node.type === 'locked') return false
    if (node.nodes.length > 0) {
      historyRef.current = [...historyRef.current, currentNodeId]
      setCurrentNodeId(node.id)
      setFocusedNodeId(null)
      setDetailNodeId(null)
      setEdgeIntent(null)
      setCamera({ x: 0, y: 0 })
      wheelAccumulatorRef.current = 0
      return true
    }
    const firstContent = node.contentOptions?.find(option => !option.locked)
    if (firstContent) {
      onOpenContent?.(node, firstContent.id)
      return true
    }
    return false
  }, [currentNodeId, onOpenContent])

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
    setEdgeIntent(null)
    setCamera({ x: 0, y: 0 })
    wheelAccumulatorRef.current = 0
    return true
  }, [closeDetail, detailNodeId])

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

    if (direction < 0) {
      if (goBack()) return
      if (!focusedNode && edgeIntent === 'top') onExitTop?.()
      return
    }

    const interactiveTarget = event.target.closest?.('[data-center-node-id], [data-center-annotation]')
    if (focusedNode && interactiveTarget) {
      enterNode(focusedNode)
      return
    }
    if (!focusedNode && currentNodeId === CENTER_ROOT_ID && edgeIntent === 'bottom') onExitBottom?.()
  }, [closeDetail, currentNodeId, detailNode, edgeIntent, enterNode, focusedNode, goBack, onExitBottom, onExitTop, onOpenContent, selectedContentId])

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

    if (hoverNodeRef.current && event.pointerType === 'mouse') {
      const previous = lastMotionRef.current
      const moved = previous ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y) : 0
      if (moved > MOVE_TOLERANCE_PX) {
        lastMotionRef.current = { x: event.clientX, y: event.clientY }
        scheduleResume(hoverNodeRef.current)
      }
    }

    if (event.pointerType === 'touch' && touchRef.current) {
      const dx = event.clientX - touchRef.current.x
      const dy = event.clientY - touchRef.current.y
      setCamera(previous => ({ x: previous.x + dx, y: previous.y + dy }))
      touchRef.current.x = event.clientX
      touchRef.current.y = event.clientY
      touchRef.current.moved = true
      return
    }

    if (!dragRef.current) return
    setCamera({
      x: dragRef.current.cameraX + event.clientX - dragRef.current.x,
      y: dragRef.current.cameraY + event.clientY - dragRef.current.y,
    })
  }, [currentNodeId, detailNodeId, focusedNodeId, hoveringNodeId, scheduleResume])

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'touch') {
      touchRef.current = { x: event.clientX, y: event.clientY, moved: false }
      return
    }
    if (event.button !== 2) return
    dragRef.current = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [camera])

  const onPointerUp = useCallback((event) => {
    if (event.pointerType === 'touch' && touchRef.current) {
      touchRef.current = null
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(hoverFrameRef.current)
    window.clearTimeout(resumeTimerRef.current)
    window.clearTimeout(clearTimerRef.current)
  }, [])

  return {
    currentNode,
    currentNodeId,
    children,
    focusedNode,
    detailNode,
    selectedContentId,
    hoveringNodeId,
    hoverProgress,
    cursor,
    edgeIntent,
    camera,
    beginHover,
    endHover,
    keepFocus,
    cancelFocus,
    openDetail,
    closeDetail,
    setSelectedContentId,
    enterNode,
    goBack,
    onWheel,
    onPointerMove,
    onPointerDown,
    onPointerUp,
  }
}

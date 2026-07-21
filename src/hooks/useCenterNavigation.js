import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CENTER_ROOT_ID, getCenterChildren, getCenterNode } from '../data/center/centerWorld'

const HOVER_FOCUS_MS = 900
const HOVER_CLEAR_GRACE_MS = 180
const WHEEL_THRESHOLD = 34
const TOUCH_SWIPE_THRESHOLD = 52

export function useCenterNavigation() {
  const [currentNodeId, setCurrentNodeId] = useState(CENTER_ROOT_ID)
  const [focusedNodeId, setFocusedNodeId] = useState(null)
  const [focusPinned, setFocusPinned] = useState(false)
  const [hoveringNodeId, setHoveringNodeId] = useState(null)
  const [hoverProgress, setHoverProgress] = useState(0)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const historyRef = useRef([])
  const hoverFrameRef = useRef(0)
  const hoverStartedAtRef = useRef(0)
  const hoverClearTimerRef = useRef(0)
  const dragRef = useRef(null)
  const touchRef = useRef(null)
  const wheelAccumulatorRef = useRef(0)
  const lastPointerRef = useRef(null)

  const currentNode = getCenterNode(currentNodeId)
  const children = useMemo(() => getCenterChildren(currentNodeId), [currentNodeId])
  const focusedNode = focusedNodeId ? getCenterNode(focusedNodeId) : null

  const stopHoverProgress = useCallback(() => {
    cancelAnimationFrame(hoverFrameRef.current)
    hoverFrameRef.current = 0
    hoverStartedAtRef.current = 0
    setHoveringNodeId(null)
    setHoverProgress(0)
  }, [])

  const cancelPendingClear = useCallback(() => {
    window.clearTimeout(hoverClearTimerRef.current)
    hoverClearTimerRef.current = 0
  }, [])

  const clearTransientFocus = useCallback(() => {
    cancelPendingClear()
    stopHoverProgress()
    if (!focusPinned) setFocusedNodeId(null)
  }, [cancelPendingClear, focusPinned, stopHoverProgress])

  const beginHover = useCallback((nodeId) => {
    cancelPendingClear()
    if (focusPinned && focusedNodeId === nodeId) return
    if (hoveringNodeId === nodeId) return

    stopHoverProgress()
    setHoveringNodeId(nodeId)
    hoverStartedAtRef.current = performance.now()

    const animate = now => {
      const progress = Math.min(1, (now - hoverStartedAtRef.current) / HOVER_FOCUS_MS)
      setHoverProgress(progress)
      if (progress >= 1) {
        setFocusedNodeId(nodeId)
        setFocusPinned(false)
        setHoveringNodeId(null)
        hoverFrameRef.current = 0
        return
      }
      hoverFrameRef.current = requestAnimationFrame(animate)
    }

    hoverFrameRef.current = requestAnimationFrame(animate)
  }, [cancelPendingClear, focusPinned, focusedNodeId, hoveringNodeId, stopHoverProgress])

  const endHover = useCallback(() => {
    stopHoverProgress()
    if (focusPinned) return
    cancelPendingClear()
    hoverClearTimerRef.current = window.setTimeout(() => {
      setFocusedNodeId(null)
      hoverClearTimerRef.current = 0
    }, HOVER_CLEAR_GRACE_MS)
  }, [cancelPendingClear, focusPinned, stopHoverProgress])

  const keepTransientFocus = useCallback(() => {
    cancelPendingClear()
  }, [cancelPendingClear])

  const cancelFocus = useCallback(() => {
    cancelPendingClear()
    stopHoverProgress()
    setFocusedNodeId(null)
    setFocusPinned(false)
  }, [cancelPendingClear, stopHoverProgress])

  const focusNode = useCallback((nodeId, pinned = true) => {
    cancelPendingClear()
    stopHoverProgress()
    setFocusedNodeId(nodeId)
    setFocusPinned(pinned)
  }, [cancelPendingClear, stopHoverProgress])

  const detectNodeUnderPointer = useCallback(() => {
    const point = lastPointerRef.current
    if (!point || point.pointerType !== 'mouse') return
    const target = document.elementFromPoint(point.x, point.y)
    const region = target?.closest?.('[data-center-node-id]')
    if (region?.dataset.centerNodeId) beginHover(region.dataset.centerNodeId)
  }, [beginHover])

  const enterFocused = useCallback(() => {
    if (!focusedNode || focusedNode.type === 'locked' || focusedNode.nodes.length === 0) return false
    historyRef.current = [...historyRef.current, currentNodeId]
    setCurrentNodeId(focusedNode.id)
    setFocusedNodeId(null)
    setFocusPinned(false)
    stopHoverProgress()
    setCamera({ x: 0, y: 0 })
    wheelAccumulatorRef.current = 0
    requestAnimationFrame(() => requestAnimationFrame(detectNodeUnderPointer))
    return true
  }, [currentNodeId, detectNodeUnderPointer, focusedNode, stopHoverProgress])

  const goBack = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return false
    const previous = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    setCurrentNodeId(previous)
    setFocusedNodeId(null)
    setFocusPinned(false)
    stopHoverProgress()
    setCamera({ x: 0, y: 0 })
    wheelAccumulatorRef.current = 0
    requestAnimationFrame(() => requestAnimationFrame(detectNodeUnderPointer))
    return true
  }, [detectNodeUnderPointer, stopHoverProgress])

  const onWheel = useCallback((event) => {
    event.preventDefault()
    wheelAccumulatorRef.current += event.deltaY

    if (wheelAccumulatorRef.current <= -WHEEL_THRESHOLD) {
      goBack()
      wheelAccumulatorRef.current = 0
      return
    }

    if (wheelAccumulatorRef.current < WHEEL_THRESHOLD) return

    const region = event.target.closest?.('[data-center-node-id]')
    const note = event.target.closest?.('[data-center-focus-note]')
    const targetsFocusedNode = region?.dataset.centerNodeId === focusedNodeId || Boolean(note)
    if (targetsFocusedNode) enterFocused()
    wheelAccumulatorRef.current = 0
  }, [enterFocused, focusedNodeId, goBack])

  const onPointerDown = useCallback((event) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY, pointerType: event.pointerType }
    if (event.pointerType === 'mouse' && event.button !== 2) return
    if (event.pointerType === 'touch') {
      touchRef.current = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false }
      return
    }
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [camera])

  const onPointerMove = useCallback((event) => {
    lastPointerRef.current = { x: event.clientX, y: event.clientY, pointerType: event.pointerType }
    if (event.pointerType === 'touch' && touchRef.current) {
      const dx = event.clientX - touchRef.current.x
      const dy = event.clientY - touchRef.current.y
      if (Math.abs(event.clientX - touchRef.current.startX) + Math.abs(event.clientY - touchRef.current.startY) > 8) {
        touchRef.current.moved = true
      }
      setCamera(previous => ({ x: previous.x + dx, y: previous.y + dy }))
      touchRef.current.x = event.clientX
      touchRef.current.y = event.clientY
      return
    }
    if (!dragRef.current) return
    setCamera({
      x: dragRef.current.cameraX + event.clientX - dragRef.current.x,
      y: dragRef.current.cameraY + event.clientY - dragRef.current.y,
    })
  }, [])

  const onPointerUp = useCallback((event) => {
    if (event.pointerType === 'touch' && touchRef.current) {
      const gesture = touchRef.current
      const totalDy = event.clientY - gesture.startY
      if (gesture.moved) {
        if (totalDy <= -TOUCH_SWIPE_THRESHOLD) enterFocused()
        if (totalDy >= TOUCH_SWIPE_THRESHOLD) goBack()
      }
      touchRef.current = null
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [enterFocused, goBack])

  useEffect(() => () => {
    cancelAnimationFrame(hoverFrameRef.current)
    window.clearTimeout(hoverClearTimerRef.current)
  }, [])

  return {
    currentNode,
    children,
    focusedNode,
    focusPinned,
    hoveringNodeId,
    hoverProgress,
    camera,
    beginHover,
    endHover,
    keepTransientFocus,
    focusNode,
    cancelFocus,
    enterFocused,
    goBack,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}

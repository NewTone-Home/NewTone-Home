import { useCallback, useMemo, useRef, useState } from 'react'
import { CENTER_ROOT_ID, getCenterChildren, getCenterNode } from '../data/center/centerWorld'

const HOVER_FOCUS_MS = 900
const WHEEL_THRESHOLD = 34
const TOUCH_SWIPE_THRESHOLD = 52

export function useCenterNavigation() {
  const [currentNodeId, setCurrentNodeId] = useState(CENTER_ROOT_ID)
  const [focusedNodeId, setFocusedNodeId] = useState(null)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const historyRef = useRef([])
  const hoverTimerRef = useRef(null)
  const dragRef = useRef(null)
  const touchRef = useRef(null)
  const wheelAccumulatorRef = useRef(0)

  const currentNode = getCenterNode(currentNodeId)
  const children = useMemo(() => getCenterChildren(currentNodeId), [currentNodeId])
  const focusedNode = focusedNodeId ? getCenterNode(focusedNodeId) : null

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const beginHover = useCallback((nodeId) => {
    clearHoverTimer()
    if (focusedNodeId === nodeId) return
    hoverTimerRef.current = window.setTimeout(() => {
      setFocusedNodeId(nodeId)
      hoverTimerRef.current = null
    }, HOVER_FOCUS_MS)
  }, [clearHoverTimer, focusedNodeId])

  const endHover = useCallback(() => {
    clearHoverTimer()
  }, [clearHoverTimer])

  const cancelFocus = useCallback(() => {
    clearHoverTimer()
    setFocusedNodeId(null)
  }, [clearHoverTimer])

  const focusNode = useCallback((nodeId) => {
    clearHoverTimer()
    setFocusedNodeId(nodeId)
  }, [clearHoverTimer])

  const enterFocused = useCallback(() => {
    if (!focusedNode || focusedNode.type === 'locked' || focusedNode.nodes.length === 0) return false
    historyRef.current = [...historyRef.current, currentNodeId]
    setCurrentNodeId(focusedNode.id)
    setFocusedNodeId(null)
    setCamera({ x: 0, y: 0 })
    wheelAccumulatorRef.current = 0
    return true
  }, [currentNodeId, focusedNode])

  const goBack = useCallback(() => {
    const history = historyRef.current
    if (history.length === 0) return false
    const previous = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    setCurrentNodeId(previous)
    setFocusedNodeId(null)
    setCamera({ x: 0, y: 0 })
    wheelAccumulatorRef.current = 0
    return true
  }, [])

  const onWheel = useCallback((event) => {
    event.preventDefault()
    wheelAccumulatorRef.current += event.deltaY

    if (wheelAccumulatorRef.current >= WHEEL_THRESHOLD) {
      enterFocused()
      wheelAccumulatorRef.current = 0
    } else if (wheelAccumulatorRef.current <= -WHEEL_THRESHOLD) {
      goBack()
      wheelAccumulatorRef.current = 0
    }
  }, [enterFocused, goBack])

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 2) return
    if (event.pointerType === 'touch') {
      touchRef.current = { x: event.clientX, y: event.clientY, moved: false }
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
    if (event.pointerType === 'touch' && touchRef.current) {
      const dx = event.clientX - touchRef.current.x
      const dy = event.clientY - touchRef.current.y
      if (Math.abs(dx) + Math.abs(dy) > 8) touchRef.current.moved = true
      setCamera(previous => ({ x: previous.x + dx * 0.35, y: previous.y + dy * 0.35 }))
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
      const start = touchRef.current
      const dy = event.clientY - start.y
      if (!start.moved) {
        touchRef.current = null
        return
      }
      if (dy <= -TOUCH_SWIPE_THRESHOLD) enterFocused()
      if (dy >= TOUCH_SWIPE_THRESHOLD) goBack()
      touchRef.current = null
      return
    }
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [enterFocused, goBack])

  return {
    currentNode,
    children,
    focusedNode,
    camera,
    beginHover,
    endHover,
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

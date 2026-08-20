import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import CenterInfoPanel from '../center/components/CenterInfoPanel'
import CenterMap from '../center/components/CenterMap'
import CenterNewsTicker from '../center/components/CenterNewsTicker'
import { useCenterPanZoom } from '../center/camera/useCenterPanZoom'
import { getCenterCopy } from '../center/data/centerCopy'
import { getCenterEntity } from '../center/data/centerScene'
import {
  centerInteractionReducer,
  initialCenterInteraction,
} from '../center/interaction/centerInteraction'
import { useProgressStore } from '../stores/progressStore'
import './CenterExperience.css'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function CenterExperience({ onExit, onReady }) {
  const language = useProgressStore(state => state.language)
  const motionMode = useProgressStore(state => state.motionMode)
  const copy = getCenterCopy(language)
  const [interaction, dispatch] = useReducer(centerInteractionReducer, initialCenterInteraction)
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const panelRef = useRef(null)
  const connectorRef = useRef(null)
  const selectedIdRef = useRef(null)
  selectedIdRef.current = interaction.selectedId
  const selectedEntity = getCenterEntity(interaction.selectedId)

  const updatePanelAnchor = useCallback(() => {
    const root = rootRef.current
    const panel = panelRef.current
    const connector = connectorRef.current
    const selectedId = selectedIdRef.current
    if (!root || !panel || !connector || !selectedId) return

    if (window.matchMedia('(max-width: 700px)').matches) {
      panel.style.removeProperty('left')
      panel.style.removeProperty('top')
      connector.style.removeProperty('width')
      return
    }

    const target = root.querySelector(`[data-center-entity-id="${selectedId}"]`)
    if (!target) return
    const rootRect = root.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const targetX = targetRect.left - rootRect.left + targetRect.width / 2
    const targetY = targetRect.top - rootRect.top + targetRect.height / 2
    const side = targetX < rootRect.width * 0.54 ? 'right' : 'left'
    const panelLeft = side === 'right'
      ? clamp(targetX + 52, 18, rootRect.width - panelRect.width - 22)
      : clamp(targetX - panelRect.width - 52, 18, rootRect.width - panelRect.width - 22)
    const panelTop = clamp(targetY - panelRect.height * 0.38, 72, rootRect.height - panelRect.height - 64)
    panel.style.left = `${panelLeft}px`
    panel.style.top = `${panelTop}px`

    const endX = side === 'right' ? panelLeft : panelLeft + panelRect.width
    const endY = clamp(targetY, panelTop + 28, panelTop + panelRect.height - 28)
    const length = Math.hypot(endX - targetX, endY - targetY)
    const angle = Math.atan2(endY - targetY, endX - targetX) * 180 / Math.PI
    connector.style.left = `${targetX}px`
    connector.style.top = `${targetY}px`
    connector.style.width = `${length}px`
    connector.style.transform = `rotate(${angle}deg)`
  }, [])

  const camera = useCenterPanZoom({ canvasRef, sceneRef, rootRef, onCameraFrame: updatePanelAnchor })

  useLayoutEffect(() => {
    if (!selectedEntity) return undefined
    const frame = window.requestAnimationFrame(updatePanelAnchor)
    return () => window.cancelAnimationFrame(frame)
  }, [interaction.mode, selectedEntity, updatePanelAnchor])

  useEffect(() => {
    const handleResize = () => updatePanelAnchor()
    const handleKey = event => {
      if (event.key !== 'Escape' || !selectedIdRef.current) return
      dispatch({ type: interaction.openId ? 'CLOSE_OPEN' : 'CLEAR' })
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKey)
    }
  }, [interaction.openId, updatePanelAnchor])

  useEffect(() => {
    onReady?.()
  }, [onReady])

  const selectEntity = useCallback((entityId) => {
    if (camera.shouldSuppressClick()) return
    dispatch({ type: 'SELECT', entityId })
  }, [camera])

  const clearSelection = useCallback(() => {
    if (camera.shouldSuppressClick()) return
    dispatch({ type: 'CLEAR' })
  }, [camera])

  return (
    <main
      ref={rootRef}
      className="center-experience"
      data-center-mode={interaction.mode}
      data-motion-mode={motionMode}
      data-camera-moving="false"
    >
      <header className="center-header">
        <button type="button" className="center-header__back" onClick={onExit}>
          <span aria-hidden="true">←</span>
          <span>{copy.back}</span>
        </button>
        <div className="center-header__identity">
          <span>{copy.center}</span>
          <strong>{copy.city}</strong>
        </div>
      </header>

      <CenterMap
        canvasRef={canvasRef}
        sceneRef={sceneRef}
        interaction={interaction}
        language={language}
        label={copy.mapLabel}
        onFocus={entityId => dispatch({ type: 'FOCUS', entityId })}
        onBlur={entityId => dispatch({ type: 'BLUR', entityId })}
        onSelect={selectEntity}
        onClear={clearSelection}
      />

      <nav className="center-camera-controls" aria-label={copy.mapLabel}>
        <button type="button" onClick={camera.zoomIn} aria-label={copy.zoomIn}>+</button>
        <button type="button" onClick={camera.zoomOut} aria-label={copy.zoomOut}>−</button>
        <button type="button" onClick={camera.reset} aria-label={copy.reset}>⌂</button>
      </nav>

      <p className="center-input-hint">
        <span className="center-input-hint__desktop">{copy.hintDesktop}</span>
        <span className="center-input-hint__touch">{copy.hintTouch}</span>
      </p>

      <div ref={connectorRef} className="center-context-connector" aria-hidden="true" />
      <CenterInfoPanel
        panelRef={panelRef}
        entity={selectedEntity}
        language={language}
        mode={interaction.mode}
        copy={copy}
        onClose={() => dispatch({ type: 'CLEAR' })}
        onOpen={() => dispatch({ type: 'OPEN' })}
        onCloseOpen={() => dispatch({ type: 'CLOSE_OPEN' })}
      />

      <CenterNewsTicker language={language} label={copy.worldFeed} onSelect={selectEntity} />
    </main>
  )
}

export default CenterExperience

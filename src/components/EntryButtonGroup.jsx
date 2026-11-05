import { useCallback, useEffect, useRef, useState } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import './EntryButtonGroup.css'

const GROUP_PHASE = Object.freeze({ VISIBLE: 'visible', EXITING: 'exiting' })

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function EntryButtonGroup({ groupId, entries, onNavigate, onActionStart, materialMode, worldLayer, visible = true, className = '', initialFocusId = null }) {
  const rootRef = useRef(null)
  const aliveRef = useRef(true)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  useEffect(() => {
    aliveRef.current = true
    let observer
    if (initialFocusId && rootRef.current) {
      const focusWhenReady = () => {
        const button = rootRef.current?.querySelector(`[data-entry-group-entry="${initialFocusId}"]`)
        if (button && !button.disabled) { button.focus(); observer?.disconnect() }
      }
      observer = new MutationObserver(focusWhenReady)
      observer.observe(rootRef.current, { subtree: true, attributes: true, attributeFilter: ['disabled'] })
      focusWhenReady()
    }
    return () => { aliveRef.current = false; observer?.disconnect() }
  }, [initialFocusId])
  const [phase, setPhase] = useState(GROUP_PHASE.VISIBLE)
  const phaseRef = useRef(GROUP_PHASE.VISIBLE)
  const actionRef = useRef(null)
  const navigatedRef = useRef(false)
  const onNavigateRef = useRef(onNavigate)
  const onActionStartRef = useRef(onActionStart)
  onNavigateRef.current = onNavigate
  onActionStartRef.current = onActionStart

  const setGroupPhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase
    setPhase(nextPhase)
    recordRuntimeAudit('entry-group-phase', { groupId, phase: nextPhase })
  }, [groupId])

  useEffect(() => {
    recordRuntimeAudit('entry-group-mounted', { groupId, entries: entries.map(entry => entry.id) })
    return () => recordRuntimeAudit('entry-group-unmounted', { groupId })
  }, [entries, groupId])

  const handleActionStart = useCallback(({ entryId, inputType }) => {
    if (!aliveRef.current || !visibleRef.current || phaseRef.current !== GROUP_PHASE.VISIBLE || navigatedRef.current) return
    actionRef.current = { entryId, inputType }
    recordRuntimeAudit('entry-group-click', { groupId, entryId, inputType })
    onActionStartRef.current?.({ entryId, inputType })
    setGroupPhase(GROUP_PHASE.EXITING)
  }, [groupId, setGroupPhase])

  const handleActionComplete = useCallback(({ entryId, inputType }) => {
    if (!aliveRef.current || phaseRef.current !== GROUP_PHASE.EXITING || navigatedRef.current) return
    if (!actionRef.current || actionRef.current.entryId !== entryId) return
    navigatedRef.current = true
    recordRuntimeAudit('entry-group-action-complete', { groupId, entryId, inputType })
    onNavigateRef.current?.(entryId)
  }, [groupId])

  return (
    <div ref={rootRef} className={`entry-button-group${className ? ` ${className}` : ''}`} data-entry-group={groupId} data-entry-group-phase={phase} data-entry-group-visible={visible ? 'true' : 'false'}>
      {entries.map(entry => (
        <EntryButtonSurface
          key={entry.id}
          entryId={entry.id}
          disabled={entry.disabled === true}
          label={entry.label}
          materialMode={entry.materialMode || materialMode}
          worldLayer={entry.worldLayer || worldLayer}
          visible={visible && phase !== GROUP_PHASE.EXITING}
          mobile={isCoarsePointer()}
          dataAttributes={{ 'data-entry-group-entry': entry.id }}
          onActionStart={handleActionStart}
          onActionComplete={handleActionComplete}
        />
      ))}
    </div>
  )
}

export default EntryButtonGroup

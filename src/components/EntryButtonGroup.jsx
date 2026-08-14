import { useCallback, useEffect, useRef, useState } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import './EntryButtonGroup.css'

const GROUP_PHASE = Object.freeze({ VISIBLE: 'visible', EXITING: 'exiting' })

function isCoarsePointer() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true
}

function EntryButtonGroup({ groupId, entries, onNavigate, materialMode, worldLayer, visible = true, className = '' }) {
  const [phase, setPhase] = useState(GROUP_PHASE.VISIBLE)
  const phaseRef = useRef(GROUP_PHASE.VISIBLE)
  const actionRef = useRef(null)
  const navigatedRef = useRef(false)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

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
    if (phaseRef.current !== GROUP_PHASE.VISIBLE || navigatedRef.current) return
    actionRef.current = { entryId, inputType }
    recordRuntimeAudit('entry-group-click', { groupId, entryId, inputType })
    setGroupPhase(GROUP_PHASE.EXITING)
  }, [groupId, setGroupPhase])

  const handleActionComplete = useCallback(({ entryId, inputType }) => {
    if (phaseRef.current !== GROUP_PHASE.EXITING || navigatedRef.current) return
    if (!actionRef.current || actionRef.current.entryId !== entryId) return
    navigatedRef.current = true
    recordRuntimeAudit('entry-group-action-complete', { groupId, entryId, inputType })
    onNavigateRef.current?.(entryId)
  }, [groupId])

  return (
    <div className={`entry-button-group${className ? ` ${className}` : ''}`} data-entry-group={groupId} data-entry-group-phase={phase} data-entry-group-visible={visible ? 'true' : 'false'}>
      {entries.map(entry => (
        <EntryButtonSurface
          key={entry.id}
          entryId={entry.id}
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

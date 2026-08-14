import { useCallback, useEffect, useRef, useState } from 'react'
import EntryButtonSurface from './EntryButtonSurface'
import { recordRuntimeAudit } from '../services/runtimeAudit'
import './EntryButtonGroup.css'

const GROUP_PHASE = Object.freeze({ ENTERING: 'entering', VISIBLE: 'visible', EXITING: 'exiting' })

function EntryButtonGroup({ groupId, entries, onNavigate, materialMode, worldLayer, className = '' }) {
  const [phase, setPhase] = useState(GROUP_PHASE.ENTERING)
  const phaseRef = useRef(GROUP_PHASE.ENTERING)
  const completedRef = useRef(new Set())
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

  const handleAnimationEnd = useCallback((entryId, event) => {
    if (event.target !== event.currentTarget) return
    if (phaseRef.current === GROUP_PHASE.ENTERING && event.animationName === 'entry-button-surface-enter') {
      completedRef.current.add(entryId)
      if (completedRef.current.size === entries.length) {
        completedRef.current.clear()
        setGroupPhase(GROUP_PHASE.VISIBLE)
      }
      return
    }
    if (phaseRef.current !== GROUP_PHASE.EXITING || event.animationName !== 'entry-button-surface-exit') return
    completedRef.current.add(entryId)
    if (completedRef.current.size !== entries.length || navigatedRef.current) return
    navigatedRef.current = true
    recordRuntimeAudit('entry-group-action-complete', { groupId, entryId: actionRef.current })
    onNavigateRef.current?.(actionRef.current)
  }, [entries.length, groupId, setGroupPhase])

  const handleClick = useCallback((entryId, event) => {
    if (event.detail < 0 || phaseRef.current !== GROUP_PHASE.VISIBLE || navigatedRef.current) return
    actionRef.current = entryId
    completedRef.current.clear()
    recordRuntimeAudit('entry-group-click', { groupId, entryId, inputType: event.nativeEvent?.pointerType || 'mouse' })
    setGroupPhase(GROUP_PHASE.EXITING)
  }, [groupId, setGroupPhase])

  return (
    <div className={`entry-button-group${className ? ` ${className}` : ''}`} data-entry-group={groupId} data-entry-group-phase={phase}>
      {entries.map(entry => (
        <EntryButtonSurface
          key={entry.id}
          entryId={entry.id}
          label={entry.label}
          materialMode={entry.materialMode || materialMode}
          worldLayer={entry.worldLayer || worldLayer}
          phase={phase}
          onClick={event => handleClick(entry.id, event)}
          onAnimationEnd={event => handleAnimationEnd(entry.id, event)}
        />
      ))}
    </div>
  )
}

export default EntryButtonGroup

import { useEffect, useRef, useState } from 'react'
import EntryButtonGroup from './EntryButtonGroup'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { beginSaveEntry, saveEntryMenuMode } from '../services/saveEntryMenuModel.mjs'

const REVEAL_MS = 320

export default function SaveEntryMenu({ entry, language, text, warnings, onAction, motionMode }) {
  const [expandedSnapshot, setExpandedSnapshot] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [touched, setTouched] = useState(null)
  const root = useRef(null)
  const reduced = useReducedMotion() || motionMode === 'reduced'
  const mode = saveEntryMenuMode(entry, expandedSnapshot)
  useEffect(() => {
    if (!['choice-ready', 'overwrite-confirm', 'legacy-ready'].includes(entry.phase)) setExpandedSnapshot(null)
  }, [entry.phase])
  useEffect(() => {
    if (!revealing) return undefined
    const timer = setTimeout(() => setRevealing(false), reduced ? 0 : REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealing, reduced])
  useEffect(() => {
    const target = mode === 'confirm' ? 'cancel' : entry.focusTarget
    if (target) root.current?.querySelector(`[data-entry-id="${target}"]`)?.focus()
  }, [mode, entry.focusTarget, entry.epoch])
  const expand = token => { setRevealing(!reduced); setExpandedSnapshot(token) }
  const pureOption = (id, label, disabled = false) => <button type="button" key={id}
    className={`save-entry-option${touched === id ? ' is-touched' : ''}`}
    data-entry-id={id} disabled={disabled || revealing}
    onPointerDown={() => setTouched(id)} onPointerUp={() => setTouched(null)}
    onPointerCancel={() => setTouched(null)} onBlur={() => setTouched(null)}
    onClick={() => { if (!revealing && !disabled) { setTouched(null); onAction(id) } }}>{label}</button>
  const message = mode === 'confirm' ? text.overwrite : mode === 'legacy' ? text['legacy-ready']
    : mode === 'status' ? text[entry.phase] ?? '' : ''
  const statusEntries = entry.phase === 'uncertain' ? [{ id: 'reinspect', label: text.resolve }]
    : ['failed', 'unknown'].includes(entry.phase) ? [{ id: 'back', label: text.back }, { id: 'reinspect', label: text.reinspect }]
    : entry.phase === 'back' ? [{ id: 'reinspect', label: text.create }] : []
  return <section ref={root} className="save-entry" lang={language}
    data-save-entry-menu={mode} data-save-entry-phase={entry.phase}
    data-save-entry-classification={entry.inspection?.classification ?? ''}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !['choices', 'confirm', 'legacy'].includes(mode)) return
      event.preventDefault(); event.stopPropagation()
      if (mode === 'confirm') onAction('cancel')
      else { setExpandedSnapshot(null); setRevealing(false) }
    }}>
    {mode === 'primary' && <EntryButtonGroup groupId={`save-entry:begin:${entry.epoch}`}
      entries={[{ id: 'begin', label: text.create }]} materialMode="background"
      onNavigate={() => beginSaveEntry(entry, expand, onAction)} />}
    {['choices', 'confirm'].includes(mode) && <div className="save-entry-choices" data-revealing={revealing}>
      {pureOption('continue', text.continue, mode === 'confirm' || !entry.inspection?.allowedActions?.includes('continue'))}
      <div className="save-entry-new-slot">
        {pureOption('request-replace', text.replaceRequest, mode === 'confirm' || !entry.inspection?.allowedActions?.includes('request-replace'))}
        {mode === 'confirm' && <div className="save-entry-confirm" role="group" aria-label={text.overwrite}>
          {pureOption('replace', text.confirm)}{pureOption('cancel', text.cancel)}
        </div>}
      </div>
    </div>}
    {mode === 'legacy' && <div className="save-entry-choices">
      <p role="status">{message}</p>
      {pureOption('restart', text.restart, !entry.inspection?.allowedActions?.includes('restart'))}
      {pureOption('back', text.back)}
    </div>}
    {message && mode !== 'legacy' && <p role="status" aria-live="polite">{message}</p>}
    {warnings.map(message => <p key={message} role="status" className="save-entry-warning" data-save-entry-warning>{message}</p>)}
    {entry.reasons.length > 0 && <small data-save-entry-reasons>{entry.reasons.join(' / ')}</small>}
    {statusEntries.length > 0 && <EntryButtonGroup key={`${entry.phase}:${entry.epoch}`}
      groupId={`save-entry:${entry.phase}:${entry.epoch}`} entries={statusEntries}
      materialMode="background" onNavigate={onAction} />}
  </section>
}

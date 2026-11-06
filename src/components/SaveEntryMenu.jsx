import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../services/analytics'
import EntryButtonGroup from './EntryButtonGroup'
import EntryButtonSurface from './EntryButtonSurface'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { beginSaveEntry, saveEntryMenuMode } from '../services/saveEntryMenuModel.mjs'
import { isOutsideMenuTap, trackOutsideMenuMove } from '../services/entryMenuOutsideTap.mjs'
import { ENTRY_MENU_EXIT_MS, isCurrentEntryMenuMotion, takeEntryMenuIntent } from '../services/entryMenuMotion.mjs'

const REVEAL_MS = 320

export default function SaveEntryMenu({ entry, language, text, warnings, onAction, motionMode }) {
  const [expandedSnapshot, setExpandedSnapshot] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [touched, setTouched] = useState(null)
  const root = useRef(null)
  const exitRef = useRef(null), loadingRef = useRef(null)
  const [exiting, setExiting] = useState(null), [loading, setLoading] = useState(null)
  const live = useRef(null)
  const [readyConfirmation, setReadyConfirmation] = useState(null)
  const reduced = useReducedMotion() || motionMode === 'reduced'
  const mode = saveEntryMenuMode(entry, expandedSnapshot)
  const confirmationRevealing = mode === 'confirm' && !reduced && readyConfirmation !== entry.epoch
  const loadingLabel = language === 'zh' ? '加载游戏中' : 'Loading game'
  const requestExit = (kind, intent = null) => {
    if (exitRef.current || loadingRef.current) return
    const record = { kind, intent, epoch: entry.epoch, snapshot: entry.inspection?.snapshotToken }
    if (kind === 'cancel' || kind === 'collapse') trackEvent('center_entry_action', { eventData: { intent: kind } })
    exitRef.current = record; setExiting(record); setTouched(null)
  }
  const completeExit = record => {
    if (exitRef.current !== record) return
    exitRef.current = null; setExiting(null)
    const current = live.current
    if (!isCurrentEntryMenuMotion(record, current.entry)) return
    if (record.kind === 'submit') {
      loadingRef.current = record; setLoading(record)
    } else if (record.kind === 'cancel') current.onAction('cancel')
    else {
      if (current.mode === 'confirm') current.onAction('cancel')
      setExpandedSnapshot(null); setRevealing(false)
    }
  }
  const loadingTextReady = value => {
    const record = loadingRef.current, current = live.current
    if (!record || record.consumed || value !== loadingLabel) return
    if (!isCurrentEntryMenuMotion(record, current.entry)) {
      loadingRef.current = null; setLoading(null); return
    }
    const intent = takeEntryMenuIntent(record, value, loadingLabel, current.entry)
    if (intent) current.onAction(intent)
  }
  live.current = { mode, onAction, entry, requestExit }
  useEffect(() => {
    if (!exiting) return undefined
    const timer = setTimeout(() => completeExit(exiting), reduced ? 0 : ENTRY_MENU_EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting, reduced])
  useEffect(() => () => { exitRef.current = null; loadingRef.current = null }, [])
  useEffect(() => {
    if (['failed', 'unknown', 'back', 'uncertain'].includes(entry.phase)
      || (loadingRef.current?.consumed && !['committing', 'entering'].includes(entry.phase))) {
      exitRef.current = null; loadingRef.current = null; setExiting(null); setLoading(null)
    }
  }, [entry.phase, entry.epoch])
  const expandable = !loading && ['choices', 'confirm', 'legacy'].includes(mode)
  useEffect(() => {
    if (!expandable) return undefined
    let start = null
    const point = event => ({ pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      at: event.timeStamp, outside: !root.current?.contains(event.target) })
    const down = event => { start = event.isPrimary && event.button === 0 ? point(event) : null }
    const move = event => {
      for (const sample of event.getCoalescedEvents?.() ?? []) start = trackOutsideMenuMove(start, point(sample))
      start = trackOutsideMenuMove(start, point(event))
    }
    const up = event => {
      const dismiss = isOutsideMenuTap(start, point(event)); start = null
      if (!dismiss || !['choices', 'confirm', 'legacy'].includes(live.current.mode)) return
      live.current.requestExit('collapse')
    }
    const cancel = () => { start = null }
    document.addEventListener('pointerdown', down, { capture: true, passive: true })
    document.addEventListener('pointerup', up, { capture: true, passive: true })
    document.addEventListener('pointermove', move, { capture: true, passive: true })
    document.addEventListener('pointercancel', cancel, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointercancel', cancel, true)
    }
  }, [expandable])
  useEffect(() => {
    if (mode !== 'confirm' || reduced) return undefined
    const timer = setTimeout(() => setReadyConfirmation(entry.epoch), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [mode, entry.epoch, reduced])
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
  }, [mode, entry.focusTarget, entry.epoch, confirmationRevealing])
  const expand = token => { trackEvent('center_entry_action', { eventData: { intent: 'expand' } }); setRevealing(!reduced); setExpandedSnapshot(token) }
  const pureOption = (id, label, disabled = false) => {
    const blocked = disabled || revealing || !!exiting || !!loading || (['replace', 'cancel'].includes(id) && confirmationRevealing)
    return <button type="button" key={id}
    className={`save-entry-option${touched === id ? ' is-touched' : ''}`}
    data-entry-id={id} disabled={blocked}
    onPointerDown={() => setTouched(id)} onPointerUp={() => setTouched(null)}
    onPointerCancel={() => setTouched(null)} onBlur={() => setTouched(null)}
    onClick={() => {
      if (blocked) return
      setTouched(null)
      if (id === 'cancel') requestExit('cancel')
      else if (['replace', 'continue', 'restart'].includes(id)) requestExit('submit', id)
      else {
        if (id === 'request-replace') trackEvent('center_entry_action', { eventData: { intent: id } })
        onAction(id)
      }
    }}>{label}</button>
  }
  const message = mode === 'legacy' ? text['legacy-ready']
    : mode === 'status' && !loading ? text[entry.phase] ?? '' : ''
  const statusEntries = entry.phase === 'uncertain' ? [{ id: 'reinspect', label: text.resolve }]
    : ['failed', 'unknown'].includes(entry.phase) ? [{ id: 'back', label: text.back }, { id: 'reinspect', label: text.reinspect }]
    : entry.phase === 'back' ? [{ id: 'reinspect', label: text.create }] : []
  return <section ref={root} className="save-entry" lang={language}
    data-save-entry-menu={loading ? 'loading' : mode} data-menu-exit={exiting?.kind ?? 'none'} data-save-entry-phase={entry.phase}
    data-save-entry-classification={entry.inspection?.classification ?? ''}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !['choices', 'confirm', 'legacy'].includes(mode)) return
      event.preventDefault(); event.stopPropagation()
      requestExit(mode === 'confirm' ? 'cancel' : 'collapse')
    }}>
    {(loading || ['primary', 'choices', 'confirm', 'legacy'].includes(mode)) && <div className="save-entry-primary-slot">
      <EntryButtonSurface visible={true} entryId="begin" label={loading ? loadingLabel : text.create} disabled={!!loading || !!exiting} materialMode="background"
        mobile={typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true}
        retainOnAction={true} textTransition="fade" textMotionReduced={reduced} onTextSettled={loadingTextReady}
        onActionComplete={() => { if (mode === 'primary' && !exitRef.current && !loadingRef.current) beginSaveEntry(entry, expand, intent => requestExit('submit', intent)) }} />
    </div>}
    {!loading && ['choices', 'confirm'].includes(mode) && <div className="save-entry-choices" data-revealing={revealing}
      data-exiting={!!exiting && exiting.kind !== 'cancel'}>
      {pureOption('continue', text.continue, mode === 'confirm' || !entry.inspection?.allowedActions?.includes('continue'))}
      <div className="save-entry-new-slot">
        {pureOption('request-replace', text.replaceRequest, mode === 'confirm' || !entry.inspection?.allowedActions?.includes('request-replace'))}
        {mode === 'confirm' && <div className="save-entry-confirm" data-exiting={exiting?.kind === 'cancel'} role="group" aria-label={text.overwrite}>
          {pureOption('replace', text.confirm)}{pureOption('cancel', text.cancel)}
        </div>}
      </div>
    </div>}
    {!loading && mode === 'legacy' && <div className="save-entry-choices" data-exiting={!!exiting}>
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

import { useEffect, useReducer, useRef, useState } from 'react'
import EntrySurface from './components/EntrySurface'
import EntryButtonGroup from './components/EntryButtonGroup'
import { observeRuntimeEntry, closeRuntimeEntryHandle } from './services/runtimeEntryLifecycle.mjs'
import { createEntryController } from './services/entryController.mjs'
import { getSaveEntryService } from './services/saveEntryService.mjs'
import { entryPreferences, entryPresentation, entryWarningMessages, currentEntryWarnings } from './services/entryPresentation.mjs'
import { setLandingIntroSession } from './services/landingIntro'
import { getReaderThemeVariables, migrateThemePosition } from './reader/readerTheme'
import { WORLD_ENTRY_INITIAL_STATE, worldEntryReducer } from './center/worldEntryTransition'
import './components/SaveEntry.css'

export default function App() {
  const controllerRef = useRef(null)
  if (!controllerRef.current) controllerRef.current = createEntryController(getSaveEntryService())
  const controller = controllerRef.current
  const [entry, setEntry] = useState(controller.getState)
  const [world, dispatch] = useReducer(worldEntryReducer, WORLD_ENTRY_INITIAL_STATE)
  const [runtime, setRuntime] = useState(null)
  const [preferences, setPreferences] = useState({ language: 'zh', motionMode: 'full' })
  const adopted = useRef(null)
  const runtimeObserver = useRef(null)
  useEffect(() => {
    const unsubscribe = controller.subscribe(setEntry)
    setEntry(controller.getState())
    controller.start()
    return unsubscribe
  }, [controller])
  useEffect(() => {
    const previewPreferences = entry.inspection?.preview?.preferences
    if (previewPreferences) setPreferences(entryPreferences(previewPreferences))
  }, [entry.inspection])
  useEffect(() => {
    const result = entry.committed
    if (entry.phase !== 'entering' || !result) return
    let live = true
    const handle = result.sessionHandle
    const lifecycle = observeRuntimeEntry(handle, reason => {
      setRuntime(null); setLandingIntroSession(null); dispatch({ type: 'reset' })
      controller.stopped(reason)
    })
    runtimeObserver.current = { handle, lifecycle }
    try { handle.check() } catch { lifecycle.abandon('SESSION_STOPPED'); return lifecycle.dispose }
    if (adopted.current !== handle) {
      adopted.current = handle
      try {
        setLandingIntroSession(handle.storage)
        const raw = result.snapshot.values?.['newtone-progress-v4']
        if (raw) { const prefs = JSON.parse(raw); setPreferences(entryPreferences(prefs)) }
      } catch { lifecycle.abandon('SESSION_INITIALIZATION_FAILED'); return lifecycle.dispose }
    }
    import('./center/CenterExperience.jsx').then(module => {
      if (!live) return
      try {
        handle.check()
        setRuntime({ Component: module.default, snapshot: result.snapshot, sessionHandle: handle })
        dispatch({ type: 'start' })
      } catch { lifecycle.abandon('SESSION_STOPPED') }
    }).catch(() => { if (live) lifecycle.abandon('RUNTIME_LOAD_FAILED') })
    return () => {
      live = false; lifecycle.dispose()
      if (runtimeObserver.current?.lifecycle === lifecycle) runtimeObserver.current = null
    }
  }, [controller, entry.phase, entry.committed])

  useEffect(() => {
    if (entry.phase !== 'entering') {
      setRuntime(null)
      setLandingIntroSession(null)
      dispatch({ type: 'reset' })
    }
  }, [entry.phase])

  const { language, text } = entryPresentation(preferences, navigator.languages || [navigator.language])
  const warningMessages = entryWarningMessages(currentEntryWarnings(entry), language)
  const warningStyle = getReaderThemeVariables(migrateThemePosition(preferences.themePosition, preferences.standardTheme))
  const entries = entry.phase === 'start-ready' ? [{ id: 'create', label: text.create }]
    : entry.phase === 'choice-ready' ? [{ id: 'continue', label: text.continue }, { id: 'request-replace', label: text.replaceRequest }]
    : entry.phase === 'overwrite-confirm' ? [{ id: 'replace', label: text.confirm }, { id: 'cancel', label: text.cancel }]
    : entry.phase === 'uncertain' ? [{ id: 'reinspect', label: text.resolve }]
    : ['failed', 'unknown'].includes(entry.phase) ? [{ id: 'back', label: text.back }, { id: 'reinspect', label: text.reinspect }]
    : entry.phase === 'back' ? [{ id: 'reinspect', label: text.create }] : []
  const onAction = id => {
    if (id === 'request-replace') controller.requestReplace()
    else if (id === 'cancel') controller.cancelReplace()
    else if (id === 'back') controller.back()
    else if (id === 'reinspect') controller.recheck()
    else controller.submit(id)
  }
  const message = entry.phase === 'overwrite-confirm' ? text.overwrite : text[entry.phase] ?? ''
  const ui = <section className="save-entry" lang={language} data-save-entry-phase={entry.phase} data-save-entry-classification={entry.inspection?.classification ?? ''}>
    <p role="status" aria-live="polite">{message}</p>
    {warningMessages.map(message => <p key={message} role="status" className="save-entry-warning" data-save-entry-warning>{message}</p>)}
    {entry.reasons.length > 0 && <small data-save-entry-reasons>{entry.reasons.join(' / ')}</small>}
    {entries.length > 0 && <EntryButtonGroup key={`${entry.phase}:${entry.epoch}`} groupId={`save-entry:${entry.phase}:${entry.epoch}`}
      entries={entries.map(item => ({ ...item, disabled: ['create', 'continue'].includes(item.id) ? !entry.inspection?.allowedActions?.includes(item.id) : item.id === 'request-replace' ? !entry.inspection?.allowedActions?.includes('request-replace') : false }))} initialFocusId={entry.phase === 'overwrite-confirm' ? 'cancel' : entry.focusTarget ?? null} materialMode="background" className={entry.phase === 'overwrite-confirm' ? 'save-entry-confirm' : ''} onNavigate={onAction} />}
  </section>
  const Runtime = runtime?.Component
  return <>
    {Runtime && <Runtime key={runtime.sessionHandle.generation} initialSnapshot={runtime.snapshot} sessionHandle={runtime.sessionHandle}
      entryPhase={world.phase} onSceneReady={() => {
        const handle = runtime.sessionHandle
        controller.acknowledgeEntered({ abandon: reason => {
          const observer = runtimeObserver.current
          if (observer?.handle === handle) {
            if (observer.lifecycle.abandon(reason, { notifyUI: false }) === false) throw Error('SESSION_CLOSE_FAILED')
          } else closeRuntimeEntryHandle(handle)
        } }).then(ok => {
          if (ok && controller.getState().committed?.sessionHandle === handle) dispatch({ type: 'scene-ready' })
        })
      }} onRevealComplete={() => dispatch({ type: 'reveal-complete' })} />}
    {world.phase === 'active' && warningMessages.length > 0 && <aside className="save-entry-warning-overlay" style={warningStyle} lang={language}>
      {warningMessages.map(message => <p key={message} role="status" className="save-entry-warning" data-save-entry-warning>{message}</p>)}
    </aside>}
    {world.phase !== 'active' && <EntrySurface preferences={preferences} landingIntroPreview={entry.inspection?.preview?.landingIntro} inspectionSettled={entry.phase !== 'probing'} entryUI={ui} worldEntryPhase={world.phase}
      onWorldCoverComplete={() => dispatch({ type: 'cover-complete' })} />}
  </>
}

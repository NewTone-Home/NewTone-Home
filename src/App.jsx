import { useEffect, useReducer, useRef, useState } from 'react'
import RuntimeRecoveryBoundary from './components/RuntimeRecoveryBoundary'
import RuntimeRecoveryPanel from './components/RuntimeRecoveryPanel'
import { trackEvent } from './services/analytics'
import { createLandingEntryObserver } from './services/landingEntryObserver.mjs'
import { createRuntimeRecovery } from './services/runtimeRecovery.mjs'
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
  const landingObserver = useRef(null)
  if (!landingObserver.current) landingObserver.current = createLandingEntryObserver()
  const adopted = useRef(null)
  const runtimeObserver = useRef(null)
  const [recoveringRuntime, setRecoveringRuntime] = useState(false)
  const runtimeRecovery = useRef(null)
  if (!runtimeRecovery.current) runtimeRecovery.current = createRuntimeRecovery(evidence => {
    setRecoveringRuntime(true)
    setRuntime(null); setLandingIntroSession(null); dispatch({ type: 'reset' })
    controller.runtimeFailed(evidence)
  })
  const reportRuntimeFailure = (error, info = {}, handle = adopted.current) => {
    // Retain the real exception as console evidence as well as the first-cause record.
    console.error('NewTone runtime stopped', error, info)
    runtimeRecovery.current.report(error, info, handle, runtimeObserver.current)
  }
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
    runtimeRecovery.current.reset(handle)
    setRecoveringRuntime(false)
    const lifecycle = observeRuntimeEntry(handle, reason => {
      reportRuntimeFailure(reason, { stage: 'session-stop' }, handle)
    })
    runtimeObserver.current = { handle, lifecycle }
    try { handle.check() } catch (error) { reportRuntimeFailure(error, { stage: 'session-check' }, handle); return lifecycle.dispose }
    if (adopted.current !== handle) {
      adopted.current = handle
      try {
        setLandingIntroSession(handle.storage)
        const raw = result.snapshot.values?.['newtone-progress-v4']
        if (raw) { const prefs = JSON.parse(raw); setPreferences(entryPreferences(prefs)) }
      } catch (error) { reportRuntimeFailure(error, { stage: 'runtime-initialization' }, handle); return lifecycle.dispose }
    }
    import('./center/CenterExperience.jsx').then(module => {
      if (!live) return
      try {
        handle.check()
        setRuntime({ Component: module.default, snapshot: result.snapshot, sessionHandle: handle })
        dispatch({ type: 'start' })
      } catch (error) { reportRuntimeFailure(error, { stage: 'runtime-mount-check' }, handle) }
    }).catch(error => { if (live) reportRuntimeFailure(error, { stage: 'runtime-import' }, handle) })
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

  const displayedPreferences = entryPreferences(entry.phase !== 'entering' ? entry.inspection?.preview?.preferences ?? preferences : preferences)
  useEffect(() => {
    landingObserver.current.observe({ visible: !recoveringRuntime && world.phase !== 'active', previewReady: Boolean(entry.inspection?.preview), preferences: displayedPreferences, browserLanguages: navigator.languages || [navigator.language] })
  }, [entry.inspection, entry.phase, recoveringRuntime, world.phase, preferences])
  const { language, text } = entryPresentation(displayedPreferences, navigator.languages || [navigator.language])
  const warningMessages = entryWarningMessages(currentEntryWarnings(entry), language)
  const warningStyle = getReaderThemeVariables(migrateThemePosition(displayedPreferences.themePosition, displayedPreferences.standardTheme))
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
    else {
      const previous = controller.getState().phase
      controller.submit(id)
      if (previous !== 'committing' && controller.getState().phase === 'committing') trackEvent('center_entry_requested', { stepId: 'entry:center' })
    }
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
  const recoveryPanel = <RuntimeRecoveryPanel language={language} text={text} phase={entry.phase}
    evidence={entry.runtimeEvidence} style={warningStyle} warnings={warningMessages}
    onBack={() => { controller.back(); setRecoveringRuntime(false) }}
    onRecheck={() => { controller.recheck().then(() => {
      if (!['failed', 'uncertain', 'probing'].includes(controller.getState().phase)) setRecoveringRuntime(false)
    }) }} />
  return <>
    <RuntimeRecoveryBoundary resetKey={entry.committed?.sessionHandle ?? adopted.current} onError={reportRuntimeFailure}>
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
    </RuntimeRecoveryBoundary>
    {recoveringRuntime && recoveryPanel}
    {world.phase === 'active' && warningMessages.length > 0 && <aside className="save-entry-warning-overlay" style={warningStyle} lang={language}>
      {warningMessages.map(message => <p key={message} role="status" className="save-entry-warning" data-save-entry-warning>{message}</p>)}
    </aside>}
    {!recoveringRuntime && world.phase !== 'active' && <EntrySurface preferences={displayedPreferences} landingIntroPreview={entry.inspection?.preview?.landingIntro} inspectionSettled={entry.phase !== 'probing'} entryUI={ui} worldEntryPhase={world.phase}
      onWorldCoverComplete={() => dispatch({ type: 'cover-complete' })} />}
  </>
}

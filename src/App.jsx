import { useEffect, useReducer, useRef, useState } from 'react'
import RuntimeRecoveryBoundary, { boundaryRecoveryPresentation, runBoundaryRecoveryAction } from './components/RuntimeRecoveryBoundary'
import RuntimeRecoveryPanel from './components/RuntimeRecoveryPanel'
import { trackEvent } from './services/analytics'
import { createLandingEntryObserver } from './services/landingEntryObserver.mjs'
import { canAdoptRuntime } from './services/runtimeEntryIdentity.mjs'
import { createRuntimeRecovery } from './services/runtimeRecovery.mjs'
import EntrySurface from './components/EntrySurface'
import SaveEntryMenu from './components/SaveEntryMenu'
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
  const entryIntent = useRef('recovered')
  const enteredHandle = useRef(null)
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
    // An old committed render/effect is not permission to revive its handle.
    if (!canAdoptRuntime(controller.getState(), result, runtimeRecovery.current)) {
      const current = controller.getState()
      if (current.phase === 'entering' && current.committed === result && !runtimeRecovery.current.isTerminated(handle) && handle.isOpen === false) {
        reportRuntimeFailure(handle.stopReason ?? 'save-session-stopped', { stage: 'closed-before-adoption' }, handle)
      }
      return
    }
    if (!runtimeRecovery.current.reset(handle)) return
    try { handle.check() } catch (error) { reportRuntimeFailure(error, { stage: 'adoption-check' }, handle); return }
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
      if (!canAdoptRuntime(controller.getState(), result, runtimeRecovery.current)) {
        const current = controller.getState()
        if (current.phase === 'entering' && current.committed === result && !runtimeRecovery.current.isTerminated(handle) && handle.isOpen === false) reportRuntimeFailure(handle.stopReason ?? 'save-session-stopped', { stage: 'closed-before-import-complete' }, handle)
        return
      }
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
  const onAction = id => {
    if (id === 'request-replace') controller.requestReplace()
    else if (id === 'cancel') controller.cancelReplace()
    else if (id === 'back') controller.back()
    else if (id === 'reinspect') controller.recheck()
    else {
      const previous = controller.getState().phase
      controller.submit(id)
      if (previous !== 'committing' && controller.getState().phase === 'committing') {
        entryIntent.current = id
        trackEvent('center_entry_requested', { stepId: 'entry:center' })
        trackEvent('center_entry_action', { eventData: { intent: id } })
      }
    }
  }
  const ui = <SaveEntryMenu entry={entry} language={language} text={text}
    warnings={warningMessages} onAction={onAction} motionMode={displayedPreferences.motionMode} />
  const Runtime = entry.phase === 'entering' && !runtimeRecovery.current.isTerminated(runtime?.sessionHandle) ? runtime?.Component : null
  const recoveryPanel = <RuntimeRecoveryPanel language={language} text={text} phase={entry.phase}
    evidence={entry.runtimeEvidence} style={warningStyle} warnings={warningMessages}
    onBack={() => { controller.back(); setRecoveringRuntime(false) }}
    onRecheck={() => { controller.recheck().then(() => {
      if (!['failed', 'uncertain', 'probing'].includes(controller.getState().phase)) setRecoveringRuntime(false)
    }) }} />
  return <>
    <RuntimeRecoveryBoundary resetKey={entry.committed?.sessionHandle ?? adopted.current} onError={reportRuntimeFailure}
      renderFallback={boundaryEvidence => {
        // Render from the captured fault even if React has not committed the
        // parent's recovery update yet. Never expose stale entering/busy UI.
        if (recoveringRuntime) return null
        const current = controller.getState()
        const presentation = boundaryRecoveryPresentation(current, boundaryEvidence)
        if (!presentation) return null
        const fault = presentation.evidence
        return <RuntimeRecoveryPanel language={language} text={text}
          phase={presentation.phase} evidence={fault}
          style={warningStyle} warnings={warningMessages}
          onBack={() => { runBoundaryRecoveryAction(controller, fault, 'back'); setRecoveringRuntime(false) }}
          onRecheck={() => { runBoundaryRecoveryAction(controller, fault, 'recheck').then(() => {
            if (!['failed', 'uncertain', 'probing'].includes(controller.getState().phase)) setRecoveringRuntime(false)
          }) }} />
      }}>
    {Runtime && <Runtime key={runtime.sessionHandle.generation} initialSnapshot={runtime.snapshot} sessionHandle={runtime.sessionHandle}
      entryPhase={world.phase} onSceneReady={() => {
        const handle = runtime.sessionHandle
        controller.acknowledgeEntered({ abandon: reason => {
          const observer = runtimeObserver.current
          if (observer?.handle === handle) {
            if (observer.lifecycle.abandon(reason, { notifyUI: false }) === false) throw Error('SESSION_CLOSE_FAILED')
          } else closeRuntimeEntryHandle(handle)
        } }).then(ok => {
          if (ok && controller.getState().phase === 'entering' && controller.getState().committed?.sessionHandle === handle && !runtimeRecovery.current.isTerminated(handle)) dispatch({ type: 'scene-ready' })
        })
      }} onRevealComplete={() => {
        const handle = runtime.sessionHandle
        if (world.phase !== 'revealing' || !handle.isOpen || runtimeRecovery.current.isTerminated(handle)) return
        if (enteredHandle.current !== handle) {
          enteredHandle.current = handle
          trackEvent('center_entry_completed', { eventData: { intent: entryIntent.current } })
        }
        dispatch({ type: 'reveal-complete' })
      }} />}
    </RuntimeRecoveryBoundary>
    {recoveringRuntime && recoveryPanel}
    {world.phase === 'active' && warningMessages.length > 0 && <aside className="save-entry-warning-overlay" style={warningStyle} lang={language}>
      {warningMessages.map(message => <p key={message} role="status" className="save-entry-warning" data-save-entry-warning>{message}</p>)}
    </aside>}
    {!recoveringRuntime && world.phase !== 'active' && <EntrySurface preferences={displayedPreferences} landingIntroPreview={entry.inspection?.preview?.landingIntro} inspectionSettled={entry.phase !== 'probing'} entryUI={ui} worldEntryPhase={world.phase}
      onWorldCoverComplete={() => dispatch({ type: 'cover-complete' })} />}
  </>
}

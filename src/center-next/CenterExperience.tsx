import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../i18n/copy'
import { useProgressStore } from '../stores/progressStore'
import { useTransitionStore } from '../stores/transitionStore'
import type {
  CenterDefinition,
  CenterProjectionMap,
  LandmarkDefinition,
} from './domain/contracts'
import { resolveCenterWorld } from './domain/worldResolver'
import { getLocalizedCenterText } from './content/defaultCenterDefinition'
import { centerContentService, type CenterAssetUrlSet } from './content/CenterContentService'
import { CenterBridge } from './runtime/CenterBridge'
import { CenterGameHost } from './runtime/CenterGameHost'
import { CenterDeveloperTools } from './CenterDeveloperTools'
import './CenterExperience.css'

function CenterExperience() {
  const language = useProgressStore((state: any) => state.language)
  const packageId = useProgressStore((state: any) => state.centerContentPackageId)
  const committedLocation = useProgressStore((state: any) => state.committedLocation)
  const furthestLocation = useProgressStore((state: any) => state.furthestLocation)
  const world = useProgressStore((state: any) => state.centerWorldSnapshot)
  const view = useProgressStore((state: any) => state.centerViewSnapshot)
  const setWorld = useProgressStore((state: any) => state.setCenterWorldSnapshot)
  const updateView = useProgressStore((state: any) => state.updateCenterView)
  const commitCamera = useProgressStore((state: any) => state.commitCenterCamera)
  const visitLandmark = useProgressStore((state: any) => state.visitCenterLandmark)
  const selectLandmark = useProgressStore((state: any) => state.selectCenterLandmark)
  const commitLocation = useProgressStore((state: any) => state.commitLocation)
  const transitionTo = useTransitionStore((state: any) => state.transitionTo)
  const notifyTargetReady = useTransitionStore((state: any) => state.notifyTargetReady)

  const bridge = useMemo(() => new CenterBridge(), [])
  const [definition, setDefinition] = useState<CenterDefinition | null>(null)
  const [assetUrls, setAssetUrls] = useState<Record<string, string> | null>(null)
  const [loadError, setLoadError] = useState('')
  const [runtimeReady, setRuntimeReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedHoverId, setFocusedHoverId] = useState<string | null>(null)
  const [projections, setProjections] = useState<CenterProjectionMap>({})
  const hoverTimerRef = useRef<number | null>(null)
  const assetSetRef = useRef<CenterAssetUrlSet | null>(null)

  useEffect(() => {
    let cancelled = false
    setDefinition(null)
    setAssetUrls(null)
    setLoadError('')
    setRuntimeReady(false)
    assetSetRef.current?.release()
    assetSetRef.current = null

    void centerContentService.loadDefinition(packageId)
      .then(async nextDefinition => {
        if (cancelled) return
        const progress = useProgressStore.getState()
        setWorld(resolveCenterWorld({
          definition: nextDefinition,
          committedLocation: progress.committedLocation,
          furthestLocation: progress.furthestLocation,
          visitedLandmarkIds: progress.centerWorldSnapshot?.visitedLandmarkIds,
        }))
        const nextAssets = await centerContentService.resolveAssetUrls(packageId, nextDefinition)
        if (cancelled) {
          nextAssets.release()
          return
        }
        assetSetRef.current = nextAssets
        setDefinition(nextDefinition)
        setAssetUrls(nextAssets.urls)
      })
      .catch(error => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : '世界中枢载入失败')
        notifyTargetReady('center')
      })

    return () => {
      cancelled = true
      assetSetRef.current?.release()
      assetSetRef.current = null
    }
  }, [notifyTargetReady, packageId, setWorld])

  useEffect(() => {
    if (!definition) return
    const progress = useProgressStore.getState()
    setWorld(resolveCenterWorld({
      definition,
      committedLocation,
      furthestLocation,
      visitedLandmarkIds: progress.centerWorldSnapshot?.visitedLandmarkIds,
    }))
  }, [committedLocation, definition, furthestLocation, setWorld])

  useEffect(() => bridge.subscribe(event => {
    if (event.type === 'runtime/ready') {
      setRuntimeReady(true)
      notifyTargetReady('center')
      return
    }
    if (event.type === 'runtime/error') {
      setLoadError(event.message)
      notifyTargetReady('center')
      return
    }
    if (event.type === 'projection/update') {
      setProjections(event.anchors)
      return
    }
    if (event.type === 'camera/commit') {
      commitCamera(event.camera)
      return
    }
    if (event.type === 'view/commit') {
      updateView(event.view)
      return
    }
    if (event.type === 'landmark/open') {
      visitLandmark(event.landmarkId)
      selectLandmark(event.landmarkId)
      return
    }
    if (event.type === 'landmark/hover') {
      setHoveredId(event.landmarkId)
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
      if (!event.landmarkId) {
        setFocusedHoverId(null)
        return
      }
      const id = event.landmarkId
      hoverTimerRef.current = window.setTimeout(() => setFocusedHoverId(id), 520)
    }
  }), [bridge, commitCamera, notifyTargetReady, selectLandmark, updateView, visitLandmark])

  useEffect(() => () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
    bridge.destroy()
  }, [bridge])

  const selected = definition?.landmarks.find(item => item.id === view.selectedLandmarkId) ?? null
  const annotation = !selected
    ? definition?.landmarks.find(item => item.id === focusedHoverId) ?? null
    : null
  const t = copy[language]

  const returnLanding = useCallback(() => {
    selectLandmark(null)
    transitionTo('landing', { preset: 'core-to-surface' })
  }, [selectLandmark, transitionTo])

  const continueReader = useCallback(() => {
    selectLandmark(null)
    transitionTo('reader', { preset: 'core-to-reader', payload: { mode: 'continue' } })
  }, [selectLandmark, transitionTo])

  const openReaderTarget = useCallback((landmark: LandmarkDefinition) => {
    if (landmark.contentTarget?.position) commitLocation(landmark.contentTarget.position)
    continueReader()
  }, [commitLocation, continueReader])

  if (loadError) {
    return (
      <main className="center-next center-next--error">
        <h1>世界中枢暂时没有展开</h1>
        <p>{loadError}</p>
        <button type="button" onClick={continueReader}>{t.continueReading}</button>
      </main>
    )
  }

  if (!definition || !world || !assetUrls) {
    return <main className="center-next center-next--loading">正在展开两层世界…</main>
  }

  return (
    <main
      className="center-next"
      data-runtime-ready={runtimeReady ? 'true' : 'false'}
      data-hovered-landmark={hoveredId ?? ''}
    >
      <CenterGameHost
        bridge={bridge}
        definition={definition}
        world={world}
        view={view}
        assetUrls={assetUrls}
      />

      <header className="center-next-header">
        <button type="button" onClick={returnLanding}>{t.backToLanding}</button>
        <p>{getLocalizedCenterText(definition.title, language)}</p>
        <button type="button" onClick={continueReader}>{t.continueReading}</button>
      </header>

      <nav className="center-next-layer-control" aria-label="世界图层">
        <button
          type="button"
          data-active={view.activeLayer === 'surface'}
          onClick={() => updateView({ activeLayer: view.activeLayer === 'surface' ? null : 'surface' })}
        >表</button>
        <button
          type="button"
          data-active={view.activeLayer === null}
          onClick={() => updateView({ activeLayer: null })}
        >合</button>
        <button
          type="button"
          data-active={view.activeLayer === 'inner'}
          onClick={() => updateView({ activeLayer: view.activeLayer === 'inner' ? null : 'inner' })}
        >里</button>
        <button
          type="button"
          aria-label="切换世界展开程度"
          onClick={() => updateView({ expansion: view.expansion > 0.5 ? 0.24 : 0.68 })}
        >↕</button>
      </nav>

      {annotation && projections[annotation.id] && (
        <aside
          className="center-next-annotation"
          style={{ left: projections[annotation.id].x, top: projections[annotation.id].y }}
          aria-hidden="true"
        >
          <strong>{getLocalizedCenterText(annotation.title, language)}</strong>
          <span>{getLocalizedCenterText(annotation.annotation, language)}</span>
        </aside>
      )}

      {selected && (
        <aside className="center-next-detail" aria-label={getLocalizedCenterText(selected.title, language)}>
          <div className="center-next-detail-sheet">
            <p>{selected.layer === 'surface' ? '表世界' : '里世界'}</p>
            <h2>{getLocalizedCenterText(selected.title, language)}</h2>
            <article>{getLocalizedCenterText(selected.annotation, language)}</article>
            <footer>
              {selected.contentTarget?.position && (
                <button type="button" onClick={() => openReaderTarget(selected)}>回到这一处</button>
              )}
              <button type="button" onClick={() => selectLandmark(null)}>收起</button>
            </footer>
          </div>
        </aside>
      )}

      <CenterDeveloperTools />
    </main>
  )
}

export default CenterExperience

import { useCallback, useEffect, useState } from 'react'
import { MainlineScenePage } from './runtime/MainlineScenePage'
import { WorldPhone } from './runtime/WorldPhone'
import {
  mainlineRespawnSceneId,
  mainlineSceneRoute,
  resolveMainlineSceneId,
} from './runtime/mainlineScenes'
import {
  phoneRideAvailability,
  worldLayerForScene,
} from './runtime/phoneState'
import {
  loadCarriedPhoneDevice,
  loadScenePosition,
  persistCarriedPhoneDevice,
  persistScenePosition,
} from './runtime/mainlineRuntimePersistence'
import './runtime/scene.css'
import './CenterExperience.css'

const initialSceneId = mainlineRespawnSceneId

function readSceneFromLocation() {
  const sceneId = resolveMainlineSceneId(window.location.search)
  return sceneId || initialSceneId
}

function createRoute(sceneId, entryPosition, spawnMode = 'resume') {
  return { sceneId, entryPosition, spawnMode }
}

export default function CenterExperience() {
  const [route, setRoute] = useState(() => createRoute(readSceneFromLocation()))
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneDevice, setPhoneDevice] = useState(() => loadCarriedPhoneDevice(route.sceneId))
  const [resumeSceneId, setResumeSceneId] = useState(null)
  const [resumePosition, setResumePosition] = useState(undefined)
  const [boundaryNotice, setBoundaryNotice] = useState('')

  const revealPhone = useCallback(() => setPhoneOpen(true), [])
  const retractPhone = useCallback(() => setPhoneOpen(false), [])

  useEffect(() => {
    setPhoneDevice(loadCarriedPhoneDevice(route.sceneId))
  }, [route.sceneId])

  useEffect(() => {
    persistCarriedPhoneDevice(phoneDevice, route.sceneId)
  }, [phoneDevice, route.sceneId])

  useEffect(() => {
    setBoundaryNotice('')
    setResumeSceneId(null)
    setResumePosition(undefined)
    if (route.spawnMode === 'ride' || route.entryPosition) return
    setResumePosition(loadScenePosition(route.sceneId))
    setResumeSceneId(route.sceneId)
  }, [route.sceneId, route.entryPosition?.x, route.entryPosition?.y, route.spawnMode])

  const switchCarriedPhone = useCallback((device) => {
    setPhoneDevice(device)
    persistCarriedPhoneDevice(device, route.sceneId)
    setPhoneOpen(true)
  }, [route.sceneId])

  const handleSceneTransition = useCallback((nextSceneId, nextEntryPosition, nextSpawnMode) => {
    const nextRoute = createRoute(nextSceneId, nextEntryPosition, nextSpawnMode || 'resume')
    persistCarriedPhoneDevice(phoneDevice, nextSceneId)
    window.history.pushState(
      { newtoneCenterScene: nextSceneId },
      '',
      mainlineSceneRoute(nextSceneId, nextEntryPosition, nextRoute.spawnMode),
    )
    setRoute(nextRoute)
  }, [phoneDevice])

  const handleSafeSpawnCorrection = useCallback((position) => {
    if (!route.entryPosition) return
    const nextRoute = createRoute(route.sceneId, position, route.spawnMode)
    window.history.replaceState(
      { newtoneCenterScene: route.sceneId },
      '',
      mainlineSceneRoute(route.sceneId, position, route.spawnMode),
    )
    setRoute(nextRoute)
  }, [route.entryPosition, route.sceneId, route.spawnMode])

  const handleRideRequest = useCallback((device) => {
    const layer = worldLayerForScene(route.sceneId)
    if (phoneRideAvailability(device, layer) !== 'available') return
    setPhoneOpen(false)
    setBoundaryNotice('叫车功能已接通，后续内容暂未开放。')
  }, [route.sceneId])

  const canPersistScenePosition = Boolean(
    route.entryPosition
      || route.spawnMode === 'ride'
      || resumeSceneId === route.sceneId,
  )
  const handlePositionChange = useCallback((position) => {
    if (canPersistScenePosition) persistScenePosition(route.sceneId, position)
  }, [canPersistScenePosition, route.sceneId])

  return (
    <main className="center-experience" data-center-boundary="inner-phone-ride-ready">
      <MainlineScenePage
        key={`${route.sceneId}:${route.entryPosition?.x ?? ''}:${route.entryPosition?.y ?? ''}:${route.spawnMode}:${resumePosition?.x ?? ''}:${resumePosition?.y ?? ''}`}
        sceneId={route.sceneId}
        onExternalExit={revealPhone}
        onExternalReturn={retractPhone}
        phoneOpen={phoneOpen}
        onPhoneDismiss={retractPhone}
        onDeskInteraction={switchCarriedPhone}
        carriedPhoneDevice={phoneDevice}
        onSceneTransition={handleSceneTransition}
        onSafeSpawnCorrection={handleSafeSpawnCorrection}
        onPositionChange={canPersistScenePosition ? handlePositionChange : undefined}
        entryPosition={route.entryPosition}
        spawnMode={route.spawnMode}
        resumePosition={resumePosition}
        showSceneChrome={false}
      />
      <WorldPhone
        currentSceneId={route.sceneId}
        worldLayer={worldLayerForScene(route.sceneId)}
        device={phoneDevice}
        open={phoneOpen}
        onOpen={revealPhone}
        onClose={retractPhone}
        onRideRequest={handleRideRequest}
      />
      {boundaryNotice && (
        <div className="center-experience__boundary" role="status" aria-live="polite">
          {boundaryNotice}
        </div>
      )}
    </main>
  )
}

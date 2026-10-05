'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type AnimationEvent as ReactAnimationEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react'
import { mainlineMapLandmarksByWorld, mainlineMapLayout, type MainlineMapLandmark, type MainlineSceneId } from './mainlineScenes'
import { sceneInteractionHandlers } from './sceneInteraction'
import { phoneInputOwner, phoneIsOnline, phoneRideAvailability, type PhoneDevice, type WorldLayer, type WorldPhonePhase } from './phoneState'
import { commercialStreetMilkTeaQueueStatus, formatCommercialStreetMilkTeaOrderNumber, milkTeaDrinks, milkTeaIceOptions, milkTeaSugarOptions, type CommercialStreetMilkTeaOrder, type MilkTeaDrink, type MilkTeaIce, type MilkTeaSugar } from './commercialStreetMilkTea'

import { mainlineRideWaitingGuidance, type MainlineRideOrder } from './mainlineRide'
import type { PhoneNotification } from './phoneNotifications'

type PhoneApp = 'map' | 'ride' | 'contacts' | 'feedback' | 'milk-tea'
type FeedbackMode = 'phone'
type FeedbackPayload = {
  freeText: string
  source: FeedbackMode
}
type FeedbackSubmitResult = { ok: boolean; reason?: string }
type MapPoint = readonly [number, number]
type MapDragState = { active: boolean; moved: boolean; pointerId: number; start: MapPoint | null; origin: MapPoint | null }
type ContactView = 'list' | 'messages'
type ContactId = 'lao-zhou' | 'ruo-yu'

type ContactDefinition = {
  id: ContactId
  name: string
  detail: string
  messages: readonly string[]
}

const innerContacts: readonly ContactDefinition[] = [
  {
    id: 'lao-zhou',
    name: '老周',
    detail: '中枢院 · 联系人',
    messages: ['陈副部长失踪了。', '什么时候有空。', '周六。', '老地方。', '好。'],
  },
  {
    id: 'ruo-yu',
    name: '若雨',
    detail: '联系人',
    messages: ['帮我查一下陈副部长这件事。', '陈副部长？出什么事了？', '你查就知道了。什么时候有空。', '周六。', '老地方。', '好的。'],
  },
]

const serverPhoneTime = { clock: '时间读取中', date: '今天' }
const clientPhoneTime = typeof window === 'undefined'
  ? serverPhoneTime
  : (() => {
    const now = new Date()
    return { clock: formatClock(now), date: formatDate(now) }
  })()

function subscribeToPhoneTime() {
  return () => undefined
}

function usePhoneTime() {
  return useSyncExternalStore(subscribeToPhoneTime, () => clientPhoneTime, () => serverPhoneTime)
}

type WorldPhoneProps = {
  currentSceneId: string
  worldLayer: WorldLayer
  device: PhoneDevice
  open: boolean
  onOpen: () => void
  onClose: () => void
  onCloseComplete?: () => void
  rideOrder?: MainlineRideOrder | null
  notifications?: readonly PhoneNotification[]
  notificationScreen?: boolean
  onNotificationDismiss?: () => void
  onAppOpen?: (app: PhoneApp) => void
  onRideRequest?: (device: PhoneDevice, destinationSceneId: MainlineSceneId) => void
  feedbackMode?: FeedbackMode | null
  onFeedbackModeChange?: (mode: FeedbackMode | null) => void
  onFeedbackOpen?: () => void
  onFeedbackSubmit?: (payload: FeedbackPayload) => Promise<FeedbackSubmitResult>
  milkTeaAppUnlocked?: boolean
  milkTeaOrder?: CommercialStreetMilkTeaOrder | null
  milkTeaHeld?: boolean
  requestedApp?: 'milk-tea' | null
  onRequestedAppHandled?: () => void
  onMilkTeaOrderConfirm?: (selection: { drink: MilkTeaDrink; sugar: MilkTeaSugar; ice: MilkTeaIce }) => void
  onMilkTeaOrderStarted?: () => void
  onMeaningfulActivity?: () => void
}

type RideDestination = MainlineMapLandmark & { sceneId: MainlineSceneId }

function landmarkForScene(sceneId: string): { device: PhoneDevice; id: string } | null {
  if (sceneId === 'jijia-ancestral-home' || sceneId === 'jijia-ancestral-interior') return { device: 'surface', id: 'jijia' }
  if (sceneId === 'commercial-street' || sceneId === 'commercial-cafe') return { device: 'inner', id: 'commercial' }
  if (sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery') return { device: 'inner', id: 'mine' }
  if (sceneId === 'zhongshuyuan-office') return { device: 'inner', id: 'zhongshuyuan' }
  return null
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}

function memoForDevice(device: PhoneDevice) {
  return device === 'surface'
    ? { title: '当前任务', body: '去里世界商业街咖啡馆找老周。' }
    : { title: '当前任务', body: '去商业街咖啡馆找老周。' }
}

function FeedbackApp({
  mode,
  onSubmit,
  onFinish,
}: {
  mode: FeedbackMode
  onSubmit?: (payload: FeedbackPayload) => Promise<FeedbackSubmitResult>
  onFinish: () => void
}) {
  const [freeText, setFreeText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onSubmit || submitting) return
    setSubmitting(true)
    setError('')
    const result = await onSubmit({
      freeText,
      source: mode,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.reason === 'empty-feedback' ? '先写下一点内容。' : '暂时没有提交成功，请稍后再试。')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="world-phone__feedback world-phone__feedback--result" aria-live="polite">
        <span className="world-phone__feedback-kicker">反馈</span>
        <strong>有任何反馈，可以在手机里面找到入口。</strong>
        <div className="world-phone__feedback-actions">
          <button type="button" onClick={onFinish}>返回手机</button>
        </div>
      </section>
    )
  }

  return (
    <form className="world-phone__feedback" onSubmit={submit}>
      <span className="world-phone__feedback-kicker">反馈</span>
      <p className="world-phone__feedback-intro">有什么想说的，可以写在这里。</p>
      <textarea className="world-phone__feedback-textarea" value={freeText} maxLength={2000} onChange={event => setFreeText(event.target.value)} placeholder="写下你的反馈" aria-label="自定义反馈" />
      {error && <p className="world-phone__feedback-error" role="alert">{error}</p>}
      <button className="world-phone__feedback-submit" type="submit" disabled={submitting}>{submitting ? '提交中…' : '提交反馈'}</button>
    </form>
  )
}

export function WorldPhone({ currentSceneId, worldLayer, device, open, onOpen, onClose, onCloseComplete, onRideRequest, rideOrder = null, notifications = [], notificationScreen = false, onNotificationDismiss, onAppOpen, feedbackMode = null, onFeedbackModeChange, onFeedbackOpen, onFeedbackSubmit, milkTeaAppUnlocked = false, milkTeaOrder = null, milkTeaHeld = false, requestedApp = null, onRequestedAppHandled, onMilkTeaOrderConfirm, onMilkTeaOrderStarted, onMeaningfulActivity }: WorldPhoneProps) {
  const currentLandmark = landmarkForScene(currentSceneId)
  const [displayDevice, setDisplayDevice] = useState<PhoneDevice>(device)
  const [phase, setPhase] = useState<WorldPhonePhase>('closed')
  const [activeApp, setActiveApp] = useState<PhoneApp | null>(null)
  const [contactView, setContactView] = useState<ContactView>('list')
  const [selectedContactId, setSelectedContactId] = useState<ContactId>('lao-zhou')
  const [selectedMapLandmarkId, setSelectedMapLandmarkId] = useState<string | null>(null)
  const [selectedRideDestinationId, setSelectedRideDestinationId] = useState<string | null>(null)
  const [milkTeaDrink, setMilkTeaDrink] = useState<MilkTeaDrink | null>(null)
  const [milkTeaSugar, setMilkTeaSugar] = useState<MilkTeaSugar | null>(null)
  const [milkTeaIce, setMilkTeaIce] = useState<MilkTeaIce | null>(null)
  const milkTeaOrderStartedRef = useRef(false)
  const openSessionRef = useRef(false)
  const closeCompletionReportedRef = useRef(false)
  const closeTransitionStartedRef = useRef(false)
  const [mapPan, setMapPan] = useState<MapPoint>([0, 0])
  const [milkTeaClock, setMilkTeaClock] = useState(() => Date.now())
  const [rideClock, setRideClock] = useState(() => Date.now())
  useEffect(() => {
    if (!rideOrder) return
    let timer = 0
    const update = () => {
      const now = Date.now()
      setRideClock(now)
      if (now < rideOrder.driverArrivesAt) timer = window.setTimeout(update, Math.min(1000, rideOrder.driverArrivesAt - now))
    }
    update()
    return () => window.clearTimeout(timer)
  }, [rideOrder])
  const mapDragRef = useRef<MapDragState>({ active: false, moved: false, pointerId: -1, start: null, origin: null })
  const phoneTime = usePhoneTime()

  const swapPending = displayDevice !== device
  const renderedPhase: WorldPhonePhase = swapPending
    ? phase === 'closed'
      ? 'swap-retracting'
      : phase === 'opening' || phase === 'open'
        ? 'closing'
        : phase
    : !open && (phase === 'opening' || phase === 'open')
      ? 'closing'
      : open && phase === 'closed'
        ? 'opening'
        : phase
  const isInteractive = renderedPhase === 'opening' || renderedPhase === 'open'
  const inputOwner = phoneInputOwner(renderedPhase)
  const handleIsInteractive = inputOwner === 'handle'
  const online = phoneIsOnline(displayDevice, worldLayer)
  const mapLandmarks = mainlineMapLandmarksByWorld[displayDevice]
  const rideAvailability = phoneRideAvailability(displayDevice, worldLayer)
  const rideDestinations = online
    ? mapLandmarks.filter((landmark): landmark is RideDestination => (
      landmark.sceneId !== undefined && landmark.id !== currentLandmark?.id
    ))
    : []
  const selectedRideDestination = rideDestinations.find((landmark) => landmark.id === selectedRideDestinationId) ?? rideDestinations[0] ?? null
  const activeAppLabel = activeApp === 'map' ? '地图' : activeApp === 'ride' ? '叫车' : activeApp === 'contacts' ? contactView === 'messages' ? '短信' : '联系人' : activeApp === 'feedback' ? '反馈' : activeApp === 'milk-tea' ? '奶茶' : ''
  const batteryPercent = 72
  const isMapOpen = !notificationScreen && activeApp === 'map'
  const memo = memoForDevice(displayDevice)
  const selectedContact = innerContacts.find((contact) => contact.id === selectedContactId) ?? innerContacts[0]

  // The parent may close the Phone in the first interactable frame of its
  // opening transition. Remember that a visible session exists during render
  // itself, rather than waiting for a later CSS completion event.
  if (open) {
    openSessionRef.current = true
    closeCompletionReportedRef.current = false
  }

  const completePhoneClose = useCallback(() => {
    if (closeCompletionReportedRef.current) return
    closeCompletionReportedRef.current = true
    openSessionRef.current = false
    onCloseComplete?.()
  }, [onCloseComplete])

  // `renderedPhase` can make the Phone visible before its transition-end
  // callback advances the stored phase. Commit that opening phase before the
  // next input frame, so an immediate Ride selection still has the ordinary
  // closing lifecycle and can release LONG_DISTANCE_TRAVEL through
  // `onCloseComplete`.
  useLayoutEffect(() => {
    if (!swapPending && open && phase === 'closed') setPhase('opening')
  }, [open, phase, swapPending])

  useEffect(() => {
    // If an opening was immediately reversed before the stored phase could
    // become `opening`, there is no closing transition to end. This is still
    // one completed Phone close, so release the parent lifecycle exactly once.
    if (open || phase !== 'closed' || !openSessionRef.current || closeCompletionReportedRef.current) return
    completePhoneClose()
  }, [completePhoneClose, open, phase])

  useEffect(() => {
    if (open || renderedPhase !== 'closing') return undefined
    closeTransitionStartedRef.current = false
    let firstFrame = 0
    let secondFrame = 0
    // An opening can be reversed before the browser ever starts a CSS
    // transition. In that case no transition-end event exists to own release;
    // observe two paints and complete only when no transform transition began.
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (closeTransitionStartedRef.current) return
        setPhase('closed')
        completePhoneClose()
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [completePhoneClose, open, renderedPhase])


  const openApp = (app: PhoneApp) => {
    onAppOpen?.(app)
    setActiveApp(app)
    if (app !== 'contacts') setContactView('list')
  }

  const closeApp = () => {
    if (activeApp === 'feedback') onFeedbackModeChange?.(null)
    setActiveApp(null)
    setContactView('list')
  }

  useEffect(() => {
    if (feedbackMode) setActiveApp('feedback')
  }, [feedbackMode])

  useEffect(() => {
    if (!open || requestedApp !== 'milk-tea' || !milkTeaAppUnlocked) return
    onAppOpen?.('milk-tea')
    setActiveApp('milk-tea')
    onRequestedAppHandled?.()
  }, [milkTeaAppUnlocked, onAppOpen, onRequestedAppHandled, open, requestedApp])

  useEffect(() => {
    if (activeApp !== 'milk-tea') milkTeaOrderStartedRef.current = false
  }, [activeApp])

  useEffect(() => {
    if (activeApp !== 'milk-tea' || !milkTeaOrder) return
    const refreshAtReady = () => setMilkTeaClock(Date.now())
    const remainingMs = milkTeaOrder.readyAt - Date.now()
    if (remainingMs <= 0) {
      refreshAtReady()
      return
    }
    const timer = window.setTimeout(refreshAtReady, remainingMs)
    return () => window.clearTimeout(timer)
  }, [activeApp, milkTeaOrder?.number, milkTeaOrder?.readyAt])

  useEffect(() => { if (!open || notificationScreen) setActiveApp(null) }, [open, notificationScreen])

  const selectMilkTeaDrink = (drink: MilkTeaDrink) => {
    if (!milkTeaOrderStartedRef.current) {
      milkTeaOrderStartedRef.current = true
      onMilkTeaOrderStarted?.()
    }
    setMilkTeaDrink(drink)
  }

  const handleBodyTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (renderedPhase === 'closing') {
      if (swapPending) setDisplayDevice(device)
      setPhase(open ? 'opening' : 'closed')
      if (!open) completePhoneClose()
      return
    }
    if (renderedPhase === 'opening') setPhase('open')
  }

  const handleBodyTransitionRun = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (renderedPhase === 'closing') closeTransitionStartedRef.current = true
  }

  const handleBodyTransitionCancel = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || renderedPhase !== 'closing') return
    setPhase('closed')
    completePhoneClose()
  }

  const handleSwapRetractEnd = (event: ReactAnimationEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== 'world-phone-swap-retract' || renderedPhase !== 'swap-retracting') return
    setDisplayDevice(device)
    setPhase(open ? 'opening' : 'closed')
  }

  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    mapDragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      start: [event.clientX, event.clientY],
      origin: mapPan,
    }
  }

  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current
    if (!drag.active || drag.pointerId !== event.pointerId || !drag.start || !drag.origin) return
    const deltaX = event.clientX - drag.start[0]
    const deltaY = event.clientY - drag.start[1]
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true
    setMapPan([drag.origin[0] + deltaX, drag.origin[1] + deltaY])
  }

  const handleMapPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current
    if (drag.pointerId !== event.pointerId) return
    drag.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleMapLandmarkClick = (landmarkId: string) => {
    if (mapDragRef.current.moved) {
      mapDragRef.current.moved = false
      return
    }
    setSelectedMapLandmarkId(landmarkId)
  }

  const selectedMapLandmark = mapLandmarks.find((landmark) => landmark.id === selectedMapLandmarkId) ?? null
  const statusDetail = displayDevice === 'inner'
    ? '晴天第1天 · 22°C'
    : `${phoneTime.date} · 晴 22°C`

  return (
    <aside
      {...sceneInteractionHandlers}
      className={`world-phone world-phone--${displayDevice} world-phone--phase-${renderedPhase} ${isInteractive ? 'is-open' : ''} ${isMapOpen ? 'world-phone--map-app' : ''}`}
      data-phone-open={open}
      data-phone-phase={renderedPhase}
      data-phone-device={displayDevice}
      data-world-layer={worldLayer}
      onClickCapture={onMeaningfulActivity}
      onKeyDownCapture={onMeaningfulActivity}
    >
      <button
        className="world-phone__handle"
        type="button"
        aria-hidden={!handleIsInteractive}
        aria-label="打开手机"
        disabled={!handleIsInteractive}
        tabIndex={handleIsInteractive ? 0 : -1}
        onAnimationEnd={handleSwapRetractEnd}
        onClick={handleIsInteractive ? onOpen : undefined}
      >
        <span className="world-phone__handle-mark" aria-hidden="true" />
      </button>

      <div className="world-phone__body" onTransitionEnd={handleBodyTransitionEnd} onTransitionRun={handleBodyTransitionRun} onTransitionCancel={handleBodyTransitionCancel}>
        <div className="world-phone__hardware" aria-hidden="true">
          <span className="world-phone__earpiece" />
          <span className="world-phone__camera" />
          <span className="world-phone__brand">NEWTONE</span>
          <span className="world-phone__side-buttons" />
        </div>
        <section className={`world-phone__panel ${isMapOpen ? 'world-phone__panel--map' : ''}`} role="dialog" aria-label="手机" aria-hidden={!isInteractive}>
          {!isMapOpen && <header className="world-phone__header">
            <div>
              <span className="world-phone__carrier">NEWTONE</span>
            </div>
            <div className="world-phone__status" aria-label={`${online ? '有信号' : '无信号'}，电量${batteryPercent}%`}>
              <span className={`world-phone__signal-bars ${online ? 'is-online' : 'is-offline'}`} aria-label={online ? '有信号' : '无信号'}>
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <i aria-hidden="true" />
              </span>
              <span className="world-phone__battery" aria-hidden="true"><i style={{ width: `${batteryPercent}%` }} /></span>
              <span>{batteryPercent}%</span>
            </div>
            <div className="world-phone__header-actions">
              <button className="world-phone__close" type="button" aria-label="收起手机" onClick={onClose}>×</button>
            </div>
          </header>}

          {!isMapOpen && <div className="world-phone__world-status">
            <span>{phoneTime.clock}</span>
            <span>{statusDetail}</span>
          </div>}

          {notificationScreen ? (
            <section className="world-phone__lock-screen" aria-label="手机通知" onClick={() => { setActiveApp(null); onNotificationDismiss?.() }}>
              <span className="world-phone__lock-hint">点击空白进入手机</span>
              {notifications.filter(n => n.unread).map(n => <button type="button" className="world-phone__notification" data-notification-app={n.app} key={n.id} onClick={event => { event.stopPropagation(); openApp(n.app) }}><strong>{n.title}</strong><span>{n.body}</span></button>)}
            </section>
          ) : activeApp === null ? (
            <section className="world-phone__home-screen" aria-label="手机主屏">
              <div className="world-phone__home-layout">
                <section className="world-phone__home-memo" aria-label="备忘录">
                  <span>备忘录</span>
                  <strong>{memo.title}</strong>
                  <p>{memo.body}</p>
                  <small>{phoneTime.date} · 今日事项</small>
                </section>
                <nav className="world-phone__apps" aria-label="手机应用">
                  <button type="button" data-app="map" onClick={() => openApp('map')}>
                    <span className="world-phone__app-icon" aria-hidden="true">⌖</span>
                    <span className="world-phone__app-label">地图</span>
                  </button>
                  <button type="button" data-app="ride" data-unread={notifications.some(n => n.app === 'ride' && n.unread)} onClick={() => openApp('ride')}>
                    <span className="world-phone__app-icon" aria-hidden="true">↗</span>
                    <span className="world-phone__app-label">叫车</span>
                  </button>
                  {milkTeaAppUnlocked && <button type="button" data-app="milk-tea" data-unread={notifications.some(n => n.app === 'milk-tea' && n.unread)} onClick={() => openApp('milk-tea')}>
                    <span className="world-phone__app-icon" aria-hidden="true">杯</span>
                    <span className="world-phone__app-label">奶茶</span>
                  </button>}
                  <button type="button" data-app="contacts" onClick={() => openApp('contacts')}>
                    <span className="world-phone__app-icon" aria-hidden="true">人</span>
                    <span className="world-phone__app-label">联系人</span>
                  </button>
                  <button type="button" data-app="feedback" onClick={() => { onFeedbackOpen?.(); onFeedbackModeChange?.('phone'); openApp('feedback') }}>
                    <span className="world-phone__app-icon" aria-hidden="true">意</span>
                    <span className="world-phone__app-label">反馈</span>
                  </button>
                </nav>
              </div>
            </section>
          ) : (
            <>
              <div className="world-phone__app-bar">
                <button className="world-phone__app-back" type="button" onClick={activeApp === 'contacts' && contactView === 'messages' ? () => setContactView('list') : closeApp} aria-label={activeApp === 'contacts' && contactView === 'messages' ? '返回联系人' : '返回手机主屏'}>⌂</button>
                <div><span>NEWTONE APP</span><strong>{activeAppLabel}</strong></div>
              </div>
              <div className="world-phone__app-view">
            {activeApp === 'map' && (
              <div className="world-phone__map-frame">
                <div className="world-phone__map-title">{online ? '地图' : '地图 · 离线'}</div>
                <div
                  className="world-phone__map-viewport"
                  onPointerDown={handleMapPointerDown}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  onPointerCancel={handleMapPointerUp}
                >
                <svg className="world-phone__map" viewBox={mainlineMapLayout.viewBox} role="group" aria-label="世界地图，拖动查看，点击地点查看详情" data-map-world={displayDevice} style={{ transform: `translate(${mapPan[0]}px, ${mapPan[1]}px)` }}>
                  {mapLandmarks.map((landmark) => {
                    const active = currentLandmark?.device === displayDevice && landmark.id === currentLandmark.id
                    const [x, y] = landmark.position
                    return (
                      <g
                        className={`world-phone__landmark ${active ? 'is-active' : ''}`}
                        data-map-landmark={landmark.id}
                        data-scene-id={landmark.sceneId}
                        data-map-interactive="true"
                        role="button"
                        tabIndex={0}
                        aria-label={`${landmark.label}，点击查看详情`}
                        onPointerDown={(event) => { event.stopPropagation(); setSelectedMapLandmarkId(landmark.id) }}
                        onClick={() => handleMapLandmarkClick(landmark.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleMapLandmarkClick(landmark.id) }}
                        key={landmark.id}
                      >
                        <rect className="world-phone__landmark-shadow" x={x - 5} y={y - 5} width="10" height="10" />
                        <rect className="world-phone__landmark-block" x={x - 3} y={y - 3} width="6" height="6" />
                        <rect className="world-phone__landmark-core" x={x - 1} y={y - 1} width="2" height="2" />
                        <text className="world-phone__landmark-label" x={x} y={y + 12} textAnchor="middle">{landmark.label}</text>
                      </g>
                    )
                  })}
                </svg>
                </div>
                {selectedMapLandmark && (
                  <section className="world-phone__map-detail" aria-live="polite">
                    <span>地点详情</span>
                    <strong>{selectedMapLandmark.label}</strong>
                    <p>{selectedMapLandmark.sceneId ? '可进入该地点对应场景。' : '当前只显示地点信息，暂未开放直接进入。'}</p>
                  </section>
                )}
                {!online && <p className="world-phone__offline-note">当前为离线地图，显示已缓存路线。</p>}
              </div>
            )}

            {activeApp === 'ride' && (
              <section className="world-phone__list-page" aria-label="叫车">
                {rideOrder && <div className="world-phone__list-heading" data-ride-order="true" aria-live="polite"><strong>{rideClock < rideOrder.driverArrivesAt ? `司机预计 ${Math.ceil((rideOrder.driverArrivesAt - rideClock) / 1000)} 秒后到达` : '司机已到达，正在' + mainlineRideWaitingGuidance(rideOrder.sourceSceneId).waitingLabel + '等候'}</strong><small>{mainlineRideWaitingGuidance(rideOrder.sourceSceneId).guidanceText}</small></div>}
                <div className="world-phone__list-heading">
                  <span>叫车服务</span>
                  <strong>目的地</strong>
                </div>
                <ul className="world-phone__list">
                  {!online ? (
                    <li className="world-phone__list-row">
                      <span><strong>当前无网络</strong><small>无法获取叫车目的地</small></span>
                      <em>离线</em>
                    </li>
                  ) : rideDestinations.length > 0 ? rideDestinations.map((destination) => (
                    <li className={`world-phone__list-row ${destination.id === selectedRideDestination?.id ? 'is-selected' : ''}`} key={destination.id}>
                      <button
                        className="world-phone__ride-destination"
                        type="button"
                        aria-pressed={destination.id === selectedRideDestination?.id}
                        onClick={() => setSelectedRideDestinationId(destination.id)}
                      >
                        <span><strong>{destination.label}</strong><small>从当前位置出发</small></span>
                      </button>
                    </li>
                  )) : (
                    <li className="world-phone__list-row">
                      <span><strong>暂无可去地点</strong><small>当前没有可用的叫车目的地</small></span>
                      <em>不可用</em>
                    </li>
                  )}
                </ul>
                <button
                  className="world-phone__list-action"
                  type="button"
                  disabled={Boolean(rideOrder) || rideAvailability !== 'available' || selectedRideDestination === null}
                  onClick={rideAvailability === 'available' && selectedRideDestination ? () => onRideRequest?.(displayDevice, selectedRideDestination.sceneId) : undefined}
                >
                  {rideAvailability === 'available' ? selectedRideDestination ? `呼叫车辆前往${selectedRideDestination.label}` : '暂无可去地点' : rideAvailability === 'not-open' ? '服务暂未开通' : '当前无网络，无法叫车'}
                </button>
              </section>
            )}

            {activeApp === 'milk-tea' && <section className="world-phone__list-page world-phone__milk-tea" aria-label="奶茶">
              {milkTeaHeld ? <div className="world-phone__list-heading"><span>奶茶</span><strong>手里已有一杯饮料</strong><small>暂时不能再下单。</small></div>
                : milkTeaOrder ? (() => {
                  const queue = commercialStreetMilkTeaQueueStatus(milkTeaOrder, milkTeaClock)
                  return <div className="world-phone__list-heading" data-milk-tea-status={queue.phase}>
                    <span>取餐号 {formatCommercialStreetMilkTeaOrderNumber(milkTeaOrder.number)}</span>
                    <strong>{queue.phase === 'ready' ? '已完成' : '制作中'}</strong>
                    <small>{queue.phase === 'ready' ? '请到商业街奶茶店取餐。' : `前方还有 ${queue.ahead} 单`}</small>
                  </div>
                })() : <>
                  <div className="world-phone__list-heading"><span>远程点单</span><strong>选择一杯奶茶</strong></div>
                  <div className="world-phone__milk-tea-field" aria-label="饮料选择">{milkTeaDrinks.map((drink) => <button key={drink} type="button" aria-pressed={milkTeaDrink === drink} onClick={() => selectMilkTeaDrink(drink)}>{drink}</button>)}</div>
                  {milkTeaDrink && <div className="world-phone__milk-tea-field" aria-label="甜度选择"><span>甜度</span>{milkTeaSugarOptions.map((sugar) => <button key={sugar} type="button" aria-pressed={milkTeaSugar === sugar} onClick={() => setMilkTeaSugar(sugar)}>{sugar}</button>)}</div>}
                  {milkTeaDrink && <div className="world-phone__milk-tea-field" aria-label="冰量选择"><span>冰量</span>{milkTeaIceOptions.map((ice) => <button key={ice} type="button" aria-pressed={milkTeaIce === ice} onClick={() => setMilkTeaIce(ice)}>{ice}</button>)}</div>}
                  <button className="world-phone__list-action" type="button" disabled={!milkTeaDrink || !milkTeaSugar || !milkTeaIce} onClick={() => {
                    if (!milkTeaDrink || !milkTeaSugar || !milkTeaIce) return
                    onMilkTeaOrderConfirm?.({ drink: milkTeaDrink, sugar: milkTeaSugar, ice: milkTeaIce })
                    setMilkTeaDrink(null)
                    setMilkTeaSugar(null)
                    setMilkTeaIce(null)
                  }}>确认下单</button>
                </>}
            </section>}

            {activeApp === 'contacts' && (
              contactView === 'messages' ? (
                <section className="world-phone__message-thread" aria-label={`与${selectedContact.name}的短信`}>
                  <div className="world-phone__message-person"><span>短信</span><strong>{selectedContact.name}</strong><small>{selectedContact.detail}</small></div>
                  <div className="world-phone__message-date">三天前</div>
                  {selectedContact.messages.map((message, index) => (
                    <div className={`world-phone__message-bubble ${index % 2 === 0 ? 'world-phone__message-bubble--received' : 'world-phone__message-bubble--sent'}`} key={`${selectedContact.id}-${index}`}>
                      {message}
                    </div>
                  ))}
                </section>
              ) : displayDevice === 'surface' ? (
                <section className="world-phone__list-page" aria-label="联系人">
                  <div className="world-phone__list-heading">
                    <span>联系人</span>
                    <strong>暂无联系人</strong>
                  </div>
                  <p className="world-phone__empty-state">当前手机没有里世界联系人。</p>
                </section>
              ) : (
                <section className="world-phone__list-page" aria-label="联系人">
                  <div className="world-phone__list-heading">
                    <span>联系人</span>
                    <strong>联系人列表</strong>
                  </div>
                  <ul className="world-phone__list">
                    {innerContacts.map((contact) => (
                      <li className="world-phone__list-row" key={contact.id}>
                        <button className="world-phone__contact-row" type="button" onClick={() => { setSelectedContactId(contact.id); setContactView('messages') }}>
                          <span><strong>{contact.name}</strong><small>{contact.detail}</small></span>
                          <em className={online ? 'is-ready' : ''}>{online ? '短信' : '离线'}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}

            {activeApp === 'feedback' && feedbackMode && (
              <FeedbackApp
                key={feedbackMode}
                mode={feedbackMode}
                onSubmit={onFeedbackSubmit}
                onFinish={closeApp}
              />
            )}
              </div>
            </>
          )}
        </section>
      </div>
    </aside>
  )
}

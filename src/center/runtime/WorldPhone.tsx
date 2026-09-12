'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type AnimationEvent as ReactAnimationEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from 'react'
import { mainlineMapLandmarksByWorld, mainlineMapLayout, type MainlineMapLandmark, type MainlineSceneId } from './mainlineScenes'
import { sceneInteractionHandlers } from './sceneInteraction'
import { phoneInputOwner, phoneIsOnline, phoneRideAvailability, type PhoneDevice, type WorldLayer, type WorldPhonePhase } from './phoneState'

type PhoneApp = 'map' | 'ride' | 'contacts' | 'feedback'
type FeedbackMode = 'exit-prompt' | 'phone'
type FeedbackPayload = {
  experienceLength: 'too-short' | 'okay' | 'cannot-understand' | null
  portraitAdaptation: 'yes' | 'no' | null
  continuationInterest: 'yes' | 'no-interest' | null
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
  onRideRequest?: (device: PhoneDevice, destinationSceneId: MainlineSceneId) => void
  feedbackMode?: FeedbackMode | null
  onFeedbackModeChange?: (mode: FeedbackMode | null) => void
  onFeedbackOpen?: () => void
  onFeedbackSubmit?: (payload: FeedbackPayload) => Promise<FeedbackSubmitResult>
  onExitWorldRequest?: () => void
  onExitWorld?: () => void
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
  onExitWorld,
}: {
  mode: FeedbackMode
  onSubmit?: (payload: FeedbackPayload) => Promise<FeedbackSubmitResult>
  onFinish: () => void
  onExitWorld?: () => void
}) {
  const [experienceLength, setExperienceLength] = useState<FeedbackPayload['experienceLength']>(null)
  const [portraitAdaptation, setPortraitAdaptation] = useState<FeedbackPayload['portraitAdaptation']>(null)
  const [continuationInterest, setContinuationInterest] = useState<FeedbackPayload['continuationInterest']>(null)
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
      experienceLength,
      portraitAdaptation,
      continuationInterest,
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
          {mode === 'exit-prompt' && <button type="button" onClick={onExitWorld}>继续离开</button>}
        </div>
      </section>
    )
  }

  return (
    <form className="world-phone__feedback" onSubmit={submit}>
      <span className="world-phone__feedback-kicker">反馈</span>
      {mode === 'exit-prompt' ? (
        <>
          <p className="world-phone__feedback-intro">离开前，想听听你的感受。</p>
          <fieldset className="world-phone__feedback-question">
            <legend>感觉怎么样？</legend>
            <div className="world-phone__feedback-options">
              {[
                ['too-short', '太短了'],
                ['okay', '还不错'],
                ['cannot-understand', '完全看不懂'],
              ].map(([value, label]) => (
                <label key={value} className={experienceLength === value ? 'is-selected' : ''}>
                  <input type="radio" name="experience-length" value={value} checked={experienceLength === value} onChange={() => setExperienceLength(value as FeedbackPayload['experienceLength'])} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="world-phone__feedback-question">
            <legend>您希望我们继续根据竖屏做更精细化的适配吗？</legend>
            <div className="world-phone__feedback-options world-phone__feedback-options--short">
              {[
                ['yes', '要'],
                ['no', '不要'],
              ].map(([value, label]) => (
                <label key={value} className={portraitAdaptation === value ? 'is-selected' : ''}>
                  <input type="radio" name="portrait-adaptation" value={value} checked={portraitAdaptation === value} onChange={() => setPortraitAdaptation(value as FeedbackPayload['portraitAdaptation'])} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="world-phone__feedback-question">
            <legend>你愿意体验后面的内容吗？</legend>
            <div className="world-phone__feedback-options world-phone__feedback-options--short">
              {[
                ['yes', '愿意'],
                ['no-interest', '没兴趣'],
              ].map(([value, label]) => (
                <label key={value} className={continuationInterest === value ? 'is-selected' : ''}>
                  <input type="radio" name="continuation-interest" value={value} checked={continuationInterest === value} onChange={() => setContinuationInterest(value as FeedbackPayload['continuationInterest'])} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <p className="world-phone__feedback-intro">有什么想说的，可以写在这里。</p>
          <textarea className="world-phone__feedback-textarea" value={freeText} maxLength={2000} onChange={event => setFreeText(event.target.value)} placeholder="写下你的反馈" aria-label="自定义反馈" />
        </>
      )}
      {error && <p className="world-phone__feedback-error" role="alert">{error}</p>}
      <button className="world-phone__feedback-submit" type="submit" disabled={submitting}>{submitting ? '提交中…' : '提交反馈'}</button>
    </form>
  )
}

export function WorldPhone({ currentSceneId, worldLayer, device, open, onOpen, onClose, onRideRequest, feedbackMode = null, onFeedbackModeChange, onFeedbackOpen, onFeedbackSubmit, onExitWorldRequest, onExitWorld }: WorldPhoneProps) {
  const currentLandmark = landmarkForScene(currentSceneId)
  const [displayDevice, setDisplayDevice] = useState<PhoneDevice>(device)
  const [phase, setPhase] = useState<WorldPhonePhase>('closed')
  const [activeApp, setActiveApp] = useState<PhoneApp | null>(null)
  const [contactView, setContactView] = useState<ContactView>('list')
  const [selectedContactId, setSelectedContactId] = useState<ContactId>('lao-zhou')
  const [selectedMapLandmarkId, setSelectedMapLandmarkId] = useState<string | null>(null)
  const [selectedRideDestinationId, setSelectedRideDestinationId] = useState<string | null>(null)
  const [mapPan, setMapPan] = useState<MapPoint>([0, 0])
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
  const activeAppLabel = activeApp === 'map' ? '地图' : activeApp === 'ride' ? '叫车' : activeApp === 'contacts' ? contactView === 'messages' ? '短信' : '联系人' : activeApp === 'feedback' ? '反馈' : ''
  const batteryPercent = 72
  const isMapOpen = activeApp === 'map'
  const memo = memoForDevice(displayDevice)
  const selectedContact = innerContacts.find((contact) => contact.id === selectedContactId) ?? innerContacts[0]

  const openApp = (app: PhoneApp) => {
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

  const handleBodyTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (renderedPhase === 'closing') {
      if (swapPending) setDisplayDevice(device)
      setPhase(open ? 'opening' : 'closed')
      return
    }
    if (renderedPhase === 'opening') setPhase('open')
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

      <div className="world-phone__body" onTransitionEnd={handleBodyTransitionEnd}>
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
              <button className="world-phone__exit" type="button" onClick={onExitWorldRequest} disabled={!onExitWorldRequest}>离开</button>
              <button className="world-phone__close" type="button" aria-label="收起手机" onClick={onClose}>×</button>
            </div>
          </header>}

          {!isMapOpen && <div className="world-phone__world-status">
            <span>{phoneTime.clock}</span>
            <span>{statusDetail}</span>
          </div>}

          {activeApp === null ? (
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
                  <button type="button" data-app="ride" onClick={() => openApp('ride')}>
                    <span className="world-phone__app-icon" aria-hidden="true">↗</span>
                    <span className="world-phone__app-label">叫车</span>
                  </button>
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
                  disabled={rideAvailability !== 'available' || selectedRideDestination === null}
                  onClick={rideAvailability === 'available' && selectedRideDestination ? () => onRideRequest?.(displayDevice, selectedRideDestination.sceneId) : undefined}
                >
                  {rideAvailability === 'available' ? selectedRideDestination ? `呼叫车辆前往${selectedRideDestination.label}` : '暂无可去地点' : rideAvailability === 'not-open' ? '服务暂未开通' : '当前无网络，无法叫车'}
                </button>
              </section>
            )}

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
                onExitWorld={onExitWorld}
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

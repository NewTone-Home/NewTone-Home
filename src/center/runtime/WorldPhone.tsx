'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type AnimationEvent as ReactAnimationEvent, type FormEvent, type TransitionEvent as ReactTransitionEvent } from 'react'
import { type MainlineSceneId } from './mainlineScenes'
import { getPhoneMapRegions, phoneMapZoomBounds, type PhoneMapZoomLevel } from './phoneMapModel'
import { phoneInputOwner, phoneIsOnline, phoneRideAvailability, type PhoneDevice, type WorldLayer, type WorldPhonePhase } from './phoneState'
import { commercialStreetMilkTeaQueueStatus, formatCommercialStreetMilkTeaOrderNumber, milkTeaDrinks, milkTeaIceOptions, milkTeaSugarOptions, type CommercialStreetMilkTeaOrder, type MilkTeaDrink, type MilkTeaIce, type MilkTeaSugar } from './commercialStreetMilkTea'

import { type MainlineRideOrder, type MainlineRideVehicle, type MainlineRideRequestResult } from './mainlineRide'
import { PhoneNotificationCapsule } from './PhoneNotificationCapsule'
import type { PhoneNotification } from './phoneNotifications'
import { phoneStoryHistory, type PhoneCallRecord, type PhoneNote } from './phonePersonalData'
import { mainlineStoryDateLabel, mainlineStoryTimeLabel, mainlineWorldWeatherLabel, type MainlineStoryClock } from './mainlineStoryClock'
import './phone.css'
import { PhoneMapCanvas } from './PhoneMapCanvas'
import { PhoneRideApp } from './PhoneRideApp'
import { PhonePlaceDetails } from './PhonePlaceDetails'

type PhoneApp = 'map' | 'ride' | 'contacts' | 'feedback' | 'milk-tea' | 'notes'
type FeedbackMode = 'phone'
type FeedbackPayload = {
  freeText: string
  source: FeedbackMode
}
type FeedbackSubmitResult = { ok: boolean; reason?: string }
type MapPoint = readonly [number, number]
type ContactView = 'list' | 'detail' | 'messages' | 'call'
type ContactId = 'lao-zhou'

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
]

type WorldPhoneProps = {
  getPlayerPosition?: () => {x:number;y:number} | null
  currentSceneId: string
  worldLayer: WorldLayer
  device: PhoneDevice
  open: boolean
  onOpen: () => void
  onClose: () => void
  onCloseComplete?: () => void
  rideOrder?: MainlineRideOrder | null
  notifications?: readonly PhoneNotification[]
  storyClock: MainlineStoryClock
  notificationScreen?: boolean
  onNotificationDismiss?: () => void
  onAppOpen?: (app: PhoneApp) => void
  onRideRequest?: (device: PhoneDevice, destinationSceneId: MainlineSceneId, presentation:{vehicle:MainlineRideVehicle;arrivalLabel?:string}) => MainlineRideRequestResult | void
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
  notes?: readonly PhoneNote[]
  yongheLeadUnlocked?: boolean
  contactNotes?: Readonly<Record<string, string>>
  callHistory?: readonly PhoneCallRecord[]
  onNoteCreate?: (title: string, body: string) => void
  onNoteChange?: (id: string, update: Partial<Pick<PhoneNote, 'title' | 'body' | 'status'>>) => void
  onNotePin?: (id: string) => void
  onContactNoteChange?: (contactId: string, note: string) => void
  onCallRecord?: (record: PhoneCallRecord) => void
}


function PhoneAppIcon({ app }: { app: PhoneApp }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {app === 'map' && <><path {...common} d="M12 21s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12Z" /><circle {...common} cx="12" cy="9" r="2.3" /></>}
      {app === 'ride' && <><path {...common} d="m5 13 1.4-4.1A2 2 0 0 1 8.3 7.5h7.4a2 2 0 0 1 1.9 1.4L19 13v5h-2v-2H7v2H5v-5Z" /><path {...common} d="M5.5 13h13M8 10.5h.01M16 10.5h.01" /></>}
      {app === 'milk-tea' && <><path {...common} d="M7 8h10l-1 12H8L7 8Z" /><path {...common} d="m10 8 3-5M12 11v5M10 13h4" /></>}
      {app === 'contacts' && <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3.5 20a5.5 5.5 0 0 1 11 0M17 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 4.8" /></>}
      {app === 'feedback' && <><path {...common} d="M4 5.5h16v11H9l-5 3v-14Z" /><path {...common} d="M8 10h8M8 13h5" /></>}
      {app === 'notes' && <><path {...common} d="M6 3.5h9l3.5 3.7v13.3H6z" /><path {...common} d="M14.5 3.5v4H18M9 12h6M9 15h6" /></>}
    </svg>
  )
}

function ContactAvatar() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8 42a16 16 0 0 1 32 0" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
}
function HomeIndicator({ onReturn }: { onReturn: () => void }) {
  return <button className="world-phone__home-indicator" type="button" aria-label="返回手机主屏" onClick={onReturn}><span /></button>
}

function landmarkForScene(sceneId: string): { device: PhoneDevice; id: string } | null {
  if (sceneId === 'jijia-ancestral-home' || sceneId === 'jijia-ancestral-interior') return { device: 'surface', id: 'jijia' }
  if (sceneId === 'commercial-street' || sceneId === 'commercial-cafe') return { device: 'inner', id: 'commercial' }
  if (sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery') return { device: 'inner', id: 'mine' }
  if (sceneId === 'zhongshuyuan-office') return { device: 'inner', id: 'zhongshuyuan' }
  return null
}

function formatCallDuration(durationMs: number) {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000)
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function NotesApp({ notes, onCreate, onChange }: {
  notes: readonly PhoneNote[]
  onCreate?: (title: string, body: string) => void
  onChange?: (id: string, update: Partial<Pick<PhoneNote, 'title' | 'body' | 'status'>>) => void
  onPin?: (id: string) => void
}) {
  const [view, setView] = useState<'list' | 'compose' | 'history'>('list')
  const [direction, setDirection] = useState(1)
  const [editing, setEditing] = useState<PhoneNote | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const meta = (note: PhoneNote) => note.kind === 'story' ? `4月12日 ${mainlineStoryTimeLabel(note.id === 'story-yonghe-lead' ? 'cafe' : note.storyStage ?? 'opening')}` : '私人备忘'
  return <section className="world-phone__notes-page" aria-label="备忘录">
    <div className="world-phone__notes-toolbar">
      {view !== 'list' ? <button onClick={() => { setDirection(-1); setView('list') }} aria-label="返回备忘录">‹ 返回</button> : <button onClick={() => { setDirection(1); setView('history') }}>历史记录</button>}
      {view === 'list' && <button aria-label="新增备忘" onClick={() => { setDirection(1); setEditing(null); setTitle(''); setBody(''); setView('compose') }}>+</button>}
    </div>
    <div key={view} className="world-phone__subpage" data-direction={direction}>{view === 'compose' ? <form className="world-phone__note-compose" onSubmit={event => {
      event.preventDefault()
      if (editing) onChange?.(editing.id, { title, body }); else onCreate?.(title, body)
      setDirection(-1); setView('list')
    }}>
      <input aria-label="新备忘标题" placeholder="标题" value={title} maxLength={80} onChange={event => setTitle(event.target.value)} />
      <textarea aria-label="新备忘内容" placeholder="写下要记住的事" value={body} maxLength={2000} onChange={event => setBody(event.target.value)} />
      <button disabled={!title.trim() && !body.trim()}>保存备忘</button>
    </form> : view === 'history' ? <section aria-label="历史记录" className="world-phone__timeline">
      <h3>历史记录</h3>
      {phoneStoryHistory(notes).map(event => <details key={event.id}>
        <summary><small>4月12日 {mainlineStoryTimeLabel(event.stage)}</small><strong>{event.title}</strong><span>{event.summary}</span></summary>{event.notes.map(note=><p key={note.id}>{note.title} · {note.body}</p>)}
      </details>)}
      {!notes.some(note => note.kind === 'story' && note.status === 'history') && <p>暂无历史记录</p>}
    </section> : <div className="world-phone__notes-list">
      {notes.filter(note => note.kind === 'player' || note.status === 'current').map(note => <article className="world-phone__note" data-note-kind={note.kind} key={note.id}>
        <button onClick={() => { if (note.kind !== 'player') return; setDirection(1); setEditing(note); setTitle(note.title); setBody(note.body); setView('compose') }}>
          <strong>{note.title}</strong><p>{note.body}</p><small>{meta(note)}</small>
        </button>
      </article>)}
    </div>}</div>
  </section>
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
        <strong>已收到，谢谢</strong>
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

export function WorldPhone({ getPlayerPosition, currentSceneId, worldLayer, device, open, onOpen, onClose, onCloseComplete, onRideRequest, rideOrder = null, notifications = [], storyClock, notificationScreen = false, onNotificationDismiss, onAppOpen, feedbackMode = null, onFeedbackModeChange, onFeedbackOpen, onFeedbackSubmit, milkTeaAppUnlocked = false, milkTeaOrder = null, milkTeaHeld = false, requestedApp = null, onRequestedAppHandled, onMilkTeaOrderConfirm, onMilkTeaOrderStarted, onMeaningfulActivity, notes = [], yongheLeadUnlocked = false, contactNotes = {}, callHistory = [], onNoteCreate, onNoteChange, onNotePin, onContactNoteChange, onCallRecord }: WorldPhoneProps) {
  const currentLandmark = landmarkForScene(currentSceneId)
  const [displayDevice, setDisplayDevice] = useState<PhoneDevice>(device)
  const [phase, setPhase] = useState<WorldPhonePhase>('closed')
  const [leavingApp, setLeavingApp] = useState<PhoneApp | 'home' | null>(null)
  const [appOrigin, setAppOrigin] = useState('50% 80%')
  const phoneRef = useRef<HTMLElement>(null)
  const [placeCall, setPlaceCall] = useState<string | null>(null)
  const [activeApp, setActiveApp] = useState<PhoneApp | null>(null)
  const [contactView, setContactView] = useState<ContactView>('list')
  const [selectedContactId, setSelectedContactId] = useState<ContactId>('lao-zhou')
  const [contactNoteDraft, setContactNoteDraft] = useState('')
  const [activeCallStartedAt, setActiveCallStartedAt] = useState<number | null>(null)
  const [locationCardOpen, setLocationCardOpen] = useState(false)
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null)
  const [mapFocusRequestId, setMapFocusRequestId] = useState<string | null>(null)
  const [mapSheetHeight, setMapSheetHeight] = useState(0)
  const [contactDirection, setContactDirection] = useState(1)
  const [mapZoom, setMapZoom] = useState<PhoneMapZoomLevel>(1)
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
  useEffect(() => { setContactNoteDraft(contactNotes[selectedContactId] ?? '') }, [contactNotes, selectedContactId])
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
  const mapRegions = getPhoneMapRegions(displayDevice)
  const rideAvailability = phoneRideAvailability(displayDevice, worldLayer)
  const activeAppLabel = activeApp === 'map' ? '地图' : activeApp === 'ride' ? '叫车' : activeApp === 'contacts' ? contactView === 'messages' ? '短信' : contactView === 'call' ? '电话' : contactView === 'detail' ? '联系人详情' : '联系人' : activeApp === 'feedback' ? '反馈' : activeApp === 'milk-tea' ? '奶茶' : activeApp === 'notes' ? '备忘录' : ''
  const batteryPercent = 72
  const isMapOpen = !notificationScreen && activeApp === 'map'
  const pinnedMemo = notes.find(note => note.status === 'current' && note.pinned)
  const widgetNotes = notes.filter(note => note.status === 'current' && note.id !== pinnedMemo?.id).slice(0, 2)
  const memo = pinnedMemo ?? widgetNotes[0] ?? null
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
    if (leavingApp) return
    const root = phoneRef.current
    const icon = root?.querySelector<HTMLElement>(`[data-app="${app}"]`)
    const panel = root?.querySelector<HTMLElement>('.world-phone__home-screen')
    if (icon && panel) {
      const i = icon.getBoundingClientRect(), p = panel.getBoundingClientRect()
      setAppOrigin(`${i.x + i.width / 2 - p.x}px ${i.y + i.height / 2 - p.y}px`)
    }
    onAppOpen?.(app)
    if (activeApp && activeApp !== app) setLeavingApp(app)
    else setActiveApp(app)
    if (app !== 'contacts') setContactView('list')
    setLocationCardOpen(false)
  }

  const closeApp = () => {
    if (leavingApp) return
    if (activeApp) setLeavingApp('home')
  }

  const finishCall = useCallback(() => {
    if (activeCallStartedAt === null) return
    const endedAt = Date.now()
    onCallRecord?.({
      id: `call-${activeCallStartedAt}-${endedAt}`,
      contactId: selectedContactId,
      startedAt: activeCallStartedAt,
      endedAt,
      durationMs: endedAt - activeCallStartedAt,
      result: 'cancelled',
    })
    setActiveCallStartedAt(null)
    setContactView('detail')
  }, [activeCallStartedAt, onCallRecord, selectedContactId])
  const closePhone = useCallback(() => {
    setPlaceCall(null)
    setLeavingApp(null)
    if (activeCallStartedAt !== null) finishCall()
    onClose()
  }, [activeCallStartedAt, finishCall, onClose])

  useEffect(() => {
    if (!isInteractive) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closePhone()
    }
    window.addEventListener('keydown', dismiss, true)
    return () => window.removeEventListener('keydown', dismiss, true)
  }, [closePhone, isInteractive])

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

  useEffect(() => {
    if (!open || notificationScreen) {
      setActiveApp(null)
      setLeavingApp(null)
        setPlaceCall(null)
    }
  }, [open, notificationScreen])

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

  const selectedMapRegion = mapRegions.find((region) => region.id === selectedMapPlaceId) ?? null
  const selectedMapPoi = mapRegions.flatMap((region) => region.pois.map((poi) => ({ region, poi }))).find(({ poi }) => poi.id === selectedMapPlaceId) ?? null
  const selectedMapTitle = selectedMapPoi?.poi.label ?? selectedMapRegion?.label ?? null

  useEffect(() => {
    if (activeApp !== 'map' || mapFocusRequestId !== 'yonghe-eatery') return undefined
    const frame = window.requestAnimationFrame(() => {
      setMapZoom(current => Math.max(current, phoneMapZoomBounds.poi + .2))
      setMapFocusRequestId(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeApp, mapFocusRequestId])
  const storyDate = mainlineStoryDateLabel()
  const storyTime = mainlineStoryTimeLabel(storyClock.stage)
  const worldWeather = mainlineWorldWeatherLabel(displayDevice, storyClock.weatherCycle)


  return (
    <>
    {isInteractive && <div className="world-phone__dismiss-region" onPointerDown={event => { event.stopPropagation() }} onPointerUp={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); closePhone() }} />}
    <aside ref={phoneRef}
      className={`world-phone world-phone--${displayDevice} world-phone--phase-${renderedPhase} ${isInteractive ? 'is-open' : ''} ${isMapOpen ? 'world-phone--map-app' : ''}`}
      data-has-notifications={notifications.some(n => n.unread)}
      data-phone-open={open}
      data-phone-phase={renderedPhase}
      data-phone-device={displayDevice}
      data-world-layer={worldLayer}
      onClickCapture={onMeaningfulActivity} onClick={event => { event.stopPropagation(); if (!(event.target instanceof Element) || !event.target.closest(".world-phone__message-place")) setLocationCardOpen(false) }}
      onKeyDownCapture={onMeaningfulActivity}
      onWheel={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
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
        <PhoneNotificationCapsule notifications={notifications} />
      </button>

      <div inert={!isInteractive} className="world-phone__body" onTransitionEnd={handleBodyTransitionEnd} onTransitionRun={handleBodyTransitionRun} onTransitionCancel={handleBodyTransitionCancel}>
        <div className="world-phone__hardware" aria-hidden="true">
          <span className="world-phone__earpiece" />
          <span className="world-phone__camera" />
          <span className="world-phone__brand">NEWTONE</span>
          <span className="world-phone__side-buttons" />
        </div>
        <section className={`world-phone__panel ${isMapOpen ? 'world-phone__panel--map' : ''}`} role="dialog" aria-label="手机" aria-hidden={!isInteractive}>
          <header className="world-phone__header">
            <span className="world-phone__world-status">{storyTime}　{storyDate}</span>
            <div className="world-phone__status" aria-label={`${online ? '有信号' : '无信号'}，电量${batteryPercent}%`}>
              <span>{worldWeather}</span><span className={`world-phone__signal-bars ${online ? 'is-online' : 'is-offline'}`}><i /><i /><i /></span>
              <span className="world-phone__battery"><i style={{ width: `${batteryPercent}%` }} /></span>
            </div>
          </header>

          {placeCall ? <section className="world-phone__call-screen" aria-label={`正在呼叫${placeCall}`}><span>正在拨号</span><strong>{placeCall}</strong><small>响铃中</small><button className="world-phone__call-hangup" onClick={() => setPlaceCall(null)}>挂断</button></section> : notificationScreen ? (
            <section className="world-phone__lock-screen" aria-label="手机通知" onClick={() => { setActiveApp(null); onNotificationDismiss?.() }}>
              <header className="world-phone__lock-clock">
                <strong>{storyTime}</strong>
                <span>{storyDate}{displayDevice === 'inner' ? ` · ${worldWeather}` : ''}</span>
              </header>
              <span className="world-phone__lock-hint">点击空白进入手机</span>
              {notifications.filter(n => n.unread).map(n => <button type="button" className="world-phone__notification" data-notification-app={n.app} key={n.id} onClick={event => { event.stopPropagation(); openApp(n.app) }}><strong>{n.title}</strong><span>{n.body}</span></button>)}
            </section>
          ) : activeApp === null ? (
            <section className="world-phone__home-screen" aria-label="手机主屏">
              <div className="world-phone__home-layout">
                <section className="world-phone__home-calendar" aria-label="剧情日历">
                  <strong>四月</strong>
                  <div className="world-phone__calendar-grid">
                    {['一','二','三','四','五','六','日'].map(day => <small key={day}>{day}</small>)}
                    <span />
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(day => <span key={day} aria-current={day === 12 ? 'date' : undefined} data-weather={displayDevice === 'inner' ? (Math.floor(day / 7) % 2 ? (storyClock.weatherCycle ?? 'sunny') : (storyClock.weatherCycle === 'rainy' ? 'sunny' : 'rainy')) : undefined}><b>{day}</b></span>)}
                  </div>
                </section>
                <section className="world-phone__home-memo" aria-label="备忘录">
                  <button className="world-phone__memo-open" type="button" data-app="notes" onClick={() => openApp('notes')}>
                    <span>备忘录</span>
                    <strong>{memo?.title ?? '暂无备忘'}</strong>
                    <p>{memo?.body ?? '添加一条想记住的事。'}</p>
                    {pinnedMemo && <small>已置顶</small>}
                    {widgetNotes.slice(pinnedMemo ? 0 : 1, pinnedMemo ? 2 : 2).map(note => <small className="world-phone__memo-extra" key={note.id}>{note.title} · {note.body}</small>)}
                  </button>
                  <div className="world-phone__pin-candidates">{notes.filter(note => note.kind === 'story' && note.status === 'current' && note.pinAvailable).slice(0,3).map(note => <button key={note.id} aria-pressed={note.pinned} onClick={() => onNotePin?.(note.id)}>{note.pinned ? '已置顶 · ' : '置顶 · '}{note.title}</button>)}</div>
                </section>
                <nav className="world-phone__apps" aria-label="手机应用">
                  <button type="button" data-app="map" onClick={() => openApp('map')}>
                    <span className="world-phone__app-icon"><PhoneAppIcon app="map" /></span>
                    <span className="world-phone__app-label">地图</span>
                  </button>
                  <button type="button" data-app="ride" data-unread={notifications.some(n => n.app === 'ride' && n.unread)} onClick={() => openApp('ride')}>
                    <span className="world-phone__app-icon"><PhoneAppIcon app="ride" /></span>
                    <span className="world-phone__app-label">叫车</span>
                  </button>
                  {milkTeaAppUnlocked && <button type="button" data-app="milk-tea" data-unread={notifications.some(n => n.app === 'milk-tea' && n.unread)} onClick={() => openApp('milk-tea')}>
                    <span className="world-phone__app-icon"><PhoneAppIcon app="milk-tea" /></span>
                    <span className="world-phone__app-label">奶茶</span>
                  </button>}
                  <button type="button" data-app="contacts" onClick={() => openApp('contacts')}>
                    <span className="world-phone__app-icon"><PhoneAppIcon app="contacts" /></span>
                    <span className="world-phone__app-label">联系人</span>
                  </button>
                  <button type="button" data-app="feedback" onClick={() => { onFeedbackOpen?.(); onFeedbackModeChange?.('phone'); openApp('feedback') }}>
                    <span className="world-phone__app-icon"><PhoneAppIcon app="feedback" /></span>
                    <span className="world-phone__app-label">反馈</span>
                  </button>
                </nav>
              </div>
            </section>
          ) : (
            <>
              <div key={activeApp} className={`world-phone__app-view ${leavingApp ? 'is-leaving' : ''}`} data-app-view={activeApp} style={{ transformOrigin: appOrigin }} onAnimationEnd={event => { if (event.target !== event.currentTarget || !leavingApp) return; if (leavingApp === 'home' && activeApp === 'feedback') onFeedbackModeChange?.(null); setActiveApp(leavingApp === 'home' ? null : leavingApp); setLeavingApp(null); setContactView('list') }}>
              <div className="world-phone__app-bar">
                {activeApp === 'contacts' && contactView !== 'list' && <button className="world-phone__app-back" type="button" onClick={() => { if (contactView === 'call') finishCall(); else { setContactDirection(-1); setContactView(contactView === 'messages' ? 'detail' : 'list') } }} aria-label="返回联系人"><span aria-hidden="true">‹</span><small>联系人</small></button>}
                <div><strong>{activeAppLabel}</strong></div>
              </div>
              <div className="world-phone__app-content">
            {activeApp === 'map' && (
              <div className="world-phone__map-frame">
                <div className="world-phone__map-title">区域地图{!online ? ' · 离线' : ''}</div>
                <PhoneMapCanvas mapRegions={mapRegions} displayDevice={displayDevice} currentLandmark={currentLandmark} selectedMapPlaceId={selectedMapPlaceId} onSelect={id => { setMapFocusRequestId(null); setSelectedMapPlaceId(id) }} mapZoom={mapZoom} setMapZoom={setMapZoom} mapPan={mapPan} setMapPan={setMapPan} focusId={mapFocusRequestId ?? selectedMapPlaceId} coveredHeight={mapSheetHeight} onBlank={() => { setSelectedMapPlaceId(null); setMapFocusRequestId(null) }} />
                <PhonePlaceDetails id={selectedMapPlaceId} title={selectedMapTitle} onHeight={setMapSheetHeight} onRide={() => { setSelectedRideDestinationId(selectedMapRegion?.id ?? selectedMapPoi?.region.id ?? null); openApp('ride') }} onCall={() => setPlaceCall('中枢院 · 0000')} />
                {!online && <p className="world-phone__offline-note">当前为离线地图，显示已缓存路线。</p>}
              </div>
            )}

            {activeApp === 'ride' && <PhoneRideApp regions={mapRegions} device={displayDevice} currentLandmark={currentLandmark} currentSceneId={currentSceneId as MainlineSceneId} order={rideOrder} clock={rideClock} storyClock={storyClock} available={rideAvailability === 'available'} online={online} destinationId={selectedRideDestinationId} onDestination={setSelectedRideDestinationId} onConfirm={(sceneId,presentation) => onRideRequest?.(displayDevice, sceneId,presentation)} getPosition={getPlayerPosition} />}

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

            {activeApp === 'notes' && <NotesApp notes={notes} onCreate={onNoteCreate} onChange={onNoteChange} onPin={onNotePin} />}

            {activeApp === 'contacts' && <div key={contactView} className="world-phone__subpage" data-direction={contactDirection}>{(
              contactView === 'messages' ? (
                <section className="world-phone__message-thread" aria-label={`与${selectedContact.name}的短信`}>
                  <div className="world-phone__message-person"><span>短信</span><strong>{selectedContact.name}</strong><small>{selectedContact.detail}</small></div>
                  <div className="world-phone__message-date">三天前</div>
                  {selectedContact.messages.map((message, index) => (
                    <div className={`world-phone__message-bubble ${index % 2 === 0 ? 'world-phone__message-bubble--received' : 'world-phone__message-bubble--sent'}`} key={`${selectedContact.id}-${index}`}>
                      {message}
                    </div>
                  ))}
                  {selectedContactId === 'lao-zhou' && displayDevice === 'inner' && yongheLeadUnlocked && (
                    <div className={`world-phone__message-place ${locationCardOpen ? 'is-expanded' : ''}`} onMouseEnter={() => setLocationCardOpen(true)} onMouseLeave={() => setLocationCardOpen(false)} onClick={event => { if (!(event.target instanceof Element) || !event.target.closest('.world-phone__place-card')) setLocationCardOpen(true) }}>
                      <div className="world-phone__message-bubble world-phone__message-bubble--received world-phone__message-bubble--place" role="button" tabIndex={0} aria-label="展开永和小馆地点卡" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setLocationCardOpen(true) }}>

                        <p>查不到去了哪里。不过我在那边有个线人，据说有人好像在永和小馆那块见过陈副部长。</p>

                      </div>
                      {locationCardOpen && <button type="button" className="world-phone__place-card" onClick={event => { event.stopPropagation(); setMapZoom(current => Math.max(current, phoneMapZoomBounds.poi + .2)); setSelectedMapPlaceId('yonghe-eatery'); setMapFocusRequestId('yonghe-eatery'); setLocationCardOpen(false); openApp('map') }}><span aria-hidden="true">⌖</span><strong>永和小馆</strong></button>}
                    </div>
                  )}
                </section>
              ) : contactView === 'call' ? (
                <section className="world-phone__call-screen" aria-label={`正在呼叫${selectedContact.name}`}>
                  <div className="world-phone__call-avatar" aria-hidden="true"><ContactAvatar /></div>
                  <span>正在拨号</span>
                  <strong>{selectedContact.name}</strong>
                  <div className="world-phone__call-ringing" aria-label="持续响铃"><i /><i /><i /></div>
                  <small aria-live="polite">持续响铃中 · 请手动挂断</small>
                  <button type="button" className="world-phone__call-hangup" onClick={finishCall}>挂断</button>
                </section>
              ) : contactView === 'detail' ? (
                <section className="world-phone__contact-detail" aria-label={`${selectedContact.name}联系人详情`}>
                  <div className="world-phone__contact-profile"><span aria-hidden="true"><ContactAvatar /></span><strong>{selectedContact.name}</strong><small>{selectedContact.detail}</small></div>
                  <div className="world-phone__contact-actions">
                    <button type="button" onClick={() => { setContactDirection(1); setContactView('messages') }}><span aria-hidden="true">▤</span>信息</button>
                    <button type="button" onClick={() => { setActiveCallStartedAt(Date.now()); setContactView('call') }}><span aria-hidden="true">⌕</span>电话</button>
                  </div>
                  <label className="world-phone__contact-note">备注<textarea aria-label="联系人备注" maxLength={1000} value={contactNoteDraft} onChange={event => setContactNoteDraft(event.target.value)} onBlur={() => onContactNoteChange?.(selectedContactId, contactNoteDraft)} placeholder="添加备注" /></label>
                  <div className="world-phone__call-history"><span>通话记录</span>{callHistory.filter(record => record.contactId === selectedContactId).slice().reverse().map(record => <p key={record.id}>拨出 · {record.result === 'cancelled' ? '已挂断' : '已结束'} · {formatCallDuration(record.durationMs)}</p>)}{!callHistory.some(record => record.contactId === selectedContactId) && <small>暂无通话记录</small>}</div>
                </section>
              ) : displayDevice === 'surface' ? (
                <section className="world-phone__list-page" aria-label="联系人">
                  <p className="world-phone__empty-state">暂无联系人</p>
                </section>
              ) : (
                <section className="world-phone__list-page" aria-label="联系人">
                  <ul className="world-phone__list">
                    {innerContacts.map((contact) => (
                      <li className="world-phone__list-row" key={contact.id}>
                        <button className="world-phone__contact-row" type="button" onClick={() => { setContactDirection(1); setSelectedContactId(contact.id); setContactView('detail') }}>
                          <span className="world-phone__contact-avatar" aria-hidden="true"><ContactAvatar /></span><span><strong>{contact.name}</strong><small>{contact.detail}</small></span>
                          <em className={online ? 'is-ready' : ''}>{online ? '›' : '离线'}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}</div>}

            {activeApp === 'feedback' && feedbackMode && (
              <FeedbackApp
                key={feedbackMode}
                mode={feedbackMode}
                onSubmit={onFeedbackSubmit}
                onFinish={closeApp}
              />
            )}
              </div>
              </div>
              <HomeIndicator onReturn={closeApp} />
            </>
          )}
        </section>
      </div>
    </aside>
    </>
  )
}

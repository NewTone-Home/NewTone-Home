'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type AnimationEvent as ReactAnimationEvent, type FormEvent, type TransitionEvent as ReactTransitionEvent } from 'react'
import { type MainlineSceneId } from './mainlineScenes'
import { getPhoneMapRegions, type PhoneMapZoomLevel } from './phoneMapModel'
import { phoneInputOwner, phoneIsOnline, phoneRideAvailability, type PhoneDevice, type WorldLayer, type WorldPhonePhase } from './phoneState'
import { milkTeaDrinks, milkTeaIceOptions, milkTeaSugarOptions, commercialStreetMilkTeaQueueStatus, formatCommercialStreetMilkTeaOrderNumber, type CommercialStreetMilkTeaOrder, type MilkTeaDrink, type MilkTeaIce, type MilkTeaSugar } from './commercialStreetMilkTea'
import { ShopOrderApp, type ShopOrderProduct } from './ShopOrderApp'
import { commercialStreetDrinkCatalog } from './commercialStreetDrinkCatalog'
import { commercialCafeTakeawayCatalog } from './commercialCafeTakeawayCatalog'
import { yongheTakeawayCatalog } from './yongheTakeawayCatalog'
import { crossShopIds, type CrossShopOrder, type HeldConsumable } from './crossShopOrders'

import { type MainlineRideOrder, type MainlineRideVehicle, type MainlineRideRequestResult } from './mainlineRide'
import { PhoneNotificationCapsule } from './PhoneNotificationCapsule'
import type { PhoneNotification } from './phoneNotifications'
import { phoneStoryHistory, type PhoneCallRecord, type PhoneNote } from './phonePersonalData'
import { daysInStoryMonth, mainlineStoryDateLabel, mainlineStoryTimeLabel, mainlineWorldWeatherLabel, storyCalendarLeadingBlankCount, type MainlineStoryClock } from './mainlineStoryClock'
import './phone.css'
import { PhoneMapCanvas } from './PhoneMapCanvas'
import { PhoneRideApp } from './PhoneRideApp'
import type { MainlineSceneGeometrySnapshot } from './mainlineSceneGeometrySnapshot'
import { PhonePlaceDetails } from './PhonePlaceDetails'
import { commercialCafeCompletionPhoneMessageReadyForAck } from './cafeCompletionPhone'
import type { SessionGameActivitySource } from './sessionGameClock'

type PhoneApp = 'map' | 'ride' | 'contacts' | 'feedback' | 'milk-tea' | 'fruit-tea' | 'yonghe-order' | 'cafe-takeaway' | 'notes'
export function phoneAppForShopId(shopId: string): PhoneApp | null {
  if (shopId === crossShopIds.milkTea || shopId === crossShopIds.fruitTea || shopId === crossShopIds.cafeTakeaway) return 'milk-tea'
  if (shopId === crossShopIds.yonghe) return 'yonghe-order'
  if (shopId === crossShopIds.cafeTakeaway) return 'cafe-takeaway'
  return null
}
function shopTitleForId(shopId: string): string {
  if (shopId === crossShopIds.milkTea) return '奶茶店'
  if (shopId === crossShopIds.fruitTea) return '果茶店'
  if (shopId === crossShopIds.yonghe) return '永和小馆'
  if (shopId === crossShopIds.cafeTakeaway) return '咖啡外带'
  return '店铺'
}
type FeedbackMode = 'phone'
type FeedbackPayload = {
  freeText: string
  source: FeedbackMode
}
type FeedbackSubmitResult = { ok: boolean; reason?: string }
type MapPoint = readonly [number, number]
type ContactView = 'list' | 'detail' | 'messages' | 'call'
type ContactId = 'lao-zhou' | 'ruoyu'

type ContactDefinition = {
  id: ContactId
  name: string
  detail: string
  messages: readonly string[]
}

const innerContacts: readonly ContactDefinition[] = [
  {
    id: 'ruoyu',
    name: '孙若雨',
    detail: '中枢院 · 联系人',
    messages: ['老地方？', '好，见面说。'],
  },
  {
    id: 'lao-zhou',
    name: '老周',
    detail: '中枢院 · 联系人',
    messages: ['陈副部长失踪了。', '什么时候有空。', '周六。', '老地方。', '好。'],
  },
]

type WorldPhoneProps = {
  getPlayerPosition?: () => {x:number;y:number} | null
  getRideMapSnapshot?: () => MainlineSceneGeometrySnapshot | null
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
  gameTimeLabel?: string
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
  ruoyuMessagesUnlocked?: boolean
  requestedApp?: 'milk-tea' | 'fruit-tea' | 'yonghe-order' | 'cafe-takeaway' | 'lao-zhou-messages' | 'ruoyu-messages' | null
  requestedShopId?: string | null
  requestedShopProductId?: string | null
  onShopOrderPlaced?: (selection: { shopId: string; productId: string }) => void
  onShopOrderReady?: (order: { id: string; shopId: string; productId: string; productName: string }) => void
  onShopNotificationOpen?: (shopId: string) => void
  availableShopIds?: readonly string[]
  shopOrders?: Readonly<Record<string, CrossShopOrder>>
  heldConsumable?: HeldConsumable | null
  walletBalance?: number
  gameTimeMs?: number
  preparationConfiguredByShop?: Readonly<Record<string, boolean>>
  onShopOrderConfirm?: (selection: { shopId: string; productId: string; idempotencyKey: string; options?: Record<string, string | number | boolean | null> }) => { ok: boolean; reason?: string }
  onLegacyShopOrderCancel?: (shopId: string) => { ok: boolean; reason?: string }
  onRequestedAppHandled?: () => void
  onLaoZhouMessagesDisplayed?: () => void
  onMilkTeaOrderConfirm?: (selection: { drink: MilkTeaDrink; sugar: MilkTeaSugar; ice: MilkTeaIce }) => void
  onMilkTeaOrderStarted?: () => void
  onMeaningfulActivity?: () => void
  onClockActivitySourceChange?: (sourceId: string, source: SessionGameActivitySource | null) => void
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
      {(app === 'fruit-tea' || app === 'yonghe-order' || app === 'cafe-takeaway') && <><path {...common} d="M5 8h14l-1.2 12H6.2L5 8Z" /><path {...common} d="M9 8V5h6v3M8 12h8" /></>}
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

export function WorldPhone({ getPlayerPosition, getRideMapSnapshot, currentSceneId, worldLayer, device, open, onOpen, onClose, onCloseComplete, onRideRequest, rideOrder = null, notifications = [], storyClock, gameTimeLabel, notificationScreen = false, onNotificationDismiss, onAppOpen, feedbackMode = null, onFeedbackModeChange, onFeedbackOpen, onFeedbackSubmit, milkTeaAppUnlocked = false, milkTeaOrder = null, milkTeaHeld = false, ruoyuMessagesUnlocked = false, requestedApp = null, requestedShopId = null, requestedShopProductId = null, onShopOrderPlaced, onShopOrderReady, onShopNotificationOpen, availableShopIds = [], shopOrders = {}, heldConsumable = null, walletBalance = 800, gameTimeMs = 0, preparationConfiguredByShop = {}, onShopOrderConfirm, onLegacyShopOrderCancel, onRequestedAppHandled, onLaoZhouMessagesDisplayed, onMilkTeaOrderConfirm, onMilkTeaOrderStarted, onMeaningfulActivity, onClockActivitySourceChange, notes = [], yongheLeadUnlocked = false, contactNotes = {}, callHistory = [], onNoteCreate, onNoteChange, onNotePin, onContactNoteChange, onCallRecord }: WorldPhoneProps) {
  const clockSourceId = useId()
  const currentLandmark = landmarkForScene(currentSceneId)
  const [displayDevice, setDisplayDevice] = useState<PhoneDevice>(device)
  const [phase, setPhase] = useState<WorldPhonePhase>('closed')
  const [leavingApp, setLeavingApp] = useState<PhoneApp | 'home' | null>(null)
  const [appOrigin, setAppOrigin] = useState('50% 80%')
  const phoneRef = useRef<HTMLElement>(null)
  const laoZhouMessageHandoffPendingRef = useRef(false)
  const [placeCall, setPlaceCall] = useState<string | null>(null)
  const [activeApp, setActiveApp] = useState<PhoneApp | null>(null)
  const [contactView, setContactView] = useState<ContactView>('list')
  const [milkTeaClock, setMilkTeaClock] = useState(() => Date.now())
  const [milkTeaDrink, setMilkTeaDrink] = useState<MilkTeaDrink | null>(null)
  const [milkTeaSugar, setMilkTeaSugar] = useState<MilkTeaSugar | null>(null)
  const [milkTeaIce, setMilkTeaIce] = useState<MilkTeaIce | null>(null)
  const milkTeaOrderStartedRef = useRef(false)
  const phoneReading = open && (notificationScreen || !['map', 'ride', 'feedback', 'milk-tea'].includes(activeApp ?? ''))
  useEffect(() => {
    const sourceId = `phone:${clockSourceId}:reading`
    onClockActivitySourceChange?.(sourceId, phoneReading ? 'phone-reading' : null)
    return () => onClockActivitySourceChange?.(sourceId, null)
  }, [clockSourceId, onClockActivitySourceChange, phoneReading])
  const [selectedContactId, setSelectedContactId] = useState<ContactId>('lao-zhou')
  const [contactNoteDraft, setContactNoteDraft] = useState('')
  const [activeCallStartedAt, setActiveCallStartedAt] = useState<number | null>(null)
  const [locationCardOpen, setLocationCardOpen] = useState(false)
  const [orientationPermission, setOrientationPermission] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [yonghePreviewMapZoom, setYonghePreviewMapZoom] = useState<PhoneMapZoomLevel>(1.65)
  const [yonghePreviewMapPan, setYonghePreviewMapPan] = useState<MapPoint>([0, 0])
  const [yongheMapHandoffPhase, setYongheMapHandoffPhase] = useState<'opening' | 'settled' | null>(null)
  const placeMapCardRef = useRef<HTMLElement>(null)
  const placeCardTiltRef = useRef<HTMLElement>(null)
  const orientationBaselineRef = useRef<{ beta: number; gamma: number } | null>(null)
  const mapHandoffLayerRef = useRef<HTMLDivElement>(null)
  const mapHandoffSourceRectRef = useRef<DOMRect | null>(null)
  const mapHandoffAnimationsRef = useRef<Animation[]>([])
  const mapHandoffOwnerRef = useRef<symbol | null>(null)
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null)
  const [mapFocusRequestId, setMapFocusRequestId] = useState<string | null>(null)
  const [mapSheetHeight, setMapSheetHeight] = useState(0)
  const [contactDirection, setContactDirection] = useState(1)
  const [mapZoom, setMapZoom] = useState<PhoneMapZoomLevel>(1)
  const [selectedRideDestinationId, setSelectedRideDestinationId] = useState<string | null>(null)
  const [activeShopId, setActiveShopId] = useState<string | null>(null)
  const [preselectedShopProductId, setPreselectedShopProductId] = useState<string | null>(null)
  const openSessionRef = useRef(false)
  const closeCompletionReportedRef = useRef(false)
  const closeTransitionStartedRef = useRef(false)
  const [mapPan, setMapPan] = useState<MapPoint>([0, 0])
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
  const yongheLeadNote = notes.find(note => note.id === 'story-yonghe-lead')
  const widgetNotes = notes.filter(note => note.status === 'current' && note.id !== pinnedMemo?.id).slice(0, 2)
  const memo = pinnedMemo ?? widgetNotes[0] ?? null
  const selectedContact = innerContacts.find((contact) => contact.id === selectedContactId) ?? innerContacts[0]
  const supportsOrientationPermission = typeof window !== 'undefined'
    && typeof (window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }).requestPermission === 'function'
  const isTouchDevice = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches))

  const requestPlaceCardOrientation = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const orientationEvent = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
    if (!orientationEvent.requestPermission) return
    try {
      const result = await orientationEvent.requestPermission()
      setOrientationPermission(result === 'granted' ? 'granted' : 'denied')
    } catch {
      setOrientationPermission('denied')
    }
  }

  useEffect(() => {
    if (!locationCardOpen || !isTouchDevice || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      orientationBaselineRef.current = null
      placeCardTiltRef.current?.style.removeProperty('--place-tilt-x')
      placeCardTiltRef.current?.style.removeProperty('--place-tilt-y')
      return undefined
    }
    if (supportsOrientationPermission && orientationPermission !== 'granted') return undefined

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      if (!orientationBaselineRef.current) orientationBaselineRef.current = { beta: event.beta, gamma: event.gamma }
      const deltaBeta = Math.max(-8, Math.min(8, event.beta - orientationBaselineRef.current.beta))
      const deltaGamma = Math.max(-8, Math.min(8, event.gamma - orientationBaselineRef.current.gamma))
      const card = placeCardTiltRef.current
      if (!card) return
      card.style.setProperty('--place-tilt-x', `${deltaBeta * -0.22}deg`)
      card.style.setProperty('--place-tilt-y', `${deltaGamma * 0.22}deg`)
    }
    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      orientationBaselineRef.current = null
      placeCardTiltRef.current?.style.removeProperty('--place-tilt-x')
      placeCardTiltRef.current?.style.removeProperty('--place-tilt-y')
    }
  }, [locationCardOpen, isTouchDevice, orientationPermission, supportsOrientationPermission])
  const shopTitle = activeShopId ? shopTitleForId(activeShopId) : ''
  const shopProducts: ShopOrderProduct[] = activeShopId === crossShopIds.milkTea || activeShopId === crossShopIds.fruitTea
    ? commercialStreetDrinkCatalog.filter(product => product.storeId === activeShopId).map(product => ({ id: product.id, name: product.name, price: product.price, customization: product.customization }))
    : activeShopId === crossShopIds.yonghe ? [...yongheTakeawayCatalog] : activeShopId === crossShopIds.cafeTakeaway ? [...commercialCafeTakeawayCatalog] : []

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
    if (app === 'milk-tea') setActiveShopId(availableShopIds.includes(crossShopIds.milkTea) ? crossShopIds.milkTea : availableShopIds[0] ?? null)
    else if (app === 'fruit-tea') setActiveShopId(crossShopIds.fruitTea)
    else if (app === 'yonghe-order') setActiveShopId(crossShopIds.yonghe)
    else if (app === 'cafe-takeaway') setActiveShopId(crossShopIds.cafeTakeaway)
    else setActiveShopId(null)
    if (activeApp && activeApp !== app) setLeavingApp(app)
    else setActiveApp(app)
    setYongheMapHandoffPhase(null)
    if (app !== 'contacts') setContactView('list')
    setLocationCardOpen(false)
  }

  const closeApp = () => {
    if (leavingApp) return
    setYongheMapHandoffPhase(null)
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
    setYongheMapHandoffPhase(null)
    if (activeCallStartedAt !== null) finishCall()
    onClose()
  }, [activeCallStartedAt, finishCall, onClose])

  const openYongheMapFromCard = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    if (yongheMapHandoffPhase === 'opening' || leavingApp) return
    const root = phoneRef.current
    const preview = placeMapCardRef.current
    const layer = mapHandoffLayerRef.current
    const sourceRect = preview?.getBoundingClientRect() ?? null
    if (root && preview && layer && sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
      const clone = preview.cloneNode(true) as HTMLElement
      clone.setAttribute('data-yonghe-handoff-map', 'true')
      clone.setAttribute('aria-hidden', 'true')
      clone.setAttribute('inert', '')
      Object.assign(clone.style, {
        position: 'absolute',
        left: `${sourceRect.left - root.getBoundingClientRect().left}px`,
        top: `${sourceRect.top - root.getBoundingClientRect().top}px`,
        width: `${sourceRect.width}px`,
        height: `${sourceRect.height}px`,
        margin: '0',
        transformOrigin: 'top left',
        transform: 'none',
        maxHeight: `${sourceRect.height}px`,
        maxWidth: `${sourceRect.width}px`,
        padding: '7px',
        border: '1px solid #18191d35',
        borderRadius: '12px',
        background: '#eeeef0',
        opacity: '1',
        visibility: 'visible',
        pointerEvents: 'none',
        animation: 'none',
        scale: '1',
        zIndex: '1',
      })
      clone.querySelector('.world-phone__place-card-close')?.remove()
      clone.querySelector('.world-phone__place-card-orientation')?.remove()
      layer.replaceChildren(clone)
      mapHandoffSourceRectRef.current = sourceRect
    }
    onAppOpen?.('map')
    setSelectedMapPlaceId('yonghe-eatery')
    setMapFocusRequestId('yonghe-eatery')
    setMapZoom(1.65)
    setMapPan([0, 0])
    setContactView('list')
    setLocationCardOpen(false)
    setActiveApp('map')
    setYongheMapHandoffPhase(sourceRect && root && layer ? 'opening' : 'settled')
  }

  useLayoutEffect(() => {
    if (yongheMapHandoffPhase !== 'opening') return undefined
    const owner = Symbol('yonghe-map-handoff')
    mapHandoffOwnerRef.current = owner
    const root = phoneRef.current
    const layer = mapHandoffLayerRef.current
    const clone = layer?.querySelector<HTMLElement>('[data-yonghe-handoff-map]')
    const sourceRect = mapHandoffSourceRectRef.current
    const mapView = root?.querySelector<HTMLElement>('.world-phone__app-view[data-app-view="map"]')
    const target = mapView
    if (!root || !layer || !clone || !sourceRect || !target || !mapView) {
      layer?.replaceChildren()
      mapHandoffSourceRectRef.current = null
      if (mapHandoffOwnerRef.current === owner) mapHandoffOwnerRef.current = null
      setYongheMapHandoffPhase('settled')
      return undefined
    }

    const rootRect = root.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const startLeft = sourceRect.left - rootRect.left
    const startTop = sourceRect.top - rootRect.top
    const targetLeft = targetRect.left - rootRect.left
    const targetTop = targetRect.top - rootRect.top
    const translateX = targetLeft - startLeft
    const translateY = targetTop - startTop
    const scaleX = targetRect.width / sourceRect.width
    const scaleY = targetRect.height / sourceRect.height

    const finishImmediately = () => {
      if (mapHandoffOwnerRef.current !== owner) return
      layer.replaceChildren()
      mapHandoffSourceRectRef.current = null
      setYongheMapHandoffPhase('settled')
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof clone.animate !== 'function') {
      finishImmediately()
      return undefined
    }

    const duration = 560
    const mapAnimation = clone.animate([
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, offset: 0 },
      { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, offset: 0.7 },
      { transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`, opacity: 0, offset: 1 },
    ], { duration, easing: 'cubic-bezier(.22,.72,.25,1)', fill: 'forwards' })
    const mapRevealAnimation = mapView.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: 0.7 },
      { opacity: 1, offset: 1 },
    ], { duration, easing: 'linear', fill: 'forwards' })
    mapHandoffAnimationsRef.current = [mapAnimation, mapRevealAnimation]
    mapAnimation.onfinish = finishImmediately
    window.addEventListener('resize', finishImmediately)

    return () => {
      window.removeEventListener('resize', finishImmediately)
      if (mapHandoffOwnerRef.current === owner) {
        mapHandoffAnimationsRef.current.forEach((animation) => animation.cancel())
        mapHandoffAnimationsRef.current = []
        layer.replaceChildren()
        mapHandoffSourceRectRef.current = null
        mapHandoffOwnerRef.current = null
      }
    }
  }, [yongheMapHandoffPhase])

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
    setActiveShopId(availableShopIds[0] ?? null)
    setActiveApp('milk-tea')
    onRequestedAppHandled?.()
  }, [availableShopIds, milkTeaAppUnlocked, onAppOpen, onRequestedAppHandled, open, requestedApp])

  useEffect(() => {
    if (!open || (requestedApp !== 'lao-zhou-messages' && requestedApp !== 'ruoyu-messages')) return
    laoZhouMessageHandoffPendingRef.current = requestedApp === 'lao-zhou-messages'
    onAppOpen?.('contacts')
    setActiveApp('contacts')
    setSelectedContactId(requestedApp === 'ruoyu-messages' ? 'ruoyu' : 'lao-zhou')
    setContactDirection(1)
    setContactView('messages')
    onRequestedAppHandled?.()
  }, [onAppOpen, onRequestedAppHandled, open, requestedApp])

  useEffect(() => {
    if (!open || !requestedShopId) return
    if ((requestedShopId === crossShopIds.milkTea || requestedShopId === crossShopIds.fruitTea)
      && !availableShopIds.includes(requestedShopId)) {
      onRequestedAppHandled?.()
      return
    }
    const app = phoneAppForShopId(requestedShopId)
    if (!app) return
    setActiveShopId(requestedShopId)
    setPreselectedShopProductId(requestedShopProductId ?? null)
    onAppOpen?.(app)
    setActiveApp(app)
    onRequestedAppHandled?.()
  }, [availableShopIds, onAppOpen, onRequestedAppHandled, open, requestedShopId, requestedShopProductId])

  useLayoutEffect(() => {
    const messageThread = phoneRef.current?.querySelector('.world-phone__message-thread')
    if (!commercialCafeCompletionPhoneMessageReadyForAck({
      requested: laoZhouMessageHandoffPendingRef.current,
      phoneOpen: open,
      activeApp,
      contactView,
      selectedContactId,
      messageThreadMounted: Boolean(messageThread),
    })) return
    laoZhouMessageHandoffPendingRef.current = false
    onLaoZhouMessagesDisplayed?.()
  }, [activeApp, contactView, onLaoZhouMessagesDisplayed, open, selectedContactId])

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

  const storyDate = mainlineStoryDateLabel(storyClock)
  const storyTime = gameTimeLabel ?? mainlineStoryTimeLabel(storyClock.stage)
  const worldWeather = mainlineWorldWeatherLabel(displayDevice, storyClock.weatherCycle)
  const calendarYear = storyClock.year ?? 2025
  const calendarMonth = storyClock.month ?? 4
  const calendarDay = storyClock.day ?? 12


  return (
    <>
    {isInteractive && <div className="world-phone__dismiss-region" onPointerDown={event => { event.stopPropagation() }} onPointerUp={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); closePhone() }} />}
    <aside ref={phoneRef}
      className={`world-phone world-phone--${displayDevice} world-phone--phase-${renderedPhase} ${isInteractive ? 'is-open' : ''} ${isMapOpen ? 'world-phone--map-app' : ''}`}
      data-has-notifications={notifications.some(n => n.unread)}
      data-yonghe-map-handoff={yongheMapHandoffPhase ?? 'idle'}
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
      </button>

      <div inert={!isInteractive || yongheMapHandoffPhase === 'opening'} className="world-phone__body" onTransitionEnd={handleBodyTransitionEnd} onTransitionRun={handleBodyTransitionRun} onTransitionCancel={handleBodyTransitionCancel}>
        <section className={`world-phone__panel ${isMapOpen ? 'world-phone__panel--map' : ''}`} role="dialog" aria-label="手机" aria-hidden={!isInteractive}>
          <PhoneNotificationCapsule notifications={notifications} visible={handleIsInteractive && !open && !swapPending} />
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
              {notifications.filter(n => n.unread).map(n => <button type="button" className="world-phone__notification" data-notification-app={n.app} key={n.id} onClick={event => { event.stopPropagation(); n.shopId ? onShopNotificationOpen?.(n.shopId) : openApp(n.app) }}><strong>{n.title}</strong><span>{n.body}</span></button>)}
            </section>
          ) : activeApp === null ? (
            <section className="world-phone__home-screen" tabIndex={0} aria-label="手机主屏">
              <div className="world-phone__home-layout">
                <section className="world-phone__home-calendar" aria-label="剧情日历">
                  <strong>{calendarMonth}月</strong>
                  <div className="world-phone__calendar-grid">
                    {['一','二','三','四','五','六','日'].map(day => <small key={day}>{day}</small>)}
                    {Array.from({ length: storyCalendarLeadingBlankCount(calendarYear, calendarMonth) }, (_, i) => <span key={`blank-${i}`} />)}
                    {Array.from({ length: daysInStoryMonth(calendarYear, calendarMonth) }, (_, i) => i + 1).map(day => <span key={day} aria-current={day === calendarDay ? 'date' : undefined} data-weather={displayDevice === 'inner' ? (Math.floor(day / 7) % 2 ? (storyClock.weatherCycle ?? 'sunny') : (storyClock.weatherCycle === 'rainy' ? 'sunny' : 'rainy')) : undefined}><b>{day}</b></span>)}
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
                    <span className="world-phone__app-label">饮品点单</span>
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
                <div><strong>{activeApp === 'milk-tea' ? '\u996e\u54c1\u70b9\u5355' : activeAppLabel}</strong></div>
              </div>
              <div className="world-phone__app-content" tabIndex={0}>
            {activeApp === 'map' && (
              <div className="world-phone__map-frame">
                <div className="world-phone__map-title">区域地图{!online ? ' · 离线' : ''}</div>
                <PhoneMapCanvas mapRegions={mapRegions} displayDevice={displayDevice} currentLandmark={currentLandmark} selectedMapPlaceId={selectedMapPlaceId} onSelect={id => { setMapFocusRequestId(null); setSelectedMapPlaceId(id) }} mapZoom={mapZoom} setMapZoom={setMapZoom} mapPan={mapPan} setMapPan={setMapPan} focusId={mapFocusRequestId ?? selectedMapPlaceId} coveredHeight={mapSheetHeight} followFocus={yongheMapHandoffPhase === 'opening'} followFocusZoom={1.65} restoreOnBlank onBlank={() => { setSelectedMapPlaceId(null); setMapFocusRequestId(null) }} />
                {yongheMapHandoffPhase !== 'opening' && <PhonePlaceDetails id={selectedMapPlaceId} title={selectedMapTitle} onHeight={setMapSheetHeight} onRide={() => { setSelectedRideDestinationId(selectedMapRegion?.id ?? selectedMapPoi?.region.id ?? null); openApp('ride') }} onCall={() => setPlaceCall('中枢院 · 0000')} />}
                {!online && <p className="world-phone__offline-note">当前为离线地图，显示已缓存路线。</p>}
              </div>
            )}

            {activeApp === 'ride' && <PhoneRideApp regions={mapRegions} device={displayDevice} currentLandmark={currentLandmark} currentSceneId={currentSceneId as MainlineSceneId} order={rideOrder} clock={rideClock} storyClock={storyClock} gameTimeMs={gameTimeMs} available={rideAvailability === 'available'} online={online} destinationId={selectedRideDestinationId} onDestination={setSelectedRideDestinationId} onConfirm={(sceneId,presentation) => onRideRequest?.(displayDevice, sceneId,presentation)} getPosition={getPlayerPosition} getRideMapSnapshot={getRideMapSnapshot} />}

            {activeShopId && activeApp && shopProducts.length > 0 && <ShopOrderApp key={activeShopId} shopId={activeShopId} title={shopTitle} products={shopProducts} initialProductId={preselectedShopProductId} availableShops={availableShopIds.filter(id => id === crossShopIds.milkTea || id === crossShopIds.fruitTea || id === crossShopIds.cafeTakeaway).map(id => ({ id, label: shopTitleForId(id) }))} onShopSelect={setActiveShopId} order={shopOrders[activeShopId] ?? null} heldConsumable={heldConsumable} walletBalance={walletBalance} gameTimeMs={gameTimeMs} preparationConfigured={Boolean(preparationConfiguredByShop[activeShopId])} onConfirm={selection => onShopOrderConfirm?.(selection) ?? { ok: false, reason: 'order-service-unavailable' }} onOrderPlaced={onShopOrderPlaced} onOrderReady={onShopOrderReady} onCancelLegacy={onLegacyShopOrderCancel} />}
            {activeApp === 'milk-tea' && !activeShopId && <section className="world-phone__list-page world-phone__milk-tea" aria-label="奶茶">
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
                <section className="world-phone__message-thread" data-contact-id={selectedContactId} aria-live={selectedContactId === 'ruoyu' ? 'polite' : undefined} aria-label={`与${selectedContact.name}的短信`}>
                  <div className="world-phone__message-person"><span>短信</span><strong>{selectedContact.name}</strong><small>{selectedContact.detail}</small></div>
                  <div className="world-phone__message-date">{selectedContactId === 'ruoyu' ? '刚刚' : '三天前'}</div>
                  {selectedContact.messages.map((message, index) => (
                    <div className={`world-phone__message-bubble ${index % 2 === 0 ? 'world-phone__message-bubble--received' : 'world-phone__message-bubble--sent'}`} key={`${selectedContact.id}-${index}`}>
                      {message}
                    </div>
                  ))}
                  {selectedContactId === 'lao-zhou' && displayDevice === 'inner' && yongheLeadUnlocked && (
                    <div className={`world-phone__message-place ${locationCardOpen ? 'is-expanded' : ''}`} onMouseEnter={() => { if (!isTouchDevice) setLocationCardOpen(true) }} onMouseLeave={() => { if (!isTouchDevice) setLocationCardOpen(false) }} onClick={event => { if (!(event.target instanceof Element) || !event.target.closest('.world-phone__place-card')) setLocationCardOpen(true) }}>
                      <div className="world-phone__place-anchor">
                        <div className="world-phone__message-bubble world-phone__message-bubble--received world-phone__message-bubble--place" role="button" tabIndex={0} aria-label="打开永和小馆地点卡" aria-expanded={locationCardOpen} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setLocationCardOpen(true) }}>
                          <p>永和小馆</p>
                        </div>
                        <section className="world-phone__place-card" ref={element => { placeMapCardRef.current = element; placeCardTiltRef.current = element }} data-yonghe-map-card aria-label="永和小馆地点卡" aria-hidden={!locationCardOpen} inert={!locationCardOpen} onClick={openYongheMapFromCard}>
                          <div className="world-phone__place-card-content">
                            <div className="world-phone__place-card-heading"><strong>永和小馆</strong></div>
                            {locationCardOpen && <div className="world-phone__place-map-preview" data-yonghe-map-preview aria-hidden="true">
                              <PhoneMapCanvas mapRegions={mapRegions} displayDevice={displayDevice} currentLandmark={currentLandmark} selectedMapPlaceId="yonghe-eatery" onSelect={() => {}} mapZoom={yonghePreviewMapZoom} setMapZoom={setYonghePreviewMapZoom} mapPan={yonghePreviewMapPan} setMapPan={setYonghePreviewMapPan} focusId="yonghe-eatery" followFocus followFocusZoom={1.65} />
                            </div>}
                            <div className="world-phone__place-card-copy"><span className="world-phone__place-card-clue-label">线索</span><p>{yongheLeadNote?.body ?? ''}</p></div>
                            {isTouchDevice && supportsOrientationPermission && orientationPermission !== 'granted' && <button type="button" className="world-phone__place-card-orientation" onClick={requestPlaceCardOrientation}>{orientationPermission === 'denied' ? '倾斜效果不可用' : '启用倾斜效果'}</button>}
                            <button type="button" className="world-phone__place-card-close" aria-label="关闭地点卡" onClick={event => { event.stopPropagation(); setLocationCardOpen(false) }}>×</button>
                          </div>
                        </section>
                      </div>
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
                    {innerContacts.filter(contact => ruoyuMessagesUnlocked || contact.id !== 'ruoyu').map((contact) => (
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
      <div ref={mapHandoffLayerRef} className={`world-phone__handoff-layer ${yongheMapHandoffPhase === 'opening' ? 'is-active' : ''}`} aria-hidden="true" />
    </aside>
    </>
  )
}

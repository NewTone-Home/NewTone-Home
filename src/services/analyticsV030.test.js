import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const inserts = vi.hoisted(() => vi.fn(async () => ({ error: null })))
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { from: () => ({ insert: inserts }) } }))
import { buildAnalyticsEvent, flushAnalyticsQueue, trackEvent, setAnalyticsLocation, getInteractionSessions, installDwellTracking, ANALYTICS_STORAGE_KEYS } from './analytics'
import { analyticsReleaseContext } from './analyticsRelease'
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem:k=>data.delete(k), get length(){return data.size}, key:i=>[...data.keys()][i] } }
const ids = { visitorId:'00000000-0000-4000-8000-000000000001', clientEventId:'00000000-0000-4000-8000-000000000002', session:{ id:'00000000-0000-4000-8000-000000000003', sequence:0 }, sessionStorage:storage(), env:{VITE_ANALYTICS_ENVIRONMENT:'staging'} }
let cleanup
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); vi.stubGlobal('localStorage',storage()); vi.stubGlobal('sessionStorage',storage()); inserts.mockClear() })
afterEach(() => { cleanup?.(); cleanup=null; vi.useRealTimers(); vi.unstubAllGlobals() })
describe('0.3.0 event contract', () => {
  it('fixes version/environment at event creation and excludes arbitrary text', () => {
    const payload=buildAnalyticsEvent('shop_order_submitted',{eventData:{shopId:'commercial-cafe-slot',text:'secret',release:'old',environment:'production'}},ids)
    expect(buildAnalyticsEvent('shop_order_submitted',{eventData:{shopId:'arbitrary-input'}},ids)).toBeNull()
    expect(payload.event_data).toEqual({shopId:'commercial-cafe-slot',release:'0.3.0',environment:'staging'})
    expect(analyticsReleaseContext({})).toEqual({release:'0.3.0',environment:'preview'})
    expect(analyticsReleaseContext({DEV:true})).toEqual({release:'0.3.0',environment:'development'})
  })
  it('retries old queue without inventing a release or changing its event ID',async () => {
    const old={client_event_id:ids.clientEventId,event_name:'landing_entry',event_data:{},device_category:'unknown',viewport_width:null,viewport_height:null}
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.pending,JSON.stringify([old]))
    await flushAnalyticsQueue()
    expect(inserts.mock.calls[0][0]).toEqual([old])
    expect(JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })
  it('does not silently discard a failed insert',async () => {
    inserts.mockResolvedValueOnce({error:{code:'23514'}})
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.pending,JSON.stringify([{client_event_id:ids.clientEventId,event_name:'landing_entry'}]))
    expect(await flushAnalyticsQueue()).toBe(false)
    expect(JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toHaveLength(1)
  })
  it('sends exit facts with keepalive even while a normal request is pending',async () => {
    let release
    inserts.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.pending,JSON.stringify([{client_event_id:ids.clientEventId,event_name:'landing_entry'}]))
    const normal=flushAnalyticsQueue();await Promise.resolve()
    const fetcher=vi.fn(async()=>({ok:true,status:201}));vi.stubGlobal('fetch',fetcher)
    await trackEvent('session_end',{exitReason:'unload'},{keepalive:true})
    expect(fetcher).toHaveBeenCalled()
    expect(fetcher.mock.calls.flatMap(([, options])=>JSON.parse(options.body)).some(event=>event.event_name==='session_end')).toBe(true)
    release({error:null});await normal
  })
  it('handles keepalive duplicate IDs without stranding fresh facts',async () => {
    localStorage.setItem(ANALYTICS_STORAGE_KEYS.pending,JSON.stringify([{client_event_id:ids.clientEventId,event_name:'landing_entry'}]))
    const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:409}).mockResolvedValueOnce({ok:false,status:409})
    vi.stubGlobal('fetch',fetcher)
    expect(await flushAnalyticsQueue({keepalive:true})).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEYS.pending))).toEqual([])
  })
  it('queues one raw null-duration record without arbitrary text and preserves its first queued payload',async()=>{
    inserts.mockResolvedValueOnce({error:{code:'503'}})
    const interactions=getInteractionSessions()
    interactions.instant({objectId:'switch',objectKind:'fixture',contentId:'switch',freeText:'not-collected'})
    await Promise.resolve();await Promise.resolve()
    const keys=Object.keys(Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),true]))).filter(key=>key.startsWith(ANALYTICS_STORAGE_KEYS.rawEventPrefix))
    expect(keys).toHaveLength(1)
    const raw=JSON.parse(localStorage.getItem(keys[0]))
    expect(raw.dwell_ms).toBeNull();expect(raw.event_data).not.toHaveProperty('freeText')
    expect(raw.event_data.contentId).toBe('switch')
    await trackEvent('center_object_interacted',{objectId:'other',dwellMs:999},{dependencies:{clientEventId:raw.client_event_id},deferred:true})
    expect(JSON.parse(localStorage.getItem(keys[0]))).toEqual(raw)
    await flushAnalyticsQueue()
  })
  it('installs one lifecycle owner, records hidden time once and resumes BFCache without background inflation',async () => {
    inserts.mockResolvedValueOnce({error:{code:'503'}})
    const doc=new EventTarget(), win=new EventTarget();doc.visibilityState='visible';win.innerWidth=390;win.innerHeight=844;win.setInterval=setInterval;win.clearInterval=clearInterval
    vi.stubGlobal('document',doc);vi.stubGlobal('window',win)
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:503})))
    cleanup=installDwellTracking();expect(installDwellTracking()).toBe(cleanup)
    setAnalyticsLocation('commercial-street','public-lane')
    vi.advanceTimersByTime(5000);doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'))
    win.dispatchEvent(new Event('pagehide'));win.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(60000)
    doc.visibilityState='visible';win.dispatchEvent(new Event('pageshow'))
    vi.advanceTimersByTime(2000);setAnalyticsLocation('commercial-street','cafe');doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'))
    const pending=JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEYS.pending))
    expect(pending.filter(e=>e.event_name==='session_end')).toHaveLength(1)
    expect(pending.filter(e=>e.event_name==='visibility_dwell').map(e=>e.dwell_ms)).toEqual([5000,2000])
    expect(pending.filter(e=>e.event_name==='center_scene_entered').map(e=>e.event_data.roomId)).toEqual(['public-lane','cafe'])
    expect(pending.find(e=>e.event_name==='center_scene_exited').dwell_ms).toBe(7000)
    const checkpoints=pending.filter(e=>e.event_name==='session_checkpoint')
    expect(Math.max(...checkpoints.map(e=>e.event_data.foregroundMs))).toBe(7000)
  })
})

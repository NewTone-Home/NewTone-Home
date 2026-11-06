// Telemetry only: never reads or changes game saves or game-clock ownership.
export const HISTORY_KEY = 'newtone-analytics-web-visit-v2'
export function historyEnabled(env = import.meta.env) { return env?.VITE_PLAYER_HISTORY_V2 === 'true' }
export function createWebVisit({ storage, now = Date.now, id = () => crypto.randomUUID(), emit = () => {}, visible = true, resume = true, openedAt = now(), clock = () => null, identity = () => ({}), location = () => ({}) }) {
  const read = () => { try { return JSON.parse(storage?.getItem(HISTORY_KEY) ?? 'null') } catch { return null } }
  const old = read()
  const resumed = resume && old?.version === 2 && typeof old.visitId === 'string' && Number.isFinite(old.startedAt)
  const documentId = id()
  let state = { version:2, visitId:resumed ? old.visitId : id(), startedAt:resumed ? old.startedAt : openedAt, documentId, lastKnownAt:now(), foregroundMs:resumed && Number.isFinite(old.foregroundMs) ? old.foregroundMs : 0, status:visible ? 'foreground' : 'background', endConfirmed:false }
  let foreground = visible, moving = false, interval = null, disposed = false
  let accountedAt=now()
  const settle=()=>{const at=now();if(foreground)state.foregroundMs+=Math.max(0,at-accountedAt);accountedAt=at}
  const context = () => ({ webVisitId:state.visitId, documentId, gameTimeMs:clock() })
  const save = () => { try { storage?.setItem(HISTORY_KEY, JSON.stringify({...state, idle:interval})) } catch { /* unavailable telemetry storage must not block play */ } }
  const record = (reason, extra = {}) => { settle();state.lastKnownAt=now();save();emit('web_visit_state',{...context(),...state,...identity(),reason,...extra}) }
  const beginIdle = () => { if(foreground && !moving && !interval)interval={...identity(),intervalId:id(),startedAt:now(),gameTimeStartedMs:clock(),...location()} }
  const endIdle = (reason, partial=false, at=now()) => {
    if(!interval)return
    const value=interval;interval=null
    const durationMs=Math.max(0,at-value.startedAt)
    if(durationMs>0)emit('foreground_no_operation',{...context(),...value,endedAt:at,durationMs,possibleAfk:durationMs>30000,partial,reason})
  }
  // Do not count the unsampled reload gap or time after the last checkpoint.
  if(resumed && old.idle && Number.isFinite(old.lastKnownAt) && old.lastKnownAt>=old.idle.startedAt) {
    const durationMs=old.lastKnownAt-old.idle.startedAt
    if(durationMs>0)emit('foreground_no_operation',{...old.idle,webVisitId:old.visitId,documentId:old.documentId,endedAt:old.lastKnownAt,durationMs,possibleAfk:durationMs>30000,partial:true,reason:'document-interrupted'})
  }
  beginIdle();record(resumed?'document-resumed':'opened',{previousLastKnownAt:resumed?old.lastKnownAt:null,previousEndConfirmed:resumed?false:null})
  return {
    context,
    input() { if(disposed)return;endIdle('input');beginIdle();save() },
    moving(value) { if(disposed || moving===Boolean(value))return;endIdle('movement');moving=Boolean(value);beginIdle();save() },
    visible(value) { if(disposed || foreground===Boolean(value))return;settle();endIdle('visibility');foreground=Boolean(value);state.status=foreground?'foreground':'background';beginIdle();record('visibility') },
    locationChanged() { if(disposed)return;endIdle('location-change');beginIdle();save() },
    checkpoint() { if(!disposed)record('checkpoint',{currentNoOperation:interval?{...interval,durationMs:Math.max(0,now()-interval.startedAt),possibleAfk:now()-interval.startedAt>30000}:null}) },
    leave(persisted=false) { if(disposed)return;settle();endIdle('page-leaving',true);foreground=false;state.status='end-unconfirmed';record('page-leaving-signal',{persisted:Boolean(persisted)});save() },
    resume() { if(disposed)return;settle();foreground=true;state.status='foreground';beginIdle();record('page-restored') },
    network(online) { if(!disposed)record(online?'online':'offline') },
    dispose() { disposed=true },
  }
}

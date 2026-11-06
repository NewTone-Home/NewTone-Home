import { cleanDialogueProgress } from './playerHistoryData.js'
// One final raw row per real interaction. Active checkpoints stay local only.
export function createInteractionSessions({ foreground, location, emit, storage, identity = () => ({}), now = Date.now, clock = () => null, onStart = () => {}, id = () => crypto.randomUUID() }) {
  const key = 'newtone-analytics-active-interactions-v1'
  const active = new Map()
  const recovery = []
  const save = () => { try { storage?.setItem(key, JSON.stringify([...recovery,...active.values()])) } catch { /* telemetry never blocks gameplay */ } }
  const checkpoint = () => {
    for (const record of active.values()) record.durationMs = Math.max(0, foreground() - record.baseForeground)
    save()
  }
  // Last document died without a final callback: only the saved lower bound is known.
  try {
    const old = JSON.parse(storage?.getItem(key) ?? '[]')
    if (Array.isArray(old)) for (const record of old) {
      if (typeof record.id === 'string' && typeof record.objectId === 'string') if (emit({ ...record, result:'interrupted', endedAt:record.lastCheckpointAt ?? record.startedAt, partial:true }) === false) recovery.push(record)
    }
  } catch { /* invalid analytics state is not a game save */ }
  save()
  const finish = (channel, result = 'completed', options = {}) => {
    const record = active.get(channel)
    if (!record) return false
    const row = { ...record, durationMs:Math.max(0, foreground()-record.baseForeground), endedAt:now(), gameTimeEndedMs:clock(), result:result === 'completed' ? record.result ?? result : result, ...options }
    if (emit(row) === false) { record.durationMs=row.durationMs;record.lastCheckpointAt=row.endedAt;save();return false }
    active.delete(channel);save();return true
  }
  return {
    begin(channel, sessionKey, info) {
      const old=active.get(channel)
      if (old && (old.sessionKey===sessionKey)) return old.id
      if (old) finish(channel,'interrupted')
      const record={...identity(),...location(),...info,id:id(),channel,sessionKey,startedAt:now(),gameTimeStartedMs:clock(),baseForeground:foreground(),durationMs:0,lastCheckpointAt:now()}
      active.set(channel,record);save();onStart(record);return record.id
    },
    finish,
    annotate(channel,result) { const record=active.get(channel);if(!record)return false;record.result=result;save();return true },
    progress(channel,kind,value) { const record=active.get(channel),clean=cleanDialogueProgress(value);if(!record||!clean||!['lastShown','lastConfirmed'].includes(kind))return false;if(kind==='lastConfirmed' && clean.pageIndex===undefined && record.lastShown?.lineId===clean.lineId && record.lastShown?.sentenceIndex===clean.sentenceIndex && record.lastShown?.pageIndex!==undefined)clean.pageIndex=record.lastShown.pageIndex;const previous=record[kind];record[kind]={...(previous?.lineId===clean.lineId && previous?.sentenceIndex===clean.sentenceIndex?previous:{}),...clean,at:now(),gameTimeMs:clock()};save();return true },
    snapshot() { return [...active.values()].map(({id,objectId,objectKind,lastShown,lastConfirmed})=>({interactionId:id,objectId,objectKind,lastShown,lastConfirmed})) },
    has:channel=>active.has(channel),
    instant(info,result='completed') {
      return emit({...identity(),...location(),...info,id:id(),startedAt:now(),endedAt:now(),gameTimeStartedMs:clock(),gameTimeEndedMs:clock(),durationMs:null,result})
    },
    checkpoint() { checkpoint();for(const record of active.values())record.lastCheckpointAt=now();save() },
    endLocation(sceneId,roomId) { for(const [channel,record] of [...active])if(record.sceneId===sceneId && record.roomId===roomId)finish(channel,'interrupted') },
    endAll(result='interrupted',options={}) { for(const channel of [...active.keys()])finish(channel,result,options) },
  }
}

// Strict payload boundary: IDs/indices only; no free text or arbitrary nested JSON.
const identifier = value => typeof value==='string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(value) ? value : undefined
const number = value => typeof value==='number' && Number.isFinite(value) && value>=0 ? value : undefined
export function cleanDialogueProgress(value) {
  if(!value || typeof value!=='object' || !identifier(value.lineId))return undefined
  const result={lineId:value.lineId}
  for(const key of ['sentenceIndex','pageIndex','at','gameTimeMs'])if(number(value[key])!==undefined)result[key]=value[key]
  return result
}
export function cleanHistoryData(value) {
  if(!value || typeof value!=='object')return {}
  const result={}
  for(const key of ['webVisitId','documentId','interactionId','intervalId','roomId','sceneId','contentId','status','reason'])if(identifier(value[key]))result[key]=value[key]
  for(const key of ['startedAt','endedAt','lastKnownAt','previousLastKnownAt','durationMs','foregroundMs','gameTimeMs','gameTimeStartedMs','gameTimeEndedMs'])if(number(value[key])!==undefined || value[key]===null)result[key]=value[key]
  for(const key of ['possibleAfk','partial','persisted','endConfirmed','internalTest'])if(typeof value[key]==='boolean')result[key]=value[key]
  if(value.historyProtocol===2)result.historyProtocol=2
  if(/^[a-f0-9]{40}$/i.test(value.buildSha ?? ''))result.buildSha=value.buildSha
  else if(value.buildSha===null)result.buildSha=null
  for(const key of ['lastShown','lastConfirmed']) { const clean=cleanDialogueProgress(value[key]);if(clean)result[key]=clean }
  if(Array.isArray(value.activeInteractions))result.activeInteractions=value.activeInteractions.slice(0,8).map(item=>({...cleanHistoryData({...item,activeInteractions:undefined}),...(identifier(item.objectId)?{objectId:item.objectId}:{}),...(identifier(item.objectKind)?{objectKind:item.objectKind}:{})}))
  if(value.currentNoOperation && typeof value.currentNoOperation==='object') {
    const clean=cleanHistoryData({...value.currentNoOperation,currentNoOperation:undefined});result.currentNoOperation=clean
  }
  return result
}

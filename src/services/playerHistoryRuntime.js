import { createWebVisit, historyEnabled } from './playerHistory.js'
let visit = null, clockReader = null
export function installHistoryClock(reader) { clockReader=reader;return()=>{if(clockReader===reader)clockReader=null} }
export function readHistoryClock() { try { const value=clockReader?.();return Number.isFinite(value)&&value>=0?value:null } catch { return null } }
function provenance(env=import.meta.env) {
  const sha=/^[a-f0-9]{40}$/i.test(env?.VITE_BUILD_SHA ?? '')?env.VITE_BUILD_SHA:null
  let internalTest=env?.DEV===true || env?.VITE_ANALYTICS_ENVIRONMENT!=='production'
  try { internalTest ||= globalThis.localStorage?.getItem('newtone-analytics-internal-test-v1')==='true' } catch { /* annotation only */ }
  return {buildSha:sha,internalTest}
}
export function historyContext(env=import.meta.env) {
  if(!historyEnabled(env))return {}
  return {...visit?.context(),...provenance(env),gameTimeMs:readHistoryClock(),historyProtocol:2}
}
export function installPlayerHistory({emit,location,env=import.meta.env}={}) {
  if(!historyEnabled(env)||typeof document==='undefined'||visit)return()=>{}
  const navigation=globalThis.performance?.getEntriesByType?.('navigation')?.[0]?.type
  visit=createWebVisit({identity:()=>provenance(env),openedAt:Number.isFinite(globalThis.performance?.timeOrigin)?globalThis.performance.timeOrigin:Date.now(),resume:navigation!=='navigate',storage:globalThis.sessionStorage,visible:document.visibilityState!=='hidden',clock:readHistoryClock,location,emit})
  const owned=visit
  return()=>{if(visit===owned){owned.dispose();visit=null}}
}
export function historyActivity(kind,value) {
  if(kind==='input')visit?.input()
  else if(kind==='moving')visit?.moving(value)
  else if(kind==='visible')visit?.visible(value)
  else if(kind==='leave')visit?.leave(value)
  else if(kind==='resume')visit?.resume()
  else if(kind==='network')visit?.network(value)
  else if(kind==='location')visit?.locationChanged()
  else if(kind==='checkpoint')visit?.checkpoint()
}

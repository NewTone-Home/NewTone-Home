import { describe,it,expect,vi } from 'vitest'
import { createRuntimeRecovery } from './runtimeRecovery.mjs'
import { observeRuntimeEntry } from './runtimeEntryLifecycle.mjs'
import { createEntryController } from './entryController.mjs'
function fixture() {
  const listeners=new Set();let active=true
  const handle={check(){if(!active)throw Error('save-session-stopped')},onStop(fn){listeners.add(fn);return()=>listeners.delete(fn)},close:vi.fn(()=>{active=false;for(const fn of listeners)fn('session-closed')})}
  const ticket={opaque:true},receipt={retained:true}
  const service={getRecoveryState:vi.fn(async()=>({status:'no-pending-operation'})),inspectSave:vi.fn(async()=>({status:'ready',classification:'empty',allowedActions:['create'],snapshotToken:'opaque'})),prepareEntry:vi.fn(async()=>({status:'prepared',ticket})),commitEntry:vi.fn(async()=>({status:'committed',ticket,receipt,snapshot:{values:{}},sessionHandle:handle}))}
  return {handle,service,controller:createEntryController(service),ticket,receipt,listeners}
}
describe('runtime failure recovery path',()=>{
  it.each(['legacy-or-bootstrap-slot-changed','storage-write-failed'])('stops %s and keeps the first cause when revoked cleanup throws',async cause=>{
    const {handle,controller,service,ticket,receipt,listeners}=fixture()
    await controller.start();await controller.submit('create')
    const rendered=vi.fn(evidence=>controller.runtimeFailed(evidence)),recovery=createRuntimeRecovery(rendered)
    recovery.reset(handle)
    let observer
    const lifecycle=observeRuntimeEntry(handle,error=>recovery.report(error,{stage:'session-stop'},handle,observer))
    observer={handle,lifecycle}
    for(const fn of [...listeners])fn(cause)
    recovery.report(Error('save-session-not-open'),{stage:'runtime-boundary',componentStack:'Center cleanup'},handle,observer)
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(()=>handle.check()).toThrow()
    expect(controller.getState().phase).toBe('failed')
    expect(controller.getState().runtimeEvidence.first.message).toBe(cause)
    expect(controller.getState().runtimeEvidence.events.at(-1).message).toBe('save-session-not-open')
    expect(rendered).toHaveBeenCalled()
    expect(service.prepareEntry).toHaveBeenCalledTimes(1);expect(service.commitEntry).toHaveBeenCalledTimes(1)
    expect(ticket).toEqual({opaque:true});expect(receipt).toEqual({retained:true})
  })
  it('keeps ACK uncertain even when its stop callback reaches the recovery shell first',async()=>{
    const {handle,controller,service,listeners}=fixture()
    await controller.start();await controller.submit('create')
    const recovery=createRuntimeRecovery(evidence=>controller.runtimeFailed(evidence));recovery.reset(handle)
    let observer
    const lifecycle=observeRuntimeEntry(handle,error=>recovery.report(error,{stage:'session-stop'},handle,observer))
    observer={handle,lifecycle}
    service.acknowledgeEntry=async()=>{
      for(const fn of [...listeners])fn('ack-write-failed')
      return {status:'outcome-uncertain',reasonCodes:['ACK_WRITE_FAILED']}
    }
    await controller.acknowledgeEntered({abandon:reason=>lifecycle.abandon(reason,{notifyUI:false})})
    expect(controller.getState().phase).toBe('uncertain')
    expect(controller.getState().runtimeEvidence.first.message).toBe('ack-write-failed')
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(service.prepareEntry).toHaveBeenCalledTimes(1)
  })
  it('records an actual import exception and closes even without an attached observer',()=>{
    const {handle}=fixture(),notify=vi.fn(),recovery=createRuntimeRecovery(notify),error=Error('chunk-load-failed')
    recovery.reset(handle);recovery.report(error,{stage:'runtime-import'},handle)
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0].first.stack).toBe(error.stack)
  })
  it('StrictMode observer disposal alone does not trigger recovery or close',()=>{
    const {handle}=fixture(),notify=vi.fn(),recovery=createRuntimeRecovery(notify)
    recovery.reset(handle)
    const first=observeRuntimeEntry(handle,error=>recovery.report(error));first.dispose()
    const second=observeRuntimeEntry(handle,error=>recovery.report(error));second.dispose()
    expect(handle.close).not.toHaveBeenCalled();expect(notify).not.toHaveBeenCalled()
  })
})

import { describe,it,expect,vi } from 'vitest'
import { createEntryController } from './entryController.mjs'
import { observeRuntimeEntry } from './runtimeEntryLifecycle.mjs'
function setup() {
  const listeners=new Set();let closed=false
  const handle={check(){if(closed)throw Error('stopped')},onStop(fn){listeners.add(fn);return()=>listeners.delete(fn)},close:vi.fn(()=>{closed=true;for(const fn of listeners)fn('session-closed')})}
  const ticket={opaque:true},receipt={id:'retained'}
  const service={getRecoveryState:async()=>({status:'no-pending-operation'}),inspectSave:async()=>({status:'ready',classification:'empty',allowedActions:['create'],snapshotToken:'opaque'}),prepareEntry:vi.fn(async()=>({status:'prepared',ticket})),commitEntry:vi.fn(async()=>({status:'committed',ticket,receipt,snapshot:{values:{}},sessionHandle:handle})),acknowledgeEntry:vi.fn()}
  const controller=createEntryController(service)
  return {controller,service,handle,ticket,receipt,listeners}
}
describe('ACK failure explicitly abandons the UI session',()=>{
  it.each(['write-failed','throw','service-stopped-first'])('releases the old writer after %s without recreating a game',async mode=>{
    const {controller,service,handle,ticket,receipt,listeners}=setup()
    await controller.start();await controller.submit('create')
    const observer=observeRuntimeEntry(handle,reason=>controller.stopped(reason))
    service.acknowledgeEntry.mockImplementation(async()=>{
      if(mode==='service-stopped-first')for(const fn of listeners)fn('ack-storage-failed')
      if(mode==='throw')throw Error('lost response')
      return {status:'outcome-uncertain',ticket,reasonCodes:['ACK_WRITE_FAILED']}
    })
    const abandon=reason=>observer.abandon(reason,{notifyUI:false})
    await Promise.all([controller.acknowledgeEntered({abandon}),controller.acknowledgeEntered({abandon})])
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(()=>handle.check()).toThrow()
    expect(controller.getState().phase).toBe('uncertain')
    expect(service.prepareEntry).toHaveBeenCalledTimes(1)
    expect(service.commitEntry).toHaveBeenCalledTimes(1)
    expect(service.acknowledgeEntry).toHaveBeenCalledWith({ticket,sessionHandle:handle})
    expect(receipt).toEqual({id:'retained'});expect(ticket).toEqual({opaque:true})
    expect(listeners.size).toBe(0)
  })
  it('ordinary observer cleanup does not close a successful handle',async()=>{
    const {controller,handle}=setup()
    await controller.start();await controller.submit('create')
    const first=observeRuntimeEntry(handle,reason=>controller.stopped(reason));first.dispose()
    const second=observeRuntimeEntry(handle,reason=>controller.stopped(reason));second.dispose()
    expect(handle.close).not.toHaveBeenCalled();expect(()=>handle.check()).not.toThrow()
  })
})

import { describe,it,expect,vi } from 'vitest'
import { canAdoptRuntime } from './runtimeEntryIdentity.mjs'
import { createRuntimeRecovery } from './runtimeRecovery.mjs'
describe('terminal runtime identity survives development effect replay',()=>{
  it('does not clear recovery or remount a handle closed by a render error',()=>{
    let open=true
    const handle={get isOpen(){return open},close:vi.fn(()=>{open=false})}
    const committed={sessionHandle:handle},beforeFailure={phase:'entering',committed}
    const recoverUI=vi.fn(),recovery=createRuntimeRecovery(recoverUI)
    expect(recovery.reset(handle)).toBe(true)
    expect(canAdoptRuntime(beforeFailure,committed,recovery)).toBe(true)
    recovery.report(Error('BOUNDARY_RENDER_SENTINEL'),{stage:'runtime-boundary'},handle)
    // React may replay the earlier effect closure. Even its old state identity
    // cannot erase the terminal latch or authorize a late import/ready callback.
    expect(recovery.reset(handle)).toBe(false)
    expect(canAdoptRuntime(beforeFailure,committed,recovery)).toBe(false)
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(recoverUI.mock.calls[0][0].first.message).toBe('BOUNDARY_RENDER_SENTINEL')
  })
  it('rejects an old result after the controller moved to another operation',()=>{
    const old={sessionHandle:{isOpen:true}},next={sessionHandle:{isOpen:true}},recovery=createRuntimeRecovery(vi.fn())
    expect(canAdoptRuntime({phase:'entering',committed:next},old,recovery)).toBe(false)
    expect(canAdoptRuntime({phase:'failed',committed:old},old,recovery)).toBe(false)
    expect(canAdoptRuntime({phase:'entering',committed:next},next,recovery)).toBe(true)
  })
  it('does not mark a healthy StrictMode effect cleanup as terminal',()=>{
    const handle={isOpen:true,close:vi.fn()},result={sessionHandle:handle},recovery=createRuntimeRecovery(vi.fn())
    expect(recovery.reset(handle)).toBe(true)
    expect(recovery.reset(handle)).toBe(true)
    expect(canAdoptRuntime({phase:'entering',committed:result},result,recovery)).toBe(true)
    expect(handle.close).not.toHaveBeenCalled()
  })
})

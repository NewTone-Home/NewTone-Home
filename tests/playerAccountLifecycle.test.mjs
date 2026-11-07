import { describe, expect, it, vi } from 'vitest'
import { installPlayerAccountLifecycle } from '../src/services/playerAccountLifecycle.mjs'

describe('account host lifecycle', () => {
  it('suspends only account runtime offline and checkpoints hidden/pagehide best effort', () => {
    const windowTarget = new EventTarget(), documentTarget = new EventTarget()
    documentTarget.visibilityState = 'visible'
    let source = { ownerId: 'account' }
    const saveCoordinator = { getSnapshot: () => ({ source }), suspend: vi.fn(), checkpoint: vi.fn() }
    const dispose = installPlayerAccountLifecycle({ saveCoordinator, windowTarget, documentTarget })
    windowTarget.dispatchEvent(new Event('offline'))
    expect(saveCoordinator.suspend).toHaveBeenCalledWith('ACCOUNT_SESSION_NOT_ACTIVE')
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    expect(saveCoordinator.checkpoint).not.toHaveBeenCalled()
    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatchEvent(new Event('visibilitychange'))
    windowTarget.dispatchEvent(new Event('pagehide'))
    expect(saveCoordinator.checkpoint).toHaveBeenCalledTimes(2)
    source = { guestId: 'guest' }
    windowTarget.dispatchEvent(new Event('offline')); windowTarget.dispatchEvent(new Event('pagehide'))
    expect(saveCoordinator.suspend).toHaveBeenCalledTimes(1)
    expect(saveCoordinator.checkpoint).toHaveBeenCalledTimes(2)
    dispose(); source = { ownerId: 'account' }
    windowTarget.dispatchEvent(new Event('offline'))
    expect(saveCoordinator.suspend).toHaveBeenCalledTimes(1)
  })
  it('handles initially offline accounts and contains rejected checkpoints', async () => {
    const windowTarget = new EventTarget(), documentTarget = new EventTarget()
    windowTarget.navigator = { onLine: false }
    const saveCoordinator = { getSnapshot: () => ({ source: { ownerId: 'account' } }), suspend: vi.fn(), checkpoint: vi.fn().mockRejectedValue(new Error('offline')) }
    const dispose = installPlayerAccountLifecycle({ saveCoordinator, windowTarget, documentTarget })
    expect(saveCoordinator.suspend).toHaveBeenCalledTimes(1)
    windowTarget.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()
    dispose()
  })
})

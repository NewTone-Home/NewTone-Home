import { describe, it, expect, vi } from 'vitest'
import { observeRuntimeEntry } from './runtimeEntryLifecycle.mjs'
function fixture() {
  const listeners = new Set()
  const handle = { onStop(fn) { listeners.add(fn); return () => listeners.delete(fn) }, close: vi.fn(() => { for (const fn of listeners) fn('session-closed') }) }
  const stopped = vi.fn()
  return { handle, stopped, listeners }
}
describe('runtime entry observer and explicit abandonment', () => {
  it.each(['SESSION_INITIALIZATION_FAILED', 'RUNTIME_LOAD_FAILED'])('closes the acquired session on %s', reason => {
    const { handle, stopped, listeners } = fixture()
    const observer = observeRuntimeEntry(handle, stopped)
    observer.abandon(reason)
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(stopped).toHaveBeenCalledExactlyOnceWith(reason)
    expect(listeners.size).toBe(0)
  })
  it('repeated abandonment closes and notifies only once without onStop recursion', () => {
    const { handle, stopped } = fixture()
    const observer = observeRuntimeEntry(handle, stopped)
    observer.abandon('RUNTIME_LOAD_FAILED'); observer.abandon('RUNTIME_LOAD_FAILED')
    expect(handle.close).toHaveBeenCalledTimes(1); expect(stopped).toHaveBeenCalledTimes(1)
  })
  it('StrictMode cleanup and observer reattachment keep a successful handle open', () => {
    const { handle, stopped, listeners } = fixture()
    const first = observeRuntimeEntry(handle, stopped)
    first.dispose()
    const second = observeRuntimeEntry(handle, stopped)
    expect(handle.close).not.toHaveBeenCalled()
    expect(listeners.size).toBe(1)
    first.abandon('STALE_IMPORT_REJECTION')
    expect(handle.close).not.toHaveBeenCalled()
    second.dispose()
    expect(handle.close).not.toHaveBeenCalled()
  })
  it('handles an already-stopped session callback without reviving or duplicate notification', () => {
    const handle = { onStop(fn) { fn('already-stopped'); return () => {} }, close: vi.fn() }
    const stopped = vi.fn(), observer = observeRuntimeEntry(handle, stopped)
    observer.abandon('SESSION_STOPPED')
    expect(handle.close).toHaveBeenCalledTimes(1)
    expect(stopped).toHaveBeenCalledExactlyOnceWith('already-stopped')
  })
})

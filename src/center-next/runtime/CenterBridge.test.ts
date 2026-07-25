import { describe, expect, it, vi } from 'vitest'
import { defaultCenterDefinition } from '../content/defaultCenterDefinition'
import { createDefaultCenterViewSnapshot } from '../domain/invariants'
import { resolveCenterWorld } from '../domain/worldResolver'
import { CenterBridge } from './CenterBridge'

describe('CenterBridge', () => {
  it('moves only stable snapshots and explicit runtime events', () => {
    const bridge = new CenterBridge()
    const view = createDefaultCenterViewSnapshot()
    const world = resolveCenterWorld({
      definition: defaultCenterDefinition,
      committedLocation: { phaseId: 'M1', pageId: 'ancestral-home', beatIndex: 0 },
      furthestLocation: { phaseId: 'M1', pageId: 'ancestral-home', beatIndex: 0 },
    })
    const eventListener = vi.fn()
    const worldListener = vi.fn()
    const viewListener = vi.fn()

    bridge.start({ definition: defaultCenterDefinition, world, view, assetUrls: {} })
    bridge.subscribe(eventListener)
    bridge.subscribeWorld(worldListener)
    bridge.subscribeView(viewListener)
    bridge.emit({ type: 'runtime/ready' })
    bridge.pushWorld(world)
    bridge.pushView(view)

    expect(eventListener).toHaveBeenCalledWith({ type: 'runtime/ready' })
    expect(worldListener).toHaveBeenCalledWith(world)
    expect(viewListener).toHaveBeenCalledWith(view)
    expect(bridge.getInitialState().definition.id).toBe(defaultCenterDefinition.id)
  })

  it('clears listeners and initial state on destroy', () => {
    const bridge = new CenterBridge()
    const listener = vi.fn()
    bridge.subscribe(listener)
    bridge.destroy()
    bridge.emit({ type: 'runtime/ready' })
    expect(listener).not.toHaveBeenCalled()
    expect(() => bridge.getInitialState()).toThrow()
  })
})

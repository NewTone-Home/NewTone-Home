import { describe, expect, it } from 'vitest'
import {
  attachSessionGameClockVisibilityLifecycle,
  createSessionGameClock,
} from '../src/center/runtime/sessionGameClock'
import { attachPositionSaveLifecycle, createGameTimeSaveCheckpoint, createInitialPlayerSave } from '../src/center/runtime/playerSave'
import type { GameClockRateInputs } from '../src/center/runtime/gameClockActivity'

const RATES: GameClockRateInputs = { normalPlay: 30, ordinaryReading: 15, idle: 5 }

class EventTargetHarness {
  private listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const handlers = this.listeners.get(type) ?? new Set()
    handlers.add(listener)
    this.listeners.set(type, handlers)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    for (const handler of this.listeners.get(type) ?? []) handler()
  }
}

function createHarness(now: () => number, visibilityState: DocumentVisibilityState = 'visible') {
  const windowTarget = new EventTargetHarness()
  const documentTarget = Object.assign(new EventTargetHarness(), { visibilityState })
  return {
    windowTarget: windowTarget as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
    documentTarget: documentTarget as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>,
    setVisibility(value: DocumentVisibilityState) { documentTarget.visibilityState = value },
    dispatchWindow: (type: 'pagehide' | 'pageshow') => windowTarget.dispatch(type),
    dispatchDocument: () => documentTarget.dispatch('visibilitychange'),
    now,
  }
}

function createClock(now: () => number, initialGameTimeMs = 0) {
  return createSessionGameClock({ rates: RATES, idleAfterMs: 60_000, now, initialGameTimeMs })
}

describe('session game clock visibility lifecycle', () => {
  it('freezes on hidden, survives scene changes, and resumes once at the current semantic rate', () => {
    let realTimeMs = 0
    const session = createClock(() => realTimeMs)
    const harness = createHarness(() => realTimeMs)
    session.setActivitySource('scene-a:reading', 'phone-reading')
    const snapshots: number[] = []
    const detachLifecycle = attachSessionGameClockVisibilityLifecycle(session, snapshot => snapshots.push(snapshot.gameTimeMs), harness.windowTarget, harness.documentTarget)

    realTimeMs = 2_000
    harness.setVisibility('hidden')
    harness.dispatchDocument()
    expect(session.read()).toMatchObject({ gameTimeMs: 30_000, frozen: true, activity: 'phone-reading', multiplier: 15 })

    realTimeMs = 30_000
    harness.dispatchDocument() // duplicate hidden event is harmless
    session.setActivitySource('scene-a:reading', null)
    session.setActivitySource('scene-b:reading', 'scene-observation')
    expect(session.read()).toMatchObject({ gameTimeMs: 30_000, frozen: true, activity: 'scene-observation', multiplier: 15 })

    harness.setVisibility('visible')
    harness.dispatchDocument()
    harness.dispatchWindow('pageshow')
    harness.dispatchWindow('pageshow') // duplicate resume does not alter the clock
    expect(session.read()).toMatchObject({ gameTimeMs: 30_000, frozen: false, activity: 'scene-observation', multiplier: 15, idle: false })

    realTimeMs = 31_000
    expect(session.read().gameTimeMs).toBe(45_000)
    expect(snapshots).toContain(30_000)
    detachLifecycle()
  })

  it('waits for both visibility and pageshow recovery signals before unfreezing', () => {
    let realTimeMs = 0
    const session = createClock(() => realTimeMs)
    const harness = createHarness(() => realTimeMs)
    const detachLifecycle = attachSessionGameClockVisibilityLifecycle(session, undefined, harness.windowTarget, harness.documentTarget)

    realTimeMs = 1_000
    harness.setVisibility('hidden')
    harness.dispatchDocument()
    harness.dispatchWindow('pagehide')
    realTimeMs = 20_000
    harness.setVisibility('visible')
    harness.dispatchDocument()
    expect(session.read()).toMatchObject({ gameTimeMs: 30_000, frozen: true, freezeReasons: ['page-hidden'] })

    harness.dispatchWindow('pageshow')
    harness.dispatchWindow('pageshow')
    expect(session.read()).toMatchObject({ gameTimeMs: 30_000, frozen: false, freezeReasons: [] })
    realTimeMs = 21_000
    expect(session.read().gameTimeMs).toBe(60_000)
    detachLifecycle()
  })

  it('keeps hidden time out of the game clock while applying the existing idle rate on return', () => {
    let realTimeMs = 0
    const session = createClock(() => realTimeMs)
    const harness = createHarness(() => realTimeMs)
    session.setActivitySource('scene-a:reading', 'phone-reading')
    const detachLifecycle = attachSessionGameClockVisibilityLifecycle(session, undefined, harness.windowTarget, harness.documentTarget)

    realTimeMs = 1_000
    harness.setVisibility('hidden')
    harness.dispatchDocument()
    realTimeMs = 120_000
    harness.setVisibility('visible')
    harness.dispatchDocument()

    expect(session.read()).toMatchObject({ gameTimeMs: 15_000, frozen: false, activity: 'phone-reading', activityMode: 'idle', idle: true, multiplier: 5 })
    realTimeMs = 121_000
    expect(session.read().gameTimeMs).toBe(20_000)
    detachLifecycle()
  })

  it('freezes on pagehide before the save checkpoint and resumes after a refresh without offline catch-up', () => {
    let realTimeMs = 0
    const session = createClock(() => realTimeMs, 600_000)
    const harness = createHarness(() => realTimeMs)
    let save = createInitialPlayerSave()
    const checkpoint = createGameTimeSaveCheckpoint({
      getSave: () => save,
      setSave: next => { save = next },
      getGameTimeMs: () => session.read().gameTimeMs,
      persist: next => next,
    })
    const detachClockLifecycle = attachSessionGameClockVisibilityLifecycle(session, undefined, harness.windowTarget, harness.documentTarget)
    const detachSaveLifecycle = attachPositionSaveLifecycle(() => undefined, () => 'scene-a', harness.windowTarget, harness.documentTarget, checkpoint)

    realTimeMs = 1_000
    harness.dispatchWindow('pagehide')
    expect(save.gameTimeMs).toBe(630_000)
    realTimeMs = 5_000_000
    harness.dispatchWindow('pagehide') // a second flush cannot add hidden time
    expect(save.gameTimeMs).toBe(630_000)

    const refreshedSession = createClock(() => realTimeMs, save.gameTimeMs)
    expect(refreshedSession.read().gameTimeMs).toBe(630_000)
    realTimeMs += 1_000
    expect(refreshedSession.read().gameTimeMs).toBe(660_000)
    detachSaveLifecycle()
    detachClockLifecycle()
  })
})

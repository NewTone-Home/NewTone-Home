import { describe, expect, it } from 'vitest'
import { advanceSessionClock, createSessionActivityTracker, createSessionClockState } from './sessionActivityTracker.js'

describe('event-driven session activity ledger', () => {
  it('settles ten foreground seconds in one advance without a tick', () => {
    const state = advanceSessionClock(createSessionClockState({ startedAt: 0, lastAccountedAt: 0 }), 10_000)
    expect(state).toMatchObject({ foregroundMs: 10_000, engagedMs: 10_000, idleMs: 0, elapsedMs: 10_000 })
  })

  it('settles a long idle interval at the thirty-second threshold in one advance', () => {
    const state = advanceSessionClock(createSessionClockState({ startedAt: 0, lastAccountedAt: 0 }), 70_000)
    expect(state).toMatchObject({ foregroundMs: 70_000, engagedMs: 30_000, idleMs: 40_000 })
  })

  it('counts automatic movement without classifying the interval as idle', () => {
    const moving = { ...createSessionClockState({ startedAt: 0, lastAccountedAt: 0 }), moving: true }
    const settled = advanceSessionClock(moving, 60_000)
    expect(settled).toMatchObject({ movementMs: 60_000, idleMs: 0, engagedMs: 60_000 })
  })

  it('counts a sixty-second Reading interval without classifying it as idle', () => {
    const reading = { ...createSessionClockState({ startedAt: 0, lastAccountedAt: 0 }), reading: true }
    const settled = advanceSessionClock(reading, 60_000)
    expect(settled).toMatchObject({ readingMs: 60_000, idleMs: 0, engagedMs: 60_000 })
  })

  it('counts Phone use independently while idle begins after thirty seconds', () => {
    const phone = { ...createSessionClockState({ startedAt: 0, lastAccountedAt: 0 }), phoneOpen: true }
    const settled = advanceSessionClock(phone, 60_000)
    expect(settled).toMatchObject({ phoneMs: 60_000, engagedMs: 30_000, idleMs: 30_000 })
  })

  it('excludes a hidden interval from all foreground dimensions', () => {
    const initial = createSessionClockState({ startedAt: 0, lastAccountedAt: 0 })
    const hidden = advanceSessionClock({ ...initial, foreground: false }, 30_000)
    expect(hidden).toMatchObject({
      elapsedMs: 30_000,
      foregroundMs: 0,
      engagedMs: 0,
      idleMs: 0,
      movementMs: 0,
      readingMs: 0,
      phoneMs: 0,
    })
  })

  it('settles state transitions before switching the active bucket', () => {
    const tracker = createSessionActivityTracker({ startedAt: 0, lastAt: 0 })
    tracker.setMoving(true, 0)
    tracker.setMoving(false, 60_000)
    expect(tracker.snapshot(60_000)).toMatchObject({ movementMs: 60_000, idleMs: 0 })
  })

  it('ends idle on meaningful input and starts a fresh engaged interval', () => {
    const tracker = createSessionActivityTracker({ startedAt: 0, lastAt: 0 })
    tracker.markActivity(40_000)
    expect(tracker.snapshot(45_000)).toMatchObject({ engagedMs: 35_000, idleMs: 10_000 })
  })

  it('checkpoints opportunistically when an actual event arrives after fifteen seconds', () => {
    const checkpoints = []
    const tracker = createSessionActivityTracker({
      startedAt: 0,
      lastAt: 0,
      onCheckpoint: (snapshot, options) => checkpoints.push({ snapshot, options }),
    })
    expect(tracker.checkpointIfDue(14_999)).toBe(false)
    expect(tracker.markActivity(15_000)).toBe(true)
    expect(checkpoints).toHaveLength(1)
    expect(checkpoints[0].snapshot.foregroundMs).toBe(15_000)
    expect(tracker.checkpoint(15_000, { force: true, keepalive: true })).toBe(true)
    expect(checkpoints[1].options).toEqual({ force: true, keepalive: true })
  })
})

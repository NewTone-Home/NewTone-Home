import { describe, expect, it } from 'vitest'
import { isCurrentEntryMenuMotion, takeEntryMenuIntent } from './entryMenuMotion.mjs'

const entry = { epoch: 5, inspection: { snapshotToken: 'snapshot' } }
const request = () => ({ epoch: 5, snapshot: 'snapshot', intent: 'replace' })
describe('entry visual exit owns only its current submission intent', () => {
  it('consumes once only after the loading caption has settled', () => {
    const record = request()
    expect(takeEntryMenuIntent(record, '开始游戏', '加载游戏中', entry)).toBeNull()
    expect(takeEntryMenuIntent(record, '加载游戏中', '加载游戏中', entry)).toBe('replace')
    expect(takeEntryMenuIntent(record, '加载游戏中', '加载游戏中', entry)).toBeNull()
  })
  it('rejects an old epoch or snapshot without consuming or submitting', () => {
    const record = request()
    expect(isCurrentEntryMenuMotion(record, { ...entry, epoch: 6 })).toBe(false)
    expect(isCurrentEntryMenuMotion(record, { ...entry, inspection: { snapshotToken: 'new' } })).toBe(false)
    expect(takeEntryMenuIntent(record, '加载游戏中', '加载游戏中', { ...entry, epoch: 6 })).toBeNull()
    expect(record.consumed).not.toBe(true)
  })
  it('does nothing after unmount has discarded the record', () => {
    expect(takeEntryMenuIntent(null, '加载游戏中', '加载游戏中', entry)).toBeNull()
  })
})

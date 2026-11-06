import { describe, expect, it, vi } from 'vitest'
import { beginSaveEntry, saveEntryMenuMode } from './saveEntryMenuModel.mjs'

const entry = (phase, actions = []) => ({ phase, inspection: { snapshotToken: 'snapshot-a', allowedActions: actions } })
describe('Start opens a presentation menu without changing the save transaction', () => {
  it('shows Start for both empty and current saves before an explicit click', () => {
    expect(saveEntryMenuMode(entry('start-ready', ['create']), null)).toBe('primary')
    expect(saveEntryMenuMode(entry('choice-ready', ['continue']), null)).toBe('primary')
  })
  it('empty Start submits create directly, with no intermediate choice', () => {
    const expand = vi.fn(), action = vi.fn()
    beginSaveEntry(entry('start-ready', ['create']), expand, action)
    expect(action).toHaveBeenCalledWith('create')
    expect(expand).not.toHaveBeenCalled()
  })
  it('current Start only expands the inspected snapshot and never submits', () => {
    const current = entry('choice-ready', ['continue', 'request-replace'])
    const before = JSON.stringify(current), expand = vi.fn(), action = vi.fn()
    beginSaveEntry(current, expand, action)
    expect(expand).toHaveBeenCalledWith('snapshot-a')
    expect(action).not.toHaveBeenCalled()
    expect(JSON.stringify(current)).toBe(before)
    expect(saveEntryMenuMode(current, 'snapshot-a')).toBe('choices')
    expect(saveEntryMenuMode(current, 'stale-snapshot')).toBe('primary')
  })
  it('keeps legacy reset notice separate from empty, and never silently restarts it', () => {
    const legacy = entry('legacy-ready', ['restart']), action = vi.fn(), expand = vi.fn()
    beginSaveEntry(legacy, expand, action)
    expect(action).not.toHaveBeenCalled()
    expect(saveEntryMenuMode(legacy, 'snapshot-a')).toBe('legacy')
  })
  it.each(['probing', 'unknown', 'failed', 'uncertain', 'entering', 'committing'])('does not bypass protection in %s', phase => {
    const expand = vi.fn(), action = vi.fn()
    beginSaveEntry(entry(phase), expand, action)
    expect(expand).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled()
    expect(saveEntryMenuMode(entry(phase), null)).toBe('status')
  })
})

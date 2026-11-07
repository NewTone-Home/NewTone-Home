import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatPlayerSaveSummary } from '../src/components/player/playerSaveSummary.mjs'
import PlayerSaveConflictPanel from '../src/components/player/PlayerSaveConflictPanel.jsx'
import PlayerSaveRecoveryPanel from '../src/components/player/PlayerSaveRecoveryPanel.jsx'

const actualSummary = { generationId: 'private-generation-id', localRevision: 19, currentSceneId: 'commercial-street',
  storyClock: { dayId: 'story-day-001', stage: 'commercial-street', year: 2025, month: 4, day: 12, hour: 10, minute: 0 },
  gameTimeMs: (11 * 60 + 25) * 60000, updatedAt: Date.UTC(2026, 10, 7, 8, 9),
}
const actualBackupSummary = { kind: 'local-conflict-snapshot', createdAt: '2026-11-07T08:09:10+00:00', sourceFingerprint: 'private-fingerprint' }
describe('real backend summary presentation', () => {
  it('formats actual conflict shape with location, story date, authoritative game time and revision', () => {
    const formatted = formatPlayerSaveSummary(actualSummary)
    expect(formatted).toContain('位置：商业街')
    expect(formatted).toContain('故事日期：2025年4月12日')
    expect(formatted).toContain('故事时间：11:25')
    expect(formatted).not.toContain('10:00')
    expect(formatted).toContain('存档修订：19')
    expect(formatted).toContain('UTC')
    expect(formatted).not.toContain('private-generation-id')
  })
  it('localizes English and supports explicit source labels without choosing the newer record', () => {
    const formatted = formatPlayerSaveSummary(actualSummary, { language: 'en', sourceLabel: 'Cloud copy' })
    expect(formatted).toContain('Cloud copy')
    expect(formatted).toContain('Commercial street')
    expect(formatted).toContain('Story date: 2025-04-12')
    expect(formatted).not.toMatch(/newest|recommended/i)
  })
  it('formats real SQL backup metadata without inventing progress or exposing fingerprints', () => {
    const formatted = formatPlayerSaveSummary(actualBackupSummary, { language: 'en' })
    expect(formatted).toContain('Local version retained during conflict')
    expect(formatted).toContain('07/11/2026')
    expect(formatted).toContain('08:09 UTC')
    expect(formatted).not.toContain('private-fingerprint')
    expect(formatted).not.toContain('Story date')
    expect(formatted).not.toContain('Location')
  })
  it('retains legacy string summaries', () => {
    expect(formatPlayerSaveSummary('At the station', { language: 'en' })).toBe('At the station')
  })
  it('does not invent dates/time from incomplete or invalid clocks', () => {
    for (const summary of [null, [], {}, { storyClock: { stage: 'opening' }, updatedAt: 0 }, { storyClock: { year: 2025, month: 2, day: 31, hour: 99, minute: -1 }, gameTimeMs: -1 }]) {
      expect(formatPlayerSaveSummary(summary, { language: 'en' })).toBe('Progress summary unavailable')
    }
  })
  it('uses saved clock time if gameTimeMs is absent, including midnight', () => {
    expect(formatPlayerSaveSummary({ storyClock: { hour: 0, minute: 3 } }, { language: 'en' })).toBe('Story time: 00:03')
    expect(formatPlayerSaveSummary({ gameTimeMs: 0 }, { language: 'en' })).toBe('Story time: 00:00')
  })
  it('renders actual object summaries in both panels rather than unknown/object coercion', () => {
    const conflict = { slotId: 'slot-1', token: 'comparison', local: { summary: actualSummary }, cloud: { summary: { ...actualSummary, currentSceneId: 'zhongshuyuan-office', gameTimeMs: 15 * 60 * 60000 } } }
    const html = renderToStaticMarkup(createElement(PlayerSaveConflictPanel, { conflict }))
    expect(html).toContain('商业街')
    expect(html).toContain('中枢院内部楼层')
    expect(html).toContain('15:00')
    expect(html).not.toContain('[object Object]')
    expect(html).not.toContain('暂无进度摘要')
    const recovery = renderToStaticMarkup(createElement(PlayerSaveRecoveryPanel, { recovery: { status: 'ready', slotId: 'slot-1', token: 'list', backups: [{ backupId: 'backup-1', summary: actualBackupSummary }] } }))
    expect(recovery).toContain('冲突时保留的本地版本')
    expect(recovery).toContain('UTC')
    expect(recovery).not.toContain('private-fingerprint')
  })
  it('handles unknown scene IDs as labelled text without rendering markup', () => {
    const conflict = { slotId: 'slot-1', token: 'comparison', local: { summary: { currentSceneId: '<script>bad</script>' } }, cloud: { summary: null } }
    const html = renderToStaticMarkup(createElement(PlayerSaveConflictPanel, { conflict }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

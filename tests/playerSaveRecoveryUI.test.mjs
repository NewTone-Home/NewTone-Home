import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerSaveConflictPanel from '../src/components/player/PlayerSaveConflictPanel.jsx'
import PlayerSaveRecoveryPanel from '../src/components/player/PlayerSaveRecoveryPanel.jsx'
import PlayerSaveSlots from '../src/components/player/PlayerSaveSlots.jsx'
import { createPlayerAccountGateActions } from '../src/services/playerAccountGateActions.mjs'

const conflict = { slotId: 'slot-2', token: 'comparison-1', local: { summary: 'At the station', updatedAt: 100 }, cloud: { summary: 'At the park', updatedAt: 200 } }
const recovery = { status: 'ready', slotId: 'slot-2', token: 'backup-list-1', backups: [{ backupId: 'backup-a', summary: 'Before entering the park' }, { backupId: 'backup-b', summary: 'At the station' }] }
const renderConflict = props => renderToStaticMarkup(createElement(PlayerSaveConflictPanel, { language: 'en', conflict, onChooseConflict() {}, onConfirmConflict() {}, onCancelChoice() {}, ...props }))
const renderRecovery = props => renderToStaticMarkup(createElement(PlayerSaveRecoveryPanel, { language: 'en', recovery, onChooseBackup() {}, onConfirmRestore() {}, onCancelChoice() {}, ...props }))
const button = (html, label) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]).find(value => value.includes(label))

describe('explicit conflict choice presentation', () => {
  it('locks a pending choice and offers only recovery of that same operation', () => {
    const html = renderConflict({ conflict: { ...conflict, pendingChoice: 'local' }, selectedChoice: 'cloud' })
    expect(button(html, 'Review and choose · Cloud save')).toContain('disabled')
    expect(button(html, 'Back to comparison')).toContain('disabled')
    expect(html).toContain('Recover the previous choice')
    expect(html).toContain('Use this version of the save? Local save')
  })
  it('does not offer a different choice when an unresolved backup restoration lacks its target ID', () => {
    const html = renderConflict({ conflict: { ...conflict, pendingChoice: 'backup' } })
    expect(button(html, 'Review and choose · Cloud save')).toContain('disabled')
    expect(html).not.toContain('Keep backup and confirm choice')
    expect(html).toContain('Reload saves')
  })
  it('shows both real summaries with neither side chosen, regardless of timestamps', () => {
    const html = renderConflict()
    expect(html).toContain('At the station')
    expect(html).toContain('At the park')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).not.toContain('Keep backup and confirm choice')
    expect(html).toContain('neither is selected by timestamp')
  })
  it.each(['local', 'cloud'])('requires a separate backup-preserving confirmation for %s', selectedChoice => {
    const html = renderConflict({ selectedChoice })
    expect(html).toContain('Keep backup and confirm choice')
    expect(html).toContain('first retains the other version as a backup')
    expect(html).toContain('will not be merged')
    expect(html).toContain('Back to comparison')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
  })
  it('disables choice, confirm and back while the protected transaction is pending', () => {
    const html = renderConflict({ selectedChoice: 'cloud', pending: true })
    for (const label of ['Review and choose', 'Keep backup and confirm choice', 'Back to comparison']) expect(button(html, label)).toContain('disabled')
    expect(html).toContain('role="status"')
  })
  it('fails closed on missing conflict token instead of offering a blind choice', () => {
    const html = renderConflict({ conflict: { ...conflict, token: null } })
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('Review and choose')
  })
  it('renders no operation as a side effect of review or confirmation display', () => {
    const onChooseConflict = vi.fn(), onConfirmConflict = vi.fn()
    renderConflict({ selectedChoice: 'local', onChooseConflict, onConfirmConflict })
    expect(onChooseConflict).not.toHaveBeenCalled()
    expect(onConfirmConflict).not.toHaveBeenCalled()
  })
})

describe('backup recovery presentation', () => {
  it('does not choose a backup or expose restore until an explicit review', () => {
    const html = renderRecovery()
    expect(html).toContain('Before entering the park')
    expect(html).not.toContain('Keep current version and restore backup')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
  })
  it('describes replacement and current-version backup at confirmation', () => {
    const html = renderRecovery({ selectedBackupId: 'backup-b' })
    expect(html).toContain('retains a backup of the current version')
    expect(html).toContain('replacing this save’s progress')
    expect(button(html, 'Keep current version and restore backup')).not.toContain('disabled')
  })
  it('does not restore an ID removed from the latest list', () => {
    const html = renderRecovery({ selectedBackupId: 'removed-backup' })
    expect(html).not.toContain('Keep current version and restore backup')
  })
  it.each(['loading', 'recovering', 'error'])('never shows restore actions in %s', status => {
    const html = renderRecovery({ recovery: { ...recovery, status }, selectedBackupId: 'backup-a' })
    expect(html).not.toContain('Keep current version and restore backup')
  })
  it('distinguishes empty from unverified or duplicate backup lists', () => {
    expect(renderRecovery({ recovery: { ...recovery, backups: [] } })).toContain('No restorable backups')
    for (const backups of [null, [{ backupId: 'same' }, { backupId: 'same' }]]) {
      const html = renderRecovery({ recovery: { ...recovery, backups } })
      expect(html).toContain('role="alert"')
      expect(html).not.toContain('No restorable backups')
    }
  })
  it('exposes backup access for each exact known slot, without creating a default selection', () => {
    const html = renderToStaticMarkup(createElement(PlayerSaveSlots, { language: 'en', status: 'ready', slots: [{ slotId: 'slot-2', label: 'Second save' }], onBackups() {} }))
    expect(html).toContain('Backups and recovery')
    expect(html).toContain('Second save')
    expect(html).not.toContain('aria-pressed="true"')
  })
  it('renders Chinese without replacement characters', () => {
    const html = renderConflict({ language: 'zh', selectedChoice: 'local' }) + renderRecovery({ language: 'zh', selectedBackupId: 'backup-a' })
    expect(html).toContain('保留备份并确认选择')
    expect(html).toContain('保留当前版本并恢复备份')
    expect(html).not.toContain('\uFFFD')
  })
})

describe('recovery action fencing', () => {
  function setup() {
    let snapshot = { status: 'conflict', conflict, recovery, slots: [{ slotId: 'slot-2' }] }
    const saveCoordinator = { getSnapshot: () => snapshot, resolveConflict: vi.fn().mockResolvedValue({ ok: true }), listBackups: vi.fn().mockResolvedValue({ ok: true }), restoreBackup: vi.fn().mockResolvedValue({ ok: true }) }
    const onError = vi.fn()
    return { saveCoordinator, onError, actions: createPlayerAccountGateActions({ saveCoordinator, onError }), setSnapshot: value => { snapshot = value } }
  }
  it('forwards only the exact chosen side, displayed token and slot', async () => {
    const s = setup(), request = { slotId: 'slot-2', token: 'comparison-1', choice: 'cloud' }
    expect((await s.actions.resolveConflict(request)).ok).toBe(true)
    expect(s.saveCoordinator.resolveConflict).toHaveBeenCalledExactlyOnceWith(request)
  })
  it('rejects opposite choice and alternate backup while a previous resolution is pending', async () => {
    const s = setup()
    s.setSnapshot({ status: 'conflict', conflict: { ...conflict, pendingChoice: 'local' }, recovery })
    expect((await s.actions.resolveConflict({ slotId: 'slot-2', token: 'comparison-1', choice: 'cloud' })).ok).toBe(false)
    expect((await s.actions.restoreBackup({ slotId: 'slot-2', token: 'backup-list-1', backupId: 'backup-b' })).ok).toBe(false)
    expect(s.saveCoordinator.restoreBackup).not.toHaveBeenCalled()
    expect(s.saveCoordinator.resolveConflict).not.toHaveBeenCalled()
    expect((await s.actions.resolveConflict({ slotId: 'slot-2', token: 'comparison-1', choice: 'local' })).ok).toBe(true)
  })
  it.each([{ slotId: 'slot-2', token: 'old-token', choice: 'cloud' }, { slotId: 'other-slot', token: 'comparison-1', choice: 'local' }, { slotId: 'slot-2', token: 'comparison-1', choice: 'newest' }])('rejects stale/invalid conflict confirmation %o', async request => {
    const s = setup()
    expect((await s.actions.resolveConflict(request)).error.code).toBe('stale_conflict')
    expect(s.saveCoordinator.resolveConflict).not.toHaveBeenCalled()
  })
  it('rechecks the current snapshot at dispatch after a stale confirmation render', async () => {
    const s = setup()
    s.setSnapshot({ status: 'conflict', conflict: { ...conflict, token: 'changed' } })
    expect((await s.actions.resolveConflict({ slotId: 'slot-2', token: 'comparison-1', choice: 'local' })).ok).toBe(false)
    expect(s.saveCoordinator.resolveConflict).not.toHaveBeenCalled()
  })
  it('loads only the explicitly supplied known/current/conflicted slot', async () => {
    const s = setup()
    expect((await s.actions.listBackups(undefined)).ok).toBe(false)
    expect((await s.actions.listBackups('unknown')).ok).toBe(false)
    expect(s.saveCoordinator.listBackups).not.toHaveBeenCalled()
    await s.actions.listBackups('slot-2')
    expect(s.saveCoordinator.listBackups).toHaveBeenCalledExactlyOnceWith('slot-2')
  })
  it('forwards the exact recovery token and selected backup ID', async () => {
    const s = setup(), request = { slotId: 'slot-2', token: 'backup-list-1', backupId: 'backup-b' }
    expect((await s.actions.restoreBackup(request)).ok).toBe(true)
    expect(s.saveCoordinator.restoreBackup).toHaveBeenCalledExactlyOnceWith(request)
  })
  it.each([{ token: 'stale-list' }, { slotId: 'wrong-slot' }, { backupId: 'removed-backup' }])('rejects changed backup target %o', async changes => {
    const s = setup()
    expect((await s.actions.restoreBackup({ slotId: 'slot-2', token: 'backup-list-1', backupId: 'backup-a', ...changes })).error.code).toBe('stale_backup')
    expect(s.saveCoordinator.restoreBackup).not.toHaveBeenCalled()
  })
  it('guards duplicate restore and returns server verification failures without choosing an alternative', async () => {
    const s = setup(); let finish
    s.saveCoordinator.restoreBackup.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const request = { slotId: 'slot-2', token: 'backup-list-1', backupId: 'backup-a' }
    const first = s.actions.restoreBackup(request)
    expect((await s.actions.restoreBackup(request)).error.code).toBe('busy')
    finish({ ok: false, error: { code: 'BACKUP_CHANGED', message: 'Review the changed backup.' } })
    expect((await first).error.code).toBe('BACKUP_CHANGED')
    expect(s.saveCoordinator.restoreBackup).toHaveBeenCalledTimes(1)
    expect(s.saveCoordinator.resolveConflict).not.toHaveBeenCalled()
  })
})

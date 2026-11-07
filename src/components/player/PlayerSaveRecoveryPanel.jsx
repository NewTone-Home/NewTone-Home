import { useId } from 'react'
import './PlayerAccount.css'
import { formatPlayerSaveSummary } from './playerSaveSummary.mjs'

const copy = {
  zh: { title: '备份与恢复', loading: '正在读取备份…', empty: '这个存档还没有可恢复的备份。', unknown: '暂无进度摘要', review: '查看恢复选项', confirm: '保留当前版本并恢复备份', warning: '恢复前会保留当前版本的备份，再用所选备份替换这个存档的当前进度。不会自动选择最新备份。', back: '返回备份列表', pending: '正在保留当前版本并恢复，请稍候…', failed: '无法确认备份状态，请重新读取后再继续。不会自动替你选择。', retry: '重新读取备份' },
  en: { title: 'Backups and recovery', loading: 'Loading backups…', empty: 'No restorable backups are available for this save.', unknown: 'Progress summary unavailable', review: 'Review restoration', confirm: 'Keep current version and restore backup', warning: 'Recovery retains a backup of the current version before replacing this save’s progress with the selected backup. The newest backup is not selected automatically.', back: 'Back to backups', pending: 'Keeping the current version and restoring…', failed: 'Unable to verify backup state. Reload before continuing; no version will be selected automatically.', retry: 'Reload backups' },
}

/** No restore is sent on selection. Parent holds a selection tied to recovery.token. */
export default function PlayerSaveRecoveryPanel({ recovery, selectedBackupId = null, pending = false, blocked = false,
  language = 'zh', onChooseBackup, onConfirmRestore, onCancelChoice, onRetry,
}) {
  const text = copy[language === 'en' ? 'en' : 'zh'], id = useId()
  const backups = recovery?.backups
  const valid = typeof recovery?.slotId === 'string' && recovery.slotId.length > 0
    && typeof recovery?.token === 'string' && recovery.token.length > 0 && Array.isArray(backups)
    && backups.every(backup => typeof backup?.backupId === 'string' && backup.backupId.length > 0)
    && new Set(backups.map(backup => backup.backupId)).size === backups.length
  const busy = Boolean(pending) || ['loading', 'recovering'].includes(recovery?.status)
  const ready = recovery?.status === 'ready' && valid
  const chosen = ready && !blocked ? backups.find(backup => backup.backupId === selectedBackupId) : null
  return <section className="player-account player-save-recovery" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <h2 id={`${id}-title`}>{text.title}</h2>
    {blocked && <p role="status">{language === 'en' ? 'The previous operation is unresolved. Check its result before selecting another backup.' : '上次操作的结果尚未确认，请先核实结果，再选择其他备份。'}</p>}
    {recovery?.status === 'loading' && <p role="status">{text.loading}</p>}
    {ready && <>
      {backups.length === 0 ? <p>{text.empty}</p> : <ul className="player-slot-list">
        {backups.map(backup => <li key={backup.backupId}><button type="button" aria-pressed={chosen?.backupId === backup.backupId}
          disabled={busy || blocked || !onChooseBackup} onClick={() => { if (!busy && !blocked) onChooseBackup?.(backup.backupId) }}>
          <span className="player-save-summary">{formatPlayerSaveSummary(backup.summary, { language })}</span><small>{text.review}</small>
        </button></li>)}
      </ul>}
      {chosen && <div className="player-save-confirmation" role="group" aria-label={text.confirm}>
        <p>{text.warning}</p>
        <div className="player-account-actions">
          <button type="button" disabled={busy || !onCancelChoice} onClick={() => { if (!busy) onCancelChoice?.() }}>{text.back}</button>
          <button type="button" disabled={busy || !onConfirmRestore} onClick={() => { if (!busy) onConfirmRestore?.(chosen.backupId) }}>{text.confirm}</button>
        </div>
      </div>}
    </>}
    {(recovery?.status === 'error' || (recovery?.status === 'ready' && !valid)) && <p role="alert">{recovery?.error?.message || text.failed}</p>}
    {!busy && <button type="button" disabled={!onRetry} onClick={() => onRetry?.()}>{text.retry}</button>}
    {(pending || recovery?.status === 'recovering') && <p role="status">{text.pending}</p>}
  </section>
}

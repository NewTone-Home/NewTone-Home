import { useId } from 'react'
import './PlayerAccount.css'
import { formatPlayerSaveSummary } from './playerSaveSummary.mjs'

const copy = {
  zh: { title: '选择要继续的存档', intro: '本地与云端存档不同。请亲自选择，不会按时间自动决定。', local: '本地存档', cloud: '云端存档', unknown: '暂无进度摘要', review: '查看并选择', confirmTitle: '确认使用这份存档？', preserve: '确认后先保留另一份存档的备份，再使用你选择的版本。不会合并两份进度。', confirm: '保留备份并确认选择', back: '返回比较', busy: '正在保留备份并处理选择，请稍候…', unavailable: '冲突信息不完整，请重新读取存档后再选择。', retry: '重新读取' },
  en: { title: 'Choose the save to continue', intro: 'Local and cloud saves differ. Choose explicitly; neither is selected by timestamp.', local: 'Local save', cloud: 'Cloud save', unknown: 'Progress summary unavailable', review: 'Review and choose', confirmTitle: 'Use this version of the save?', preserve: 'Confirmation first retains the other version as a backup, then uses your selected version. The two versions will not be merged.', confirm: 'Keep backup and confirm choice', back: 'Back to comparison', busy: 'Keeping the backup and applying your choice…', unavailable: 'Conflict details are incomplete. Reload saves before choosing.', retry: 'Reload saves' },
}

/** Controlled two-step choice. The parent binds selectedChoice to the displayed token. */
export default function PlayerSaveConflictPanel({ conflict, selectedChoice = null, pending = false,
  language = 'zh', error = null, onChooseConflict, onConfirmConflict, onCancelChoice, onRetry, onBackups,
}) {
  const text = copy[language === 'en' ? 'en' : 'zh'], id = useId()
  const valid = typeof conflict?.slotId === 'string' && conflict.slotId.length > 0
    && typeof conflict?.token === 'string' && conflict.token.length > 0 && conflict.local && conflict.cloud
  const boundChoice = ['local', 'cloud'].includes(conflict?.pendingChoice) ? conflict.pendingChoice : null
  const hasPendingChoice = conflict?.pendingChoice != null
  const chosen = boundChoice || (hasPendingChoice ? null : ['local', 'cloud'].includes(selectedChoice) ? selectedChoice : null)
  return <section className="player-account player-save-conflict" aria-labelledby={`${id}-title`} aria-busy={Boolean(pending)}>
    <h2 id={`${id}-title`}>{text.title}</h2>
    {!valid ? <><p role="alert">{text.unavailable}</p><button type="button" disabled={pending || !onRetry} onClick={() => { if (!pending) onRetry?.() }}>{text.retry}</button></>
      : <>
        <p>{text.intro}</p>
        {hasPendingChoice && <p role="status">{language === 'en'
          ? 'A previous choice is awaiting confirmation. Recover that same operation before choosing another version.'
          : '上次选择的处理结果仍待确认。请先恢复同一操作，不能改选另一份存档。'}</p>}
        <div className="player-save-comparison">
          {['local', 'cloud'].map(choice => <article key={choice} className="player-save-version" aria-labelledby={`${id}-${choice}`}>
            <h3 id={`${id}-${choice}`}>{text[choice]}</h3>
            <p className="player-save-summary">{formatPlayerSaveSummary(conflict[choice].summary, { language })}</p>
            <button type="button" aria-pressed={chosen === choice} disabled={pending || hasPendingChoice || !onChooseConflict}
              onClick={() => { if (!pending && !hasPendingChoice) onChooseConflict?.(choice) }}>{text.review} · {text[choice]}</button>
          </article>)}
        </div>
        {chosen && <div className="player-save-confirmation" role="group" aria-labelledby={`${id}-confirm`}>
          <h3 id={`${id}-confirm`}>{text.confirmTitle} {text[chosen]}</h3>
          <p>{text.preserve}</p>
          <div className="player-account-actions">
            <button type="button" disabled={pending || hasPendingChoice || !onCancelChoice} onClick={() => { if (!pending && !hasPendingChoice) onCancelChoice?.() }}>{text.back}</button>
            <button type="button" disabled={pending || !onConfirmConflict} onClick={() => { if (!pending) onConfirmConflict?.(chosen) }}>{hasPendingChoice ? (language === 'en' ? 'Recover the previous choice' : '恢复上次选择') : text.confirm}</button>
          </div>
        </div>}
        {hasPendingChoice && !boundChoice && <button type="button" disabled={pending || !onRetry} onClick={() => { if (!pending) onRetry?.() }}>{text.retry}</button>}
        {onBackups && <button type="button" disabled={pending || hasPendingChoice} onClick={() => { if (!pending && !hasPendingChoice) onBackups() }}>{language === 'en' ? 'Backups and recovery' : '备份与恢复'}</button>}
      </>}
    {pending && <p role="status">{text.busy}</p>}
    {error && <p role="alert">{typeof error.message === 'string' ? error.message : text.unavailable}</p>}
  </section>
}

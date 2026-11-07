import { useId } from 'react'
import { PLAYER_ACCOUNT_SLOT_LIMIT } from '../../services/playerAccountPolicy.mjs'
import './PlayerAccount.css'
import { formatPlayerSaveSummary } from './playerSaveSummary.mjs'

const copy = {
  zh: { title: '我的存档', slot: '存档', empty: '空存档位', create: '创建新存档', select: '选择存档', selected: '已选择', loading: '正在读取存档…', signedOut: '登录后可使用三个账号存档位。游客存档仍可继续游玩。', failed: '暂时无法读取存档。原有存档不会被覆盖。', retry: '重新读取', pending: '正在处理存档，请稍候…', full: '三个存档位已用满。', overflow: '发现超过当前容量的已有存档，已全部保留。', adopting: '正在保留当前游客存档，请稍候…' },
  en: { title: 'My saves', slot: 'Save', empty: 'Empty slot', create: 'Create new save', select: 'Select save', selected: 'Selected', loading: 'Loading saves…', signedOut: 'Sign in to use three account save slots. Your guest save remains playable.', failed: 'Unable to read saves. Existing saves will not be overwritten.', retry: 'Reload saves', pending: 'Updating saves, please wait…', full: 'All three save slots are in use.', overflow: 'More existing saves than the current limit were found. All are preserved.', adopting: 'Keeping your current guest save, please wait…' },
}

/** Slot IDs and display summaries must come from the authenticated owner's catalogue. */
export default function PlayerSaveSlots({ status = 'signed_out', slots = [], selectedSlotId = null,
  language = 'zh', pending = false, error = null, onSelect, onCreate, onRetry, onBackups,
}) {
  const text = copy[language === 'en' ? 'en' : 'zh']
  const id = useId()
  const valid = Array.isArray(slots) && slots.every(slot => typeof slot?.slotId === 'string' && slot.slotId.length > 0)
    && new Set(slots.map(slot => slot.slotId)).size === slots.length
  const ready = status === 'ready' && valid
  const busy = Boolean(pending) || status === 'loading' || status === 'adopting'
  const failed = status === 'error' || (status === 'ready' && !valid)
  return <section className="player-account player-save-slots" aria-labelledby={`${id}-title`} aria-busy={busy}>
    <h2 id={`${id}-title`}>{text.title}</h2>
    {status === 'signed_out' && <p>{text.signedOut}</p>}
    {status === 'loading' && <p role="status">{text.loading}</p>}
    {status === 'adopting' && <p role="status">{text.adopting}</p>}
    {failed && <><p role="alert">{text.failed}</p><button type="button" disabled={busy || !onRetry} onClick={() => { if (!busy) onRetry?.() }}>{text.retry}</button></>}
    {ready && <>
      <ol className="player-slot-list">
        {slots.map((slot, index) => <li key={slot.slotId}>
          <button type="button" data-slot-id={slot.slotId} aria-pressed={selectedSlotId === slot.slotId}
            disabled={busy || !onSelect} onClick={() => { if (!busy) onSelect?.(slot.slotId) }}>
            <span>{slot.label || `${text.slot} ${index + 1}`}</span>
            {slot.summary && <small className="player-save-summary">{formatPlayerSaveSummary(slot.summary, { language })}</small>}
            <small>{selectedSlotId === slot.slotId ? text.selected : text.select}</small>
          </button>
          {onBackups && <button type="button" className="player-slot-backups" disabled={busy}
            onClick={() => { if (!busy) onBackups(slot.slotId) }}>{language === 'en' ? 'Backups and recovery' : '备份与恢复'} · {slot.label || `${text.slot} ${index + 1}`}</button>}
        </li>)}
        {Array.from({ length: Math.max(0, PLAYER_ACCOUNT_SLOT_LIMIT - slots.length) }, (_, index) =>
          <li key={`empty-${index}`} className="player-slot-empty"><span>{text.empty}</span></li>)}
      </ol>
      {slots.length < PLAYER_ACCOUNT_SLOT_LIMIT
        ? <button type="button" disabled={busy || !onCreate} onClick={() => { if (!busy) onCreate?.() }}>{text.create}</button>
        : <p>{slots.length === PLAYER_ACCOUNT_SLOT_LIMIT ? text.full : text.overflow}</p>}
    </>}
    {pending && <p role="status">{text.pending}</p>}
    {error && !failed && <p role="alert">{typeof error.message === 'string' ? error.message : text.failed}</p>}
  </section>
}

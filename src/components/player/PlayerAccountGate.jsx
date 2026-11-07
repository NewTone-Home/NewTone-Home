import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PlayerAuthPanel from './PlayerAuthPanel'
import PlayerSaveSlots from './PlayerSaveSlots'
import PlayerSaveConflictPanel from './PlayerSaveConflictPanel'
import PlayerSaveRecoveryPanel from './PlayerSaveRecoveryPanel'
import { createPlayerAccountGateActions } from '../../services/playerAccountGateActions.mjs'

const unknownAuth = Object.freeze({ status: 'unknown', user: null, pending: null, email: null, error: null })
const unknownSaves = Object.freeze({ status: 'loading', slots: [], selectedSlotId: null, error: null, source: null })
const subscribeNone = () => () => {}
const readUnknownAuth = () => unknownAuth
const readUnknownSaves = () => unknownSaves

/** Account entry shell. Dependencies and source adoption remain owned by the parent. */
export default function PlayerAccountGate({ authController, saveCoordinator, onSelectedSave,
  navigate, otpReady = false, googleReady = false, emailMode = 'otp', linkReady = false, language = 'zh', initiallyOpen = false,
}) {
  const auth = useSyncExternalStore(authController?.subscribe ?? subscribeNone, authController?.getSnapshot ?? readUnknownAuth, authController?.getSnapshot ?? readUnknownAuth)
  const saves = useSyncExternalStore(saveCoordinator?.subscribe ?? subscribeNone, saveCoordinator?.getSnapshot ?? readUnknownSaves, saveCoordinator?.getSnapshot ?? readUnknownSaves)
  const [open, setOpen] = useState(initiallyOpen)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [conflictChoice, setConflictChoice] = useState(null)
  const [backupChoice, setBackupChoice] = useState(null)
  const actions = useRef(null)
  const callback = useRef(onSelectedSave)
  callback.current = onSelectedSave
  useEffect(() => {
    const current = createPlayerAccountGateActions({ authController, saveCoordinator, navigate,
      onPending: setPending, onError: setError, onCodeClear: () => setCode(''),
    })
    actions.current = current
    setPending(null); setError(null); setCode('')
    let live = true
    // Coordinator owns reconciliation/subscriptions and idempotent guest adoption.
    ;(async () => {
      const loaded = await saveCoordinator?.bootstrap()
      if (live && loaded?.ok === false) setError(loaded.error)
    })().catch(() => { if (live) setError({ message: language === 'en' ? 'Unable to initialize accounts. Guest play remains available.' : '账号暂时无法初始化，仍可使用游客存档。' }) })
    return () => { live = false; current.dispose(); if (actions.current === current) actions.current = null }
  }, [authController, saveCoordinator, navigate])
  useEffect(() => { setCode(''); setError(null) }, [auth.user?.id, auth.email])
  useEffect(() => { callback.current?.(saves.source ?? null) }, [saves.source])
  useEffect(() => { if (auth.error) setOpen(true) }, [auth.error])
  useEffect(() => { if (saves.status === 'conflict') setOpen(true) }, [saves.status, saves.conflict?.token])
  const en = language === 'en'
  const conflictScope = JSON.stringify([auth.user?.id, auth.sessionEpoch, saves.conflict?.slotId, saves.conflict?.token])
  const recoveryScope = JSON.stringify([auth.user?.id, auth.sessionEpoch, saves.recovery?.slotId, saves.recovery?.token])
  const chosenConflict = conflictChoice?.scope === conflictScope ? conflictChoice.choice : null
  const chosenBackup = backupChoice?.scope === recoveryScope ? backupChoice.backupId : null
  const slotStatus = saves.status === 'guest' ? 'signed_out' : saves.status === 'switching' ? 'loading' : saves.status
  return <aside className="player-account-gate">
    <button type="button" className="player-account-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {en ? 'Account & saves' : '账号与存档'}
    </button>
    {open && <div className="player-account-gate-panels">
      <PlayerAuthPanel snapshot={auth} language={language} otpReady={otpReady} emailMode={emailMode} linkReady={linkReady} googleReady={googleReady && typeof navigate === 'function'}
        emailInput={email} codeInput={code} onEmailChange={setEmail} onCodeChange={setCode} pending={Boolean(pending)} error={error}
        onRequestLink={value => actions.current?.requestLink(value)} onRequestOtp={value => actions.current?.requestOtp(value)} onVerifyOtp={(address, value) => actions.current?.verifyOtp(address, value)}
        onGoogle={() => actions.current?.google()} onLogout={() => actions.current?.logout()} onCancel={() => actions.current?.changeEmail()}
        onGuest={() => actions.current?.continueGuest()} />
      {!['conflict', 'recovering'].includes(saves.status) && <PlayerSaveSlots status={slotStatus} slots={saves.slots} selectedSlotId={saves.selectedSlotId} language={language}
        pending={Boolean(pending) || saves.status === 'switching'} error={saves.error}
        onSelect={slotId => actions.current?.selectSlot(slotId)} onCreate={() => actions.current?.createSlot()} onRetry={() => actions.current?.retry()}
        onBackups={typeof saveCoordinator?.listBackups === 'function' ? slotId => { setBackupChoice(null); actions.current?.listBackups(slotId) } : undefined} />}
      {saves.conflict && ['conflict', 'recovering'].includes(saves.status) && <PlayerSaveConflictPanel conflict={saves.conflict}
        selectedChoice={chosenConflict} language={language} pending={Boolean(pending) || saves.status === 'recovering'} error={error || saves.error}
        onChooseConflict={choice => setConflictChoice({ scope: conflictScope, choice })} onCancelChoice={() => setConflictChoice(null)}
        onConfirmConflict={choice => {
          if (chosenConflict === choice || saves.conflict.pendingChoice === choice) actions.current?.resolveConflict({ slotId: saves.conflict.slotId, token: saves.conflict.token, choice })
        }} onRetry={() => { setConflictChoice(null); actions.current?.retry() }}
        onBackups={typeof saveCoordinator?.listBackups === 'function' ? () => { setBackupChoice(null); actions.current?.listBackups(saves.conflict.slotId) } : undefined} />}
      {saves.recovery && <PlayerSaveRecoveryPanel recovery={saves.recovery} selectedBackupId={chosenBackup} language={language}
        blocked={saves.conflict?.pendingChoice != null}
        pending={Boolean(pending) || saves.status === 'recovering'} onChooseBackup={backupId => setBackupChoice({ scope: recoveryScope, backupId })}
        onCancelChoice={() => setBackupChoice(null)} onConfirmRestore={backupId => {
          if (chosenBackup === backupId) actions.current?.restoreBackup({ slotId: saves.recovery.slotId, backupId, token: saves.recovery.token })
        }} onRetry={() => { setBackupChoice(null); if (saves.conflict?.pendingChoice != null) actions.current?.retry(); else actions.current?.listBackups(saves.recovery.slotId) }} />}
    </div>}
  </aside>
}

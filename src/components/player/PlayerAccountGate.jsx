import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import PlayerAuthPanel from './PlayerAuthPanel'
import PlayerSaveSlots from './PlayerSaveSlots'
import { createPlayerAccountGateActions } from '../../services/playerAccountGateActions.mjs'

const unknownAuth = Object.freeze({ status: 'unknown', user: null, pending: null, email: null, error: null })
const unknownSaves = Object.freeze({ status: 'loading', slots: [], selectedSlotId: null, error: null, source: null })
const subscribeNone = () => () => {}
const readUnknownAuth = () => unknownAuth
const readUnknownSaves = () => unknownSaves

/** Account entry shell. Dependencies and source adoption remain owned by the parent. */
export default function PlayerAccountGate({ authController, saveCoordinator, onSelectedSave,
  navigate, otpReady = false, googleReady = false, language = 'zh', initiallyOpen = false,
}) {
  const auth = useSyncExternalStore(authController?.subscribe ?? subscribeNone, authController?.getSnapshot ?? readUnknownAuth, authController?.getSnapshot ?? readUnknownAuth)
  const saves = useSyncExternalStore(saveCoordinator?.subscribe ?? subscribeNone, saveCoordinator?.getSnapshot ?? readUnknownSaves, saveCoordinator?.getSnapshot ?? readUnknownSaves)
  const [open, setOpen] = useState(initiallyOpen)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
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
  const en = language === 'en'
  const slotStatus = saves.status === 'guest' ? 'signed_out' : saves.status === 'switching' ? 'loading' : saves.status
  return <aside className="player-account-gate">
    <button type="button" className="player-account-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {en ? 'Account & saves' : '账号与存档'}
    </button>
    {open && <div className="player-account-gate-panels">
      <PlayerAuthPanel snapshot={auth} language={language} otpReady={otpReady} googleReady={googleReady && typeof navigate === 'function'}
        emailInput={email} codeInput={code} onEmailChange={setEmail} onCodeChange={setCode} pending={Boolean(pending)} error={error}
        onRequestOtp={value => actions.current?.requestOtp(value)} onVerifyOtp={(address, value) => actions.current?.verifyOtp(address, value)}
        onGoogle={() => actions.current?.google()} onLogout={() => actions.current?.logout()} onCancel={() => actions.current?.changeEmail()}
        onGuest={() => actions.current?.continueGuest()} />
      <PlayerSaveSlots status={slotStatus} slots={saves.slots} selectedSlotId={saves.selectedSlotId} language={language}
        pending={Boolean(pending) || saves.status === 'switching'} error={saves.error}
        onSelect={slotId => actions.current?.selectSlot(slotId)} onCreate={() => actions.current?.createSlot()} onRetry={() => actions.current?.retry()} />
    </div>}
  </aside>
}

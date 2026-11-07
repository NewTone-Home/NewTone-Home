import { useEffect, useSyncExternalStore } from 'react'
import App from '../../App.jsx'
import PlayerAccountGate from './PlayerAccountGate'
import { installPlayerAccountLifecycle } from '../../services/playerAccountLifecycle.mjs'

/** Parent owns auth/coordinator lifetime. Source changes remount the entire entry runtime. */
export default function PlayerAccountApp({ authController, saveCoordinator, otpReady = false, googleReady = false, emailMode = 'otp', linkReady = false,
  navigate, language = 'zh', initiallyOpen = false, onSelectedSave, GameComponent = App,
}) {
  const saves = useSyncExternalStore(saveCoordinator.subscribe, saveCoordinator.getSnapshot, saveCoordinator.getSnapshot)
  // Read the coordinator directly: never keep a stale source until a child effect runs.
  const source = ['guest', 'ready'].includes(saves.status) ? saves.source : null
  useEffect(() => installPlayerAccountLifecycle({ saveCoordinator }), [saveCoordinator, source?.key])
  const en = language === 'en'
  return <div className="player-account-host">
    <div className="player-account-host-controls">
      <PlayerAccountGate authController={authController} saveCoordinator={saveCoordinator} otpReady={otpReady} emailMode={emailMode} linkReady={linkReady}
        googleReady={googleReady} navigate={navigate} language={language} initiallyOpen={initiallyOpen} onSelectedSave={onSelectedSave} />
    </div>
    {source?.key && source.service
      ? <GameComponent key={source.key} saveService={source.service} />
      : <main className="player-account-host-wait" aria-live="polite">
        <div><h1>{en ? 'Your next story' : '你的下一段故事'}</h1>
          <p>{saves.status === 'error' ? (en ? 'Your saves are protected. Open Account & saves to retry or continue as a guest.' : '原有存档已保留。请打开「账号与存档」重试，或继续以游客游玩。')
            : saves.status === 'conflict' ? (en ? 'Local and cloud saves differ. Open Account & saves to compare and confirm your choice.' : '本地与云端存档不同。请打开「账号与存档」比较并确认你的选择。')
              : ['loading', 'switching', 'adopting', 'recovering'].includes(saves.status) ? (en ? 'Preparing your saves. Account & saves remains available above.' : '正在准备存档，你仍可打开上方「账号与存档」。')
              : (en ? 'Open Account & saves to choose a save or continue as a guest.' : '打开「账号与存档」，选择存档或继续以游客游玩。')}</p>
        </div>
      </main>}
  </div>
}

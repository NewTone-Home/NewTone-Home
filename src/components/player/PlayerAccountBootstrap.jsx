import { useEffect, useState } from 'react'
import App from '../../App.jsx'
import PlayerAccountApp from './PlayerAccountApp.jsx'
import { createPlayerAccountRuntime } from '../../services/playerAccountRuntime.js'
import { createPlayerAccountRuntimeCache } from './playerAccountBootstrapState.mjs'

const cache = createPlayerAccountRuntimeCache(createPlayerAccountRuntime)
const navigate = url => window.location.assign(url)
if (import.meta.hot) import.meta.hot.dispose(() => { void cache.dispose().catch(() => {}) })

export function PlayerAccountBootstrapView({ runtime, GuestComponent = App, AccountComponent = PlayerAccountApp }) {
  if (runtime === null) return <p role="status">正在准备账号与存档…</p>
  if (!runtime?.enabled) return <GuestComponent />
  return <AccountComponent authController={runtime.authController} saveCoordinator={runtime.saveCoordinator}
    emailMode={runtime.emailMode} linkReady={runtime.linkReady} otpReady={runtime.otpReady} googleReady={runtime.googleReady} navigate={navigate} />
}

/** Loaded only after both main-entry feature flags are exact true. No render-time client creation. */
export default function PlayerAccountBootstrap() {
  const [runtime, setRuntime] = useState(null)
  useEffect(() => {
    setRuntime(cache.get({ env: import.meta.env, currentOrigin: window.location.origin, currentUrl: window.location.href }))
    // Unmount does not sign out or dispose the shared runtime. HMR owns disposal.
  }, [])
  return <PlayerAccountBootstrapView runtime={runtime} />
}

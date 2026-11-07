export function playerAccountsRequested(env) {
  return env?.VITE_PLAYER_ACCOUNTS_ENABLED === 'true' && env?.VITE_PLAYER_CLOUD_CONFIGURED === 'true'
}

/** Import failure occurs before the effect-owned client exists, so guest fallback is safe. */
export async function loadPlayerAccountModule(load, GuestComponent) {
  try { return await load() } catch { return { default: GuestComponent } }
}

/** One client graph per explicitly loaded module, independent of StrictMode effects. */
export function createPlayerAccountRuntimeCache(makeRuntime) {
  let runtime = null
  let disposed = false
  const disabled = Object.freeze({ enabled: false })
  return {
    get(options) {
      if (disposed || !playerAccountsRequested(options?.env)) return disabled
      if (!runtime) {
        try { runtime = makeRuntime(options) || disabled } catch { runtime = disabled }
      }
      return runtime
    },
    async dispose() {
      if (disposed) return
      disposed = true
      if (runtime?.enabled) await runtime.dispose()
    },
  }
}

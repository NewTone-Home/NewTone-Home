// Fixed when the event is created, never reconstructed when an old queue flushes.
export const ANALYTICS_RELEASE = '0.3.0'
export function analyticsReleaseContext(env = import.meta.env) {
  const allowed = ['production', 'staging', 'preview', 'development']
  const environment = allowed.includes(env.VITE_ANALYTICS_ENVIRONMENT)
    ? env.VITE_ANALYTICS_ENVIRONMENT : env.DEV ? 'development' : 'preview'
  return { release: ANALYTICS_RELEASE, environment }
}

export function analyticsBuildEnvironment(branch, target) {
  if (branch === 'staging') return 'staging'
  return branch === 'main' && target === 'production' ? 'production' : 'preview'
}

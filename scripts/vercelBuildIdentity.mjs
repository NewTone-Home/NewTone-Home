/** Public build selectors only; this module performs no build, I/O or configuration writes.
 * Files-based staging deployments set NEWTONE_DEPLOYMENT_ENV=staging explicitly.
 * NEWTONE_BUILD_SHA is a 40-hex source identifier fallback, never a deployment authorization.
 */
export function resolveVercelBuildIdentity(env) {
  const branch = env.NEWTONE_DEPLOYMENT_ENV === 'staging' ? 'staging' : (env.VERCEL_GIT_COMMIT_REF ?? '')
  const validSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value)
  const buildSha = validSha(env.VERCEL_GIT_COMMIT_SHA) ? env.VERCEL_GIT_COMMIT_SHA
    : validSha(env.NEWTONE_BUILD_SHA) ? env.NEWTONE_BUILD_SHA : ''
  return { branch, buildSha }
}

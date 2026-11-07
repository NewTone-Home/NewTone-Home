import { describe, expect, it } from 'vitest'
import { resolveVercelBuildIdentity } from '../scripts/vercelBuildIdentity.mjs'
import { analyticsBuildEnvironment } from '../src/services/analyticsRelease.js'

const gitSha = 'a'.repeat(40), sourceSha = 'b'.repeat(40)
describe('file-upload staging build isolation', () => {
  it('selects staging even without Git metadata and keeps analytics out of production', () => {
    const identity = resolveVercelBuildIdentity({ NEWTONE_DEPLOYMENT_ENV: 'staging', NEWTONE_BUILD_SHA: sourceSha })
    expect(identity).toEqual({ branch: 'staging', buildSha: sourceSha })
    expect(analyticsBuildEnvironment(identity.branch, 'production')).toBe('staging')
  })
  it('explicit staging overrides even a main ref', () => {
    expect(resolveVercelBuildIdentity({ NEWTONE_DEPLOYMENT_ENV: 'staging', VERCEL_GIT_COMMIT_REF: 'main' }).branch).toBe('staging')
  })
  it.each([undefined, 'production', 'STAGING', ' staging ', ''])('does not override existing branch for selector %s', selector => {
    expect(resolveVercelBuildIdentity({ NEWTONE_DEPLOYMENT_ENV: selector, VERCEL_GIT_COMMIT_REF: 'main' }).branch).toBe('main')
  })
  it('prefers valid Vercel Git SHA, otherwise uses a valid source fallback', () => {
    expect(resolveVercelBuildIdentity({ VERCEL_GIT_COMMIT_SHA: gitSha, NEWTONE_BUILD_SHA: sourceSha }).buildSha).toBe(gitSha)
    expect(resolveVercelBuildIdentity({ VERCEL_GIT_COMMIT_SHA: 'invalid', NEWTONE_BUILD_SHA: sourceSha }).buildSha).toBe(sourceSha)
  })
  it.each(['bad', 'a'.repeat(39), 'g'.repeat(40), ' '+sourceSha, undefined])('rejects invalid fallback %s', fallback => {
    expect(resolveVercelBuildIdentity({ NEWTONE_BUILD_SHA: fallback }).buildSha).toBe('')
  })
})

import { resolveVercelBuildIdentity } from './vercelBuildIdentity.mjs'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { analyticsBuildEnvironment } from '../src/services/analyticsRelease.js'

const STAGING_BRANCH = 'staging'
const STAGING_SUPABASE_URL = 'https://ksrvlkcpaiowhcvzimkc.supabase.co'
const STAGING_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_57_sSKpMOtmoLTFKZtL1uQ_v77CvquY'

const env = { ...process.env }
// Explicit staging selection also isolates file-upload deployments without Git metadata.
const { branch, buildSha } = resolveVercelBuildIdentity(env)
env.VITE_BUILD_SHA = buildSha
env.VITE_ANALYTICS_ENVIRONMENT = analyticsBuildEnvironment(branch, env.VERCEL_ENV)
// Explicit false remains a deployment-level kill switch; reviewed public branches default on.
env.VITE_PLAYER_HISTORY_V2 ??= ['main','staging'].includes(branch) ? 'true' : 'false'

env.VITE_ENABLE_STAGING_TOOLS = branch === STAGING_BRANCH ? 'true' : 'false'

if (branch === STAGING_BRANCH) {
  env.VITE_SUPABASE_URL = STAGING_SUPABASE_URL
  env.VITE_SUPABASE_PUBLISHABLE_KEY = STAGING_SUPABASE_PUBLISHABLE_KEY
  console.log(`[vercel-build] ${branch}: using isolated NewTone-Staging Supabase with staging test tools.`)
} else {
  console.log(
    `[vercel-build] ${branch || 'non-Vercel'}: preserving the configured Supabase environment; staging test tools disabled.`,
  )
}

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npmExecutable, ['run', 'build'], {
  env,
  stdio: 'inherit',
})

if (result.error) {
  console.error('[vercel-build] Failed to start the build:', result.error)
  process.exit(1)
}

if (result.status === 0) {
  const metadata = { release:'0.3.0', environment:env.VITE_ANALYTICS_ENVIRONMENT, buildSha:env.VITE_BUILD_SHA||null, historyV2Enabled:env.VITE_PLAYER_HISTORY_V2==='true' }
  writeFileSync(new URL('../dist/analytics-build.json', import.meta.url), JSON.stringify(metadata,null,2))
}
process.exit(result.status ?? 1)

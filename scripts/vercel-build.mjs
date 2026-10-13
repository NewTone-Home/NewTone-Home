import { spawnSync } from 'node:child_process'

const STAGING_BRANCH = 'staging'
const LEGACY_SAVE_ACCEPTANCE_BRANCH = 'codex/legacy-save-acceptance-20261013'
const STAGING_SUPABASE_URL = 'https://ksrvlkcpaiowhcvzimkc.supabase.co'
const STAGING_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_57_sSKpMOtmoLTFKZtL1uQ_v77CvquY'

const env = { ...process.env }
const branch = env.VERCEL_GIT_COMMIT_REF ?? ''

env.VITE_ENABLE_STAGING_TOOLS = branch === STAGING_BRANCH ? 'true' : 'false'
env.VITE_LEGACY_SAVE_ACCEPTANCE_PREVIEW = 'false'

if (branch === LEGACY_SAVE_ACCEPTANCE_BRANCH) {
  env.VITE_SUPABASE_URL = ''
  env.VITE_SUPABASE_PUBLISHABLE_KEY = ''
  env.VITE_LEGACY_SAVE_ACCEPTANCE_PREVIEW = 'true'
  console.log('[vercel-build] legacy save acceptance preview: Supabase and analytics disabled.')
} else if (branch === STAGING_BRANCH) {
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

process.exit(result.status ?? 1)

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path => readFileSync(`${root}/${path}`, 'utf8')

describe('first-release boundary', () => {
  it('has no bundled legacy manuscript or generated content seed', () => {
    const manuscriptDir = `${root}/src/content/manuscripts`
    expect(existsSync(manuscriptDir) ? readdirSync(manuscriptDir) : []).toEqual([])
    expect(existsSync(`${root}/supabase/seed/reader-content-v1.json`)).toBe(false)
  })

  it('does not expose or bundle the retired Reader admin app', () => {
    const main = source('src/main.jsx')
    expect(main).toContain("window.location.pathname === '/admin/analytics'")
    expect(main).not.toContain("window.location.pathname === '/admin'")
    expect(main).not.toContain("startsWith('/admin/')")
    expect(main).not.toContain('adminRoute')
    expect(main).toContain('const playerEnabled = !analyticsRoute && playerAccountsRequested(import.meta.env)')
    expect(main).toContain('loadPlayerAccountModule')
    expect(source('src/App.jsx')).not.toContain('AdminSequenceGate')
    expect(source('src/views/Landing.jsx')).not.toContain('/admin')
    expect(existsSync(`${root}/src/admin/adminAccessSequence.js`)).toBe(false)
    expect(existsSync(`${root}/src/admin/AdminSequenceGate.jsx`)).toBe(false)
  })

  it('keeps analytics owner-only without loading or writing Reader drafts', () => {
    const admin = source('src/admin/AdminApp.jsx')
    expect(admin).toContain("phase === 'ready' && session")
    expect(admin).toContain("supabase.rpc('owner_center_analytics_v2')")
    expect(admin).toContain("if (error) throw error")
    expect(admin).toContain("error.code === '42501' ? 'unauthorized' : 'error'")
    const migration = source('supabase/migrations/20261003023500_session_trajectory_analytics.sql')
    const rpc = migration.slice(migration.indexOf('create or replace function public.owner_center_analytics_v2()'))
    expect(rpc).toContain('if not private.is_owner(auth.uid()) then')
    expect(rpc).toContain("using errcode = '42501'")
    expect(admin).toContain('<CenterAnalyticsDashboard />')
    for (const retired of ['adminContentService', 'loadOwnerDraft', 'OwnerWorkbench', 'OwnerReaderPreview', 'reader_drafts']) expect(admin).not.toContain(retired)
    expect(source('src/admin/CenterAnalyticsDashboard.jsx')).toContain('<ReleaseAnalyticsDashboard />')
    expect(source('src/admin/CenterAnalyticsDashboard.jsx')).not.toContain('href="/admin"')
    expect(source('src/admin/OwnerReaderPreview.jsx')).not.toContain("import('../App.jsx')")
    expect(source('src/admin/ownerPreviewSession.mjs')).toContain('createReaderPreviewStores')
    expect(source('src/admin/ownerPreviewSession.mjs')).not.toContain('installGameStorage')
  })

  it('keeps Center independent of Reader availability while preserving shared Reader tools', () => {
    expect(source('src/main.jsx')).not.toContain('loadPublishedContent')
    expect(source('src/main.jsx')).not.toContain('<EmptyContentApp')
    expect(source('src/App.jsx')).toContain('<EntrySurface')
    expect(source('src/components/EntrySurface.jsx')).toContain('<Landing')
    expect(source('src/admin/OwnerReaderPreviewHost.jsx')).toContain('<Reader')
    expect(source('src/views/ReaderOrchestrator.jsx')).toContain('<EmptyReaderOrchestrator')
    expect(source('src/views/ReaderStage.jsx')).toContain('<ReaderTools')
    expect(source('src/views/ReaderStage.jsx')).toContain('reader-empty-document')
    expect(source('src/views/ReaderStage.jsx')).not.toContain('ReaderUnavailable')
  })

  it('allows only the dedicated release branch to create a protected Preview', () => {
    const vercel = JSON.parse(source('vercel.json'))
    expect(vercel.git.deploymentEnabled).toEqual({
      'codex/release-landing-reader-vercel': true,
    })
  })
})

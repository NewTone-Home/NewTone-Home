import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(fileURLToPath(new URL('../supabase/migrations/20260804225050_first_release_content_admin_analytics.sql', import.meta.url)), 'utf8')
const securitySql = readFileSync(fileURLToPath(new URL('../supabase/migrations/20260804230936_private_trigger_publication.sql', import.meta.url)), 'utf8')

describe('Supabase release contract', () => {
  it('keeps published content anonymous-read and owner-write only', () => {
    expect(sql).toContain("using (status = 'published')")
    expect(securitySql).toContain('drop function if exists public.publish_reader_draft')
    expect(securitySql).toContain('private.publish_reader_draft_trigger')
    expect(securitySql).toContain('revoke all on function private.publish_reader_draft_trigger() from public, anon, authenticated')
    expect(sql).toContain('revoke all on public.reader_publications from public, anon, authenticated')
    expect(sql).toContain('private.owner_allowlist')
  })

  it('allows constrained analytics inserts but no public raw reads', () => {
    expect(sql).toContain('grant insert (client_event_id, visitor_id, session_id')
    expect(sql).toContain('revoke all on public.analytics_events from public, anon, authenticated')
    expect(sql).toContain('private.analytics_daily_summary')
  })
})

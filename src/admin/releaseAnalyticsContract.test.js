import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url),'utf8')
describe('release report safety',()=>{
 it('keeps old events valid, owner RLS, explicit cohort filters and max checkpoint accounting',()=>{
  const sql=read('../../supabase/migrations/20261106014425_analytics_release_v030.sql')
  expect(sql).toContain('security invoker')
  expect(sql).toContain('from public, anon')
  expect(sql).toContain("event_data->>'release' = p_release")
  expect(sql).toContain("event_data->>'environment' = p_environment")
  expect(sql).toContain('max(case')
  expect(sql).not.toMatch(/update public[.]analytics_events|delete from public[.]analytics_events/i)
 })
 it('uses release RPC alongside separately labelled historical report',()=>{
  expect(read('./centerAnalyticsService.js')).toContain("rpc('owner_release_analytics'")
  expect(read('./CenterAnalyticsDashboard.jsx')).toContain('<ReleaseAnalyticsDashboard />')
  expect(read('./ReleaseAnalyticsDashboard.jsx')).toContain('history.items.map')
  expect(read('./ReleaseAnalyticsDashboard.jsx')).not.toContain('data.events.map')
 })
})

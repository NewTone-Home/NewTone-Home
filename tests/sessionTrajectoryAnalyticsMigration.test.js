import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('../supabase/migrations/20261003023500_session_trajectory_analytics.sql', import.meta.url), 'utf8')

function extractCheckConstraint(sql, constraintName) {
  const start = sql.toLowerCase().indexOf(`add constraint ${constraintName.toLowerCase()} check`)
  if (start < 0) return null
  const open = sql.indexOf('(', start)
  if (open < 0) return null

  let depth = 0
  let inString = false
  for (let index = open; index < sql.length; index += 1) {
    const character = sql[index]
    if (character === "'" && inString && sql[index + 1] === "'") {
      index += 1
      continue
    }
    if (character === "'") {
      inString = !inString
      continue
    }
    if (inString) continue
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth === 0) {
        return {
          expression: sql.slice(open + 1, index),
          trailing: sql.slice(index + 1).trimStart(),
        }
      }
    }
  }
  return null
}

describe('session trajectory SQL contract', () => {
  it('adds ordered event time, paired bounded world coordinates, and the bounded sequence contract', () => {
    expect(migration).toContain('add column if not exists occurred_at timestamptz not null default now()')
    expect(migration).toContain('add column if not exists position_x double precision')
    expect(migration).toContain('add column if not exists position_y double precision')
    const positionCheck = extractCheckConstraint(migration, 'analytics_events_position_pair_check')
    expect(positionCheck).not.toBeNull()
    expect(positionCheck.expression).toContain('position_x between -10000 and 10000')
    expect(positionCheck.expression).toContain('position_y between -10000 and 10000')
    expect(positionCheck.expression).toContain("event_name <> 'center_position_sample'")
    expect(positionCheck.trailing).toMatch(/^;/)
    expect(migration).toContain('sequence between 1 and 100000')
  })

  it('stores anonymous session rollups server-side without client session-table reads or writes', () => {
    expect(migration).toContain('create table if not exists public.analytics_sessions')
    expect(migration).toContain('alter table public.analytics_sessions enable row level security')
    expect(migration).toContain('revoke all on public.analytics_sessions from public, anon, authenticated')
    expect(migration).toContain('security definer\nset search_path =')
    expect(migration).toContain('create trigger analytics_events_refresh_session_v2')
    expect(migration).toContain('greatest(public.analytics_sessions.elapsed_ms, excluded.elapsed_ms)')
  })

  it('provides owner-only trajectory and aggregate RPCs while retaining historical DB compatibility', () => {
    expect(migration).toContain('private.center_interaction_point_summary_v2')
    expect(migration).toContain('private.center_session_summary_v2')
    expect(migration).toContain('public.owner_center_session_detail(target_session_id uuid)')
    expect(migration).toContain('public.owner_center_analytics_v2()')
    expect(migration).toContain('if not private.is_owner(auth.uid()) then')
    expect(migration).toContain("'cafe_banknote_presented'")
  })

  it('does not modify the previous Chapter Two migration or allow client free-text timeline fields', () => {
    const chapterTwo = readFileSync(new URL('../supabase/migrations/20260930030935_chapter_two_commercial_analytics.sql', import.meta.url), 'utf8')
    expect(chapterTwo).toContain("'cafe_banknote_presented'")
    expect(migration).toContain("else '{}'::jsonb")
    expect(migration).not.toMatch(/freeText|dialogueText|feedbackText|typedContent/i)
  })
})

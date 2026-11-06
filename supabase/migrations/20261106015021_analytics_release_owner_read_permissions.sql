-- No anonymous SELECT or policy changes. These five columns remain subject to
-- analytics_events_owner_select, backed by private.owner_allowlist.
grant select (event_name, event_data, session_id, visitor_id, occurred_at)
  on public.analytics_events to authenticated;

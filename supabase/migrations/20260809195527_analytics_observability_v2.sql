alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'admin_login', 'admin_draft_saved', 'admin_published'
));

alter table public.analytics_events drop constraint if exists analytics_events_exit_reason_check;
alter table public.analytics_events add constraint analytics_events_exit_reason_check check (
  exit_reason is null or exit_reason in ('return', 'landing', 'hidden', 'unload', 'completed', 'abandoned', 'browser_back')
);

create index if not exists analytics_events_name_step_session_idx
  on public.analytics_events (event_name, step_id, session_id);

create or replace view private.analytics_session_summary with (security_invoker = true) as
select
  session_id,
  (array_agg(visitor_id order by received_at))[1] as visitor_id,
  min(received_at) as started_at,
  max(received_at) as last_event_at,
  coalesce(
    max(dwell_ms) filter (where event_name = 'session_end'),
    sum(dwell_ms) filter (where event_name = 'visibility_dwell'),
    extract(epoch from (max(received_at) - min(received_at)))::integer * 1000
  ) as dwell_ms,
  max(progress_ratio) as farthest_progress,
  (array_agg(step_id order by received_at desc) filter (
    where step_id is not null and event_name in ('beat_reached', 'beat_dwell')
  ))[1] as last_step,
  bool_or(event_name = 'reading_started') as started_reading,
  bool_or(event_name in ('reader_return', 'reader_exit', 'chapter_completed')) as ended_explicitly,
  bool_or(event_name = 'reader_entry_requested') as requested_reader,
  bool_or(event_name = 'chapter_completed') as completed_chapter
from public.analytics_events
group by session_id;

create or replace view private.analytics_daily_summary with (security_invoker = true) as
select
  started_at::date as day,
  count(*) as sessions,
  count(distinct visitor_id) as visitors,
  count(*) filter (where started_reading) as reading_starts,
  count(*) filter (where started_reading and not ended_explicitly) as inferred_abandons,
  round(avg(dwell_ms) / 1000.0, 1) as average_seconds,
  round(avg(farthest_progress) * 100, 1) as average_farthest_percent,
  round(max(farthest_progress) * 100, 1) as max_farthest_percent,
  count(*) filter (where requested_reader) as reader_attempts,
  count(*) filter (where completed_chapter) as chapter_completions
from private.analytics_session_summary
group by started_at::date;

create or replace view private.analytics_step_dwell with (security_invoker = true) as
select
  step_id,
  count(*) as samples,
  count(distinct session_id) as sessions,
  round(avg(dwell_ms) / 1000.0, 2) as average_seconds,
  round(sum(dwell_ms) / 1000.0, 2) as total_seconds,
  round(max(dwell_ms) / 1000.0, 2) as max_seconds
from public.analytics_events
where event_name = 'beat_dwell' and step_id is not null and dwell_ms is not null
group by step_id;

revoke all on private.analytics_step_dwell from public, anon, authenticated;

create or replace view private.analytics_session_summary with (security_invoker = true) as
select
  session_id,
  (array_agg(visitor_id order by received_at))[1] as visitor_id,
  min(received_at) as started_at,
  max(received_at) as last_event_at,
  coalesce(
    max(dwell_ms) filter (where event_name = 'session_end'),
    (sum(dwell_ms) filter (where event_name = 'visibility_dwell'))::integer,
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

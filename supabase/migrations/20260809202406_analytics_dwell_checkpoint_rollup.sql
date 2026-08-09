create or replace view private.analytics_session_summary with (security_invoker = true) as
with annotated as (
  select
    e.*,
    max(sequence) filter (where event_name = 'session_end') over (partition by session_id) as last_session_end_sequence
  from public.analytics_events e
), rolled as (
  select
    session_id,
    (array_agg(visitor_id order by received_at))[1] as visitor_id,
    min(received_at) as started_at,
    max(received_at) as last_event_at,
    max(dwell_ms) filter (
      where event_name = 'session_end' and sequence = last_session_end_sequence
    ) as checkpoint_dwell_ms,
    sum(dwell_ms) filter (
      where event_name = 'visibility_dwell'
        and (last_session_end_sequence is null or sequence > last_session_end_sequence)
    ) as dwell_after_checkpoint_ms,
    extract(epoch from (max(received_at) - min(received_at)))::integer * 1000 as elapsed_fallback_ms,
    max(progress_ratio) as farthest_progress,
    (array_agg(step_id order by received_at desc) filter (
      where step_id is not null and event_name in ('beat_reached', 'beat_dwell')
    ))[1] as last_step,
    bool_or(event_name = 'reading_started') as started_reading,
    bool_or(event_name in ('reader_return', 'reader_exit', 'chapter_completed')) as ended_explicitly,
    bool_or(event_name = 'reader_entry_requested') as requested_reader,
    bool_or(event_name = 'chapter_completed') as completed_chapter
  from annotated
  group by session_id
)
select
  session_id,
  visitor_id,
  started_at,
  last_event_at,
  case
    when checkpoint_dwell_ms is not null or dwell_after_checkpoint_ms is not null
      then coalesce(checkpoint_dwell_ms, 0) + coalesce(dwell_after_checkpoint_ms, 0)::integer
    else elapsed_fallback_ms
  end as dwell_ms,
  farthest_progress,
  last_step,
  started_reading,
  ended_explicitly,
  requested_reader,
  completed_chapter
from rolled;

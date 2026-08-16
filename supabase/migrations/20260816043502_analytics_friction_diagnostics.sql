alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
  'admin_login', 'admin_draft_saved', 'admin_published'
));

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
      where step_id is not null and event_name in ('beat_reached', 'beat_dwell', 'reader_checkpoint')
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

create or replace view private.analytics_entry_friction with (security_invoker = true) as
with shown as (
  select
    session_id,
    (array_agg(visitor_id order by received_at))[1] as visitor_id,
    step_id,
    min(received_at) as shown_at
  from public.analytics_events
  where event_name = 'entry_step_shown' and step_id is not null
  group by session_id, step_id
), dwell as (
  select session_id, step_id, max(dwell_ms) as dwell_ms
  from public.analytics_events
  where event_name = 'entry_step_dwell' and step_id is not null and dwell_ms is not null
  group by session_id, step_id
), blocked as (
  select session_id, step_id, count(*) as blocked_attempts
  from public.analytics_events
  where event_name = 'entry_blocked' and step_id is not null
  group by session_id, step_id
), completed as (
  select session_id, 'entry:landing-transition'::text as step_id
  from public.analytics_events
  where event_name = 'entry_step_shown'
    and step_id in ('entry:language', 'entry:mode', 'entry:reader-handoff')
  union
  select session_id, 'entry:language'::text as step_id
  from public.analytics_events
  where event_name = 'language_selected' and step_id = 'entry:language'
  union
  select session_id, 'entry:mode'::text as step_id
  from public.analytics_events
  where event_name = 'mode_selected' and step_id = 'entry:mode'
  union
  select session_id, 'entry:reader-handoff'::text as step_id
  from public.analytics_events
  where event_name = 'reading_started'
), per_session as (
  select
    shown.session_id,
    shown.visitor_id,
    shown.step_id,
    shown.shown_at,
    dwell.dwell_ms,
    coalesce(blocked.blocked_attempts, 0) as blocked_attempts,
    completed.session_id is not null as completed
  from shown
  left join dwell using (session_id, step_id)
  left join blocked using (session_id, step_id)
  left join completed using (session_id, step_id)
)
select
  step_id,
  count(*) as sessions_shown,
  count(*) filter (where completed) as sessions_completed,
  count(*) filter (where not completed) as sessions_without_completion,
  round(100.0 * count(*) filter (where completed) / nullif(count(*), 0), 1) as completion_rate_percent,
  count(*) filter (where blocked_attempts > 0) as sessions_with_blocked_attempts,
  sum(blocked_attempts) as blocked_attempts,
  count(dwell_ms) as measured_sessions,
  round(avg(dwell_ms)::numeric / 1000, 2) as average_seconds,
  round((percentile_cont(0.9) within group (order by dwell_ms))::numeric / 1000, 2) as p90_seconds,
  round(max(dwell_ms)::numeric / 1000, 2) as max_seconds
from per_session
group by step_id;

create or replace view private.analytics_reader_last_position with (security_invoker = true) as
select distinct on (session_id)
  session_id,
  visitor_id,
  received_at as confirmed_at,
  event_name as confirmation_event,
  step_id as last_step,
  progress_ratio as farthest_progress,
  dwell_ms as observed_dwell_ms,
  exit_reason
from public.analytics_events
where event_name in ('beat_reached', 'beat_dwell', 'reader_checkpoint', 'reader_return')
  and step_id is not null
order by session_id, sequence desc, received_at desc;

revoke all on private.analytics_entry_friction from public, anon, authenticated;
revoke all on private.analytics_reader_last_position from public, anon, authenticated;

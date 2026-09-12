alter table public.analytics_events
  add column if not exists scene_id text check (scene_id is null or (length(scene_id) between 1 and 128 and scene_id ~ '^[A-Za-z0-9:_-]+$')),
  add column if not exists object_id text check (object_id is null or (length(object_id) between 1 and 128 and object_id ~ '^[A-Za-z0-9:_-]+$')),
  add column if not exists object_kind text check (object_kind is null or (length(object_kind) between 1 and 128 and object_kind ~ '^[A-Za-z0-9:_-]+$')),
  add column if not exists destination_scene_id text check (destination_scene_id is null or (length(destination_scene_id) between 1 and 128 and destination_scene_id ~ '^[A-Za-z0-9:_-]+$')),
  add column if not exists device text check (device is null or device in ('surface', 'inner')),
  add column if not exists outcome text check (outcome is null or (length(outcome) between 1 and 128 and outcome ~ '^[A-Za-z0-9:_-]+$'));

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
  'admin_login', 'admin_draft_saved', 'admin_published',
  'center_entry_requested', 'center_scene_entered', 'center_scene_exited',
  'center_object_interacted', 'center_door_attempted', 'center_door_blocked',
  'center_door_crossed', 'center_phone_opened', 'center_ride_ready'
));

grant insert (scene_id, object_id, object_kind, destination_scene_id, device, outcome)
  on public.analytics_events to anon, authenticated;

create index if not exists analytics_events_center_scene_session_idx
  on public.analytics_events (scene_id, session_id, received_at)
  where scene_id is not null;
create index if not exists analytics_events_center_object_idx
  on public.analytics_events (scene_id, object_id, event_name, received_at)
  where object_id is not null;

create or replace view private.center_scene_summary with (security_invoker = true) as
select
  scene_id,
  count(distinct visitor_id) as visitors,
  count(distinct session_id) as sessions,
  count(*) filter (where event_name = 'center_scene_entered') as entries,
  count(*) filter (where event_name = 'center_scene_exited') as exits,
  round(avg(dwell_ms) filter (where event_name = 'center_scene_exited') / 1000.0, 1) as average_seconds,
  max(dwell_ms) filter (where event_name = 'center_scene_exited') as longest_dwell_ms
from public.analytics_events
where scene_id is not null
  and event_name in ('center_scene_entered', 'center_scene_exited')
group by scene_id;

create or replace view private.center_object_summary with (security_invoker = true) as
select
  scene_id,
  object_id,
  object_kind,
  count(*) as interactions,
  count(distinct visitor_id) as visitors,
  count(distinct session_id) as sessions,
  round(avg(dwell_ms) / 1000.0, 1) as average_seconds,
  max(dwell_ms) as longest_dwell_ms
from public.analytics_events
where event_name = 'center_object_interacted'
  and scene_id is not null
  and object_id is not null
group by scene_id, object_id, object_kind;

create or replace view private.center_session_summary with (security_invoker = true) as
select
  session_id,
  (array_agg(visitor_id order by received_at))[1] as visitor_id,
  min(received_at) as started_at,
  max(received_at) as last_event_at,
  bool_or(event_name = 'center_ride_ready') as reached_ride_boundary,
  bool_or(event_name = 'center_scene_entered') as entered_center,
  (array_agg(scene_id order by received_at desc) filter (where scene_id is not null))[1] as last_scene_id
from public.analytics_events
where event_name like 'center_%'
group by session_id;

revoke all on private.center_scene_summary from public, anon, authenticated;
revoke all on private.center_object_summary from public, anon, authenticated;
revoke all on private.center_session_summary from public, anon, authenticated;

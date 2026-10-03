-- Anonymous Center interaction and session trajectory contract.
-- This is a repo-local migration only; do not apply to a remote project here.

alter table public.analytics_events
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists position_x double precision,
  add column if not exists position_y double precision;

alter table public.analytics_events
  drop constraint if exists analytics_events_position_pair_check;
alter table public.analytics_events
  add constraint analytics_events_position_pair_check check (
    (
      (position_x is null and position_y is null)
      or (
        position_x is not null and position_y is not null
        and position_x between -10000 and 10000
        and position_y between -10000 and 10000
        and event_name = 'center_position_sample'
      )
    )
    and (event_name <> 'center_position_sample' or (position_x is not null and position_y is not null))
  );

alter table public.analytics_events
  drop constraint if exists analytics_events_sequence_check;
alter table public.analytics_events
  add constraint analytics_events_sequence_check check (sequence between 1 and 100000);

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events
  add constraint analytics_events_event_name_check check (event_name in (
    'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
    'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
    'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
    'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
    'admin_login', 'admin_draft_saved', 'admin_published',
    'center_entry_requested', 'center_scene_entered', 'center_scene_exited',
    'center_object_interacted', 'center_door_attempted', 'center_door_blocked',
    'center_door_crossed', 'center_phone_opened', 'center_phone_closed', 'center_ride_ready',
    'center_feedback_prompt_shown', 'center_feedback_opened', 'center_feedback_submitted',
    'center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked',
    'center_position_sample', 'center_reading_started', 'center_reading_ended', 'session_checkpoint',
    'commercial_street_entered', 'commercial_question_triggered', 'commercial_question_completed',
    'commercial_storefront_interacted', 'milk_tea_app_unlocked', 'milk_tea_order_started',
    'milk_tea_order_confirmed', 'milk_tea_order_ready', 'milk_tea_order_picked_up',
    'cafe_storefront_revealed', 'cafe_entered', 'cafe_story_stage_reached',
    'cafe_coffee_ordered', 'cafe_ready_to_leave', 'cafe_completed',
    'cafe_banknote_presented'
  ));

grant insert (occurred_at, position_x, position_y)
  on public.analytics_events to anon, authenticated;

create index if not exists analytics_events_session_sequence_idx
  on public.analytics_events (session_id, sequence);
create index if not exists analytics_events_interaction_point_idx
  on public.analytics_events (scene_id, object_id, event_name, session_id)
  where object_id is not null;

create table if not exists public.analytics_sessions (
  session_id uuid primary key,
  visitor_id uuid not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  ended_at timestamptz,
  elapsed_ms bigint not null default 0 check (elapsed_ms >= 0),
  foreground_ms bigint not null default 0 check (foreground_ms >= 0),
  engaged_ms bigint not null default 0 check (engaged_ms >= 0),
  idle_ms bigint not null default 0 check (idle_ms >= 0),
  movement_ms bigint not null default 0 check (movement_ms >= 0),
  reading_ms bigint not null default 0 check (reading_ms >= 0),
  phone_ms bigint not null default 0 check (phone_ms >= 0),
  last_scene_id text,
  last_sequence integer not null default 0 check (last_sequence between 0 and 100000),
  updated_at timestamptz not null default now()
);
alter table public.analytics_sessions enable row level security;
revoke all on public.analytics_sessions from public, anon, authenticated;

create or replace function private.refresh_analytics_session_from_event_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_time timestamptz := coalesce(new.occurred_at, new.received_at);
  checkpoint_data jsonb := case when new.event_name = 'session_checkpoint' then new.event_data else '{}'::jsonb end;
begin
  insert into public.analytics_sessions (
    session_id, visitor_id, started_at, last_seen_at, ended_at,
    elapsed_ms, foreground_ms, engaged_ms, idle_ms, movement_ms, reading_ms, phone_ms,
    last_scene_id, last_sequence, updated_at
  ) values (
    new.session_id, new.visitor_id, event_time, event_time,
    case when new.event_name = 'session_end' then event_time else null end,
    coalesce((checkpoint_data->>'elapsedMs')::bigint, 0),
    coalesce((checkpoint_data->>'foregroundMs')::bigint, 0),
    coalesce((checkpoint_data->>'engagedMs')::bigint, 0),
    coalesce((checkpoint_data->>'idleMs')::bigint, 0),
    coalesce((checkpoint_data->>'movementMs')::bigint, 0),
    coalesce((checkpoint_data->>'readingMs')::bigint, 0),
    coalesce((checkpoint_data->>'phoneMs')::bigint, 0),
    new.scene_id, new.sequence, now()
  )
  on conflict (session_id) do update set
    started_at = least(public.analytics_sessions.started_at, excluded.started_at),
    last_seen_at = greatest(public.analytics_sessions.last_seen_at, excluded.last_seen_at),
    ended_at = case
      when new.event_name = 'session_end' then greatest(coalesce(public.analytics_sessions.ended_at, excluded.ended_at), excluded.ended_at)
      when excluded.last_sequence > public.analytics_sessions.last_sequence then null
      else public.analytics_sessions.ended_at
    end,
    elapsed_ms = greatest(public.analytics_sessions.elapsed_ms, excluded.elapsed_ms),
    foreground_ms = greatest(public.analytics_sessions.foreground_ms, excluded.foreground_ms),
    engaged_ms = greatest(public.analytics_sessions.engaged_ms, excluded.engaged_ms),
    idle_ms = greatest(public.analytics_sessions.idle_ms, excluded.idle_ms),
    movement_ms = greatest(public.analytics_sessions.movement_ms, excluded.movement_ms),
    reading_ms = greatest(public.analytics_sessions.reading_ms, excluded.reading_ms),
    phone_ms = greatest(public.analytics_sessions.phone_ms, excluded.phone_ms),
    last_scene_id = case when excluded.last_sequence >= public.analytics_sessions.last_sequence
      then excluded.last_scene_id else public.analytics_sessions.last_scene_id end,
    last_sequence = greatest(public.analytics_sessions.last_sequence, excluded.last_sequence),
    updated_at = now();
  return new;
end;
$$;
revoke all on function private.refresh_analytics_session_from_event_v2() from public, anon, authenticated;

drop trigger if exists analytics_events_refresh_session_v2 on public.analytics_events;
create trigger analytics_events_refresh_session_v2
  after insert on public.analytics_events
  for each row execute function private.refresh_analytics_session_from_event_v2();

create or replace view private.center_interaction_point_summary_v2
with (security_invoker = true) as
with generic_sessions as (
  select distinct session_id from public.analytics_events
  where event_name in ('center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked')
), interaction_rows as (
  select scene_id, object_id, object_kind, visitor_id, session_id, event_name
  from public.analytics_events
  where event_name in ('center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked')
    and scene_id is not null and object_id is not null and object_kind is not null
  union all
  select e.scene_id, e.object_id, e.object_kind, e.visitor_id, e.session_id, 'center_interaction_completed'
  from public.analytics_events e
  where e.event_name = 'center_object_interacted'
    and e.scene_id is not null and e.object_id is not null and e.object_kind is not null
    and not exists (select 1 from generic_sessions g where g.session_id = e.session_id)
)
select
  scene_id,
  object_id,
  object_kind,
  count(*) filter (where event_name = 'center_interaction_requested')::bigint as requested_count,
  count(*) filter (where event_name = 'center_interaction_completed')::bigint as completed_count,
  count(*) filter (where event_name = 'center_interaction_blocked')::bigint as blocked_count,
  count(distinct session_id) filter (where event_name = 'center_interaction_requested')::bigint as requested_sessions,
  count(distinct session_id) filter (where event_name = 'center_interaction_completed')::bigint as completed_sessions,
  count(distinct session_id) filter (where event_name = 'center_interaction_blocked')::bigint as blocked_sessions,
  count(distinct visitor_id) filter (where event_name = 'center_interaction_requested')::bigint as requested_visitors,
  count(distinct visitor_id) filter (where event_name = 'center_interaction_completed')::bigint as completed_visitors,
  greatest(0, count(*) filter (where event_name = 'center_interaction_requested')
    - count(distinct session_id) filter (where event_name = 'center_interaction_requested'))::bigint as repeat_requests,
  coalesce(round(100.0 * count(*) filter (where event_name = 'center_interaction_completed')
    / nullif(count(*) filter (where event_name = 'center_interaction_requested'), 0), 1), 0) as completion_rate_percent
from interaction_rows
group by scene_id, object_id, object_kind;

create or replace view private.center_session_summary_v2
with (security_invoker = true) as
select
  s.session_id, s.visitor_id, s.started_at, s.last_seen_at, s.ended_at,
  s.elapsed_ms, s.foreground_ms, s.engaged_ms, s.idle_ms,
  s.movement_ms, s.reading_ms, s.phone_ms, s.last_scene_id, s.last_sequence,
  coalesce(scene_list.scenes_visited, array[]::text[]) as scenes_visited,
  coalesce(interactions.interaction_requests, 0)::bigint as interaction_requests,
  coalesce(interactions.interaction_completions, 0)::bigint as interaction_completions,
  coalesce(interactions.unique_interaction_points, 0)::bigint as unique_interaction_points
from public.analytics_sessions s
left join lateral (
  select array_agg(v.scene_id order by v.first_sequence) as scenes_visited
  from (
    select scene_id, min(sequence) as first_sequence
    from public.analytics_events
    where session_id = s.session_id and scene_id is not null
    group by scene_id
  ) v
) scene_list on true
left join lateral (
  select
    count(*) filter (where event_name = 'center_interaction_requested') as interaction_requests,
    count(*) filter (where event_name = 'center_interaction_completed') as interaction_completions,
    count(distinct (scene_id, object_id)) filter (where event_name = 'center_interaction_requested') as unique_interaction_points
  from public.analytics_events
  where session_id = s.session_id
    and event_name in ('center_interaction_requested', 'center_interaction_completed', 'center_interaction_blocked')
) interactions on true;

revoke all on private.center_interaction_point_summary_v2 from public, anon, authenticated;
revoke all on private.center_session_summary_v2 from public, anon, authenticated;

create or replace function public.owner_center_session_detail(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not private.is_owner(auth.uid()) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'summary', (select to_jsonb(s) from private.center_session_summary_v2 s where s.session_id = target_session_id),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence', e.sequence,
        'occurred_at', e.occurred_at,
        'received_at', e.received_at,
        'event_name', e.event_name,
        'scene_id', e.scene_id,
        'object_id', e.object_id,
        'object_kind', e.object_kind,
        'position_x', e.position_x,
        'position_y', e.position_y,
        'outcome', e.outcome,
        'event_data', case
          when e.event_name = 'commercial_storefront_interacted' then jsonb_strip_nulls(jsonb_build_object('slotId', e.event_data->'slotId', 'storeType', e.event_data->'storeType'))
          when e.event_name = 'milk_tea_order_confirmed' then jsonb_strip_nulls(jsonb_build_object('drink', e.event_data->'drink', 'sugar', e.event_data->'sugar', 'ice', e.event_data->'ice', 'orderNumber', e.event_data->'orderNumber', 'queueAheadAtOrder', e.event_data->'queueAheadAtOrder'))
          when e.event_name in ('milk_tea_order_ready','milk_tea_order_picked_up') then jsonb_strip_nulls(jsonb_build_object('orderNumber', e.event_data->'orderNumber'))
          when e.event_name = 'cafe_story_stage_reached' then jsonb_strip_nulls(jsonb_build_object('stage', e.event_data->'stage'))
          when e.event_name = 'session_checkpoint' then jsonb_strip_nulls(jsonb_build_object('elapsedMs', e.event_data->'elapsedMs', 'foregroundMs', e.event_data->'foregroundMs', 'engagedMs', e.event_data->'engagedMs', 'idleMs', e.event_data->'idleMs', 'movementMs', e.event_data->'movementMs', 'readingMs', e.event_data->'readingMs', 'phoneMs', e.event_data->'phoneMs'))
          else '{}'::jsonb
        end
      ) order by e.sequence)
      from public.analytics_events e
      where e.session_id = target_session_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.owner_center_session_detail(uuid) from public, anon, authenticated;
grant execute on function public.owner_center_session_detail(uuid) to authenticated;

create or replace function public.owner_center_analytics_v2()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not private.is_owner(auth.uid()) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'sessions', (select count(*) from public.analytics_sessions),
      'visitors', (select count(distinct visitor_id) from public.analytics_sessions),
      'interaction_requests', (select count(*) from public.analytics_events where event_name = 'center_interaction_requested'),
      'interaction_completions', (select count(*) from public.analytics_events where event_name = 'center_interaction_completed'),
      'interaction_blocked', (select count(*) from public.analytics_events where event_name = 'center_interaction_blocked')
    ),
    'interaction_points', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.scene_id, p.object_id)
      from private.center_interaction_point_summary_v2 p
    ), '[]'::jsonb),
    'recent_sessions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.last_seen_at desc)
      from (select * from private.center_session_summary_v2 order by last_seen_at desc limit 100) s
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.owner_center_analytics_v2() from public, anon, authenticated;
grant execute on function public.owner_center_analytics_v2() to authenticated;

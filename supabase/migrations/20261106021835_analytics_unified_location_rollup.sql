-- Same events, table and owner RLS. Only the common report gains real-room visits.
grant select (step_id, scene_id, object_id, object_kind, outcome, sequence)
  on public.analytics_events to authenticated;
create or replace function public.owner_release_analytics(
  p_release text default '0.3.0', p_environment text default 'production',
  p_from timestamptz default now() - interval '7 days', p_to timestamptz default now()
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_release is null or p_release !~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    or p_environment is null or p_environment not in ('production','staging','preview','development')
    or p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days'
    then raise exception 'invalid analytics filter' using errcode = '22023'; end if;
  with tagged as materialized (
    select event_name,event_data,session_id,visitor_id,step_id,scene_id,object_id,object_kind,outcome,sequence,occurred_at
    from public.analytics_events where event_data->>'release'=p_release and event_data->>'environment'=p_environment and occurred_at<p_to
  ), filtered as materialized (select * from tagged where occurred_at>=p_from),
  visits as (
    select session_id,step_id,scene_id,event_data->>'roomId' as room_id,
      greatest(0,max((event_data->>'sceneForegroundMs')::numeric)
        - coalesce(max((event_data->>'sceneForegroundMs')::numeric) filter(where occurred_at<p_from),0)) as foreground_ms,
      greatest(0,max((event_data->>'sceneEngagedMs')::numeric)
        - coalesce(max((event_data->>'sceneEngagedMs')::numeric) filter(where occurred_at<p_from),0)) as engaged_ms
    from tagged where event_name in ('session_checkpoint','center_scene_entered','center_scene_exited') and step_id is not null
      and jsonb_typeof(event_data->'sceneForegroundMs')='number' and jsonb_typeof(event_data->'sceneEngagedMs')='number'
    group by session_id,step_id,scene_id,event_data->>'roomId' having bool_or(occurred_at>=p_from)
  ), locations as (
    select scene_id,room_id,count(*) as visits,count(distinct session_id) as sessions,
      sum(foreground_ms) as foreground_ms,sum(engaged_ms) as engaged_ms
    from visits group by scene_id,room_id
  ), groups as (
    select event_name,coalesce(event_data->>'intent','') as dimension,object_id,object_kind,outcome,
      count(*) as events,count(distinct session_id) as sessions,count(distinct visitor_id) as visitors
    from filtered where event_name in ('landing_entry','center_entry_action','center_entry_completed','center_interaction_completed')
    group by event_name,coalesce(event_data->>'intent',''),object_id,object_kind,outcome
  ), recent_paths as (
    select session_id,jsonb_agg(jsonb_build_object('sceneId',scene_id,'roomId',event_data->>'roomId','at',occurred_at) order by occurred_at,sequence) as locations
    from (select * from filtered where event_name='center_scene_entered' order by occurred_at desc,sequence desc limit 500) points
    group by session_id order by max(occurred_at) desc limit 20
  ) select jsonb_build_object('release',p_release,'environment',p_environment,'from',p_from,'to',p_to,
    'summary',jsonb_build_object(
      'visitors',(select count(distinct visitor_id) from filtered where event_name='landing_entry'),
      'sessions',(select count(distinct session_id) from filtered where event_name='landing_entry'),
      'entered_sessions',(select count(distinct session_id) from filtered where event_name='center_entry_completed'),
      'foreground_ms',(select coalesce(sum(foreground_ms),0) from visits),
      'engaged_ms',(select coalesce(sum(engaged_ms),0) from visits)),
    'events',(select coalesce(jsonb_agg(to_jsonb(groups) order by event_name,object_id,outcome,dimension),'[]'::jsonb) from groups),
    'locations',(select coalesce(jsonb_agg(to_jsonb(locations) order by scene_id,room_id),'[]'::jsonb) from locations),
    'paths',(select coalesce(jsonb_agg(to_jsonb(recent_paths)),'[]'::jsonb) from recent_paths)
  ) into result;
  return result;
end $$;
-- Existing function EXECUTE grants remain authenticated-only; no policy or data changes.

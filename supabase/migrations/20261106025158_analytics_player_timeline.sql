-- Raw chronological history for each anonymous browser visitor and all visitors together.
-- Invoker + existing owner RLS. No counter table, new event type, or history rewrite.
grant select (id,position_x,position_y) on public.analytics_events to authenticated;
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
    select client_event_id,event_name,event_data,session_id,visitor_id,step_id,scene_id,object_id,object_kind,outcome,dwell_ms,sequence,occurred_at
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
  ), marks as (
    select visitor_id,occurred_at,
      (event_data->>'sceneForegroundMs')::numeric as foreground_ms,
      (event_data->>'sceneEngagedMs')::numeric as engaged_ms,
      max((event_data->>'sceneForegroundMs')::numeric) over (partition by session_id,step_id order by occurred_at,sequence rows between unbounded preceding and 1 preceding) as previous_foreground,
      max((event_data->>'sceneEngagedMs')::numeric) over (partition by session_id,step_id order by occurred_at,sequence rows between unbounded preceding and 1 preceding) as previous_engaged
    from tagged where event_name in ('session_checkpoint','center_scene_entered','center_scene_exited') and step_id is not null
      and jsonb_typeof(event_data->'sceneForegroundMs')='number' and jsonb_typeof(event_data->'sceneEngagedMs')='number'
  ), daily as (
    select date_trunc('day',occurred_at at time zone 'UTC') as day,count(distinct visitor_id) as players,
      sum(greatest(0,foreground_ms-coalesce(previous_foreground,0))) as foreground_ms,
      sum(greatest(0,engaged_ms-coalesce(previous_engaged,0))) as engaged_ms
    from marks where occurred_at>=p_from group by date_trunc('day',occurred_at at time zone 'UTC')
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
    'events','[]'::jsonb,
    'interactions',(select coalesce(jsonb_agg(to_jsonb(raw) order by raw.occurred_at desc,raw.sequence desc),'[]'::jsonb)
      from (select client_event_id,visitor_id,session_id,scene_id,object_id,object_kind,outcome,dwell_ms,occurred_at,event_data,sequence
        from filtered where event_name='center_object_interacted' order by occurred_at desc,sequence desc limit 500) raw),
    'daily',(select coalesce(jsonb_agg(to_jsonb(daily) order by day),'[]'::jsonb) from daily),
    'locations',(select coalesce(jsonb_agg(to_jsonb(locations) order by scene_id,room_id),'[]'::jsonb) from locations),
    'paths',(select coalesce(jsonb_agg(to_jsonb(recent_paths)),'[]'::jsonb) from recent_paths)
  ) into result;
  return result;
end $$;
-- Existing function EXECUTE grants remain authenticated-only; no policy or data changes.

create function public.owner_player_history(
  p_release text, p_environment text, p_from timestamptz, p_to timestamptz,
  p_visitor uuid default null, p_before_time timestamptz default null, p_before_id bigint default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_release is null or p_release !~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    or p_environment is null or p_environment not in ('production','staging','preview','development')
    or p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days'
    or (p_before_time is null) <> (p_before_id is null)
    then raise exception 'invalid history filter' using errcode='22023'; end if;
  with page as materialized (
    select id,client_event_id,visitor_id,session_id,event_name,scene_id,object_id,object_kind,outcome,dwell_ms,position_x,position_y,occurred_at,sequence,event_data
    from public.analytics_events where event_data->>'release'=p_release and event_data->>'environment'=p_environment
      and occurred_at>=p_from and occurred_at<p_to and (p_visitor is null or visitor_id=p_visitor)
      and (p_before_time is null or (occurred_at,id)<(p_before_time,p_before_id))
      and event_name in ('landing_entry','center_entry_completed','center_scene_entered','center_scene_exited',
        'center_position_sample','center_object_interacted','session_checkpoint','session_end')
    order by occurred_at desc,id desc limit 500
  ) select jsonb_build_object(
    'items',(select coalesce(jsonb_agg(to_jsonb(page)-'id' order by occurred_at,sequence,id),'[]'::jsonb) from page),
    'nextCursor',case when (select count(*) from page)=500 then
      (select jsonb_build_object('at',occurred_at,'id',id::text) from page order by occurred_at,id limit 1) else null end
  ) into result;
  return result;
end $$;
revoke all on function public.owner_player_history(text,text,timestamptz,timestamptz,uuid,timestamptz,bigint) from public,anon;
grant execute on function public.owner_player_history(text,text,timestamptz,timestamptz,uuid,timestamptz,bigint) to authenticated;

-- REVIEW DRAFT ONLY. NOT an applied/generated migration. No real database execution authorized.
-- Activate VITE_PLAYER_HISTORY_V2 only after isolated DB verification and approval.
-- Preserve existing rows, old event names, owner RLS, grants and existing RPCs.
begin;
do $$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
 where conrelid='public.analytics_events'::regclass and conname='analytics_events_event_name_check';
 alter table public.analytics_events drop constraint analytics_events_event_name_check;
 execute 'alter table public.analytics_events add constraint analytics_events_event_name_check check (('||expression||') or event_name in (''web_visit_state'',''foreground_no_operation'',''interaction_started'',''gameplay_ended'',''business_completed''))';
end $$;
-- Existing strict per-event shapes remain unchanged after removing validated common v2 metadata.
do $$
declare expression text; constraint_name text;
begin
 foreach constraint_name in array array['analytics_events_v030_payload_check','analytics_events_raw_interaction_data_check'] loop
 select pg_get_expr(conbin,conrelid) into strict expression from pg_constraint
 where conrelid='public.analytics_events'::regclass and conname=constraint_name;
 execute format('alter table public.analytics_events drop constraint %I',constraint_name);
 execute format('alter table public.analytics_events add constraint %I check (%s)',constraint_name,
 replace(expression,'event_data','(event_data - array[''webVisitId'',''documentId'',''buildSha'',''internalTest'',''gameTimeMs'',''historyProtocol'',''interactionId'',''startedAt'',''gameTimeStartedMs'',''gameTimeEndedMs'',''lastShown'',''lastConfirmed''])'));
 end loop;
end $$;

alter table public.analytics_events add constraint analytics_events_history_v2_check check (
 not (event_data ? 'historyProtocol') or coalesce((event_data->'historyProtocol'='2'::jsonb
 and (event_data->>'buildSha' is null or event_data->>'buildSha' ~ '^[a-fA-F0-9]{40}$')
 and jsonb_typeof(event_data->'internalTest')='boolean'
 and (not(event_data?'gameTimeMs') or event_data->'gameTimeMs'='null'::jsonb or (jsonb_typeof(event_data->'gameTimeMs')='number' and (event_data->>'gameTimeMs')::numeric>=0))
 and octet_length(event_data::text)<=8192
 and (not(event_data?'lastShown') or (jsonb_typeof(event_data->'lastShown')='object' and (event_data->'lastShown') - array['lineId','sentenceIndex','pageIndex','at','gameTimeMs']='{}'::jsonb))
 and (not(event_data?'lastConfirmed') or (jsonb_typeof(event_data->'lastConfirmed')='object' and (event_data->'lastConfirmed') - array['lineId','sentenceIndex','pageIndex','at','gameTimeMs']='{}'::jsonb))
 ),false)
);
alter table public.analytics_events add constraint analytics_events_history_lifecycle_check check (
 event_name not in ('web_visit_state','foreground_no_operation','interaction_started','gameplay_ended','business_completed') or coalesce((
 event_data->'historyProtocol'='2'::jsonb and event_data ?& array['webVisitId','documentId','release','environment']
 and event_data - array['webVisitId','documentId','release','environment','buildSha','internalTest','historyProtocol','gameTimeMs','sceneId','roomId','status','reason','startedAt','endedAt','lastKnownAt','previousLastKnownAt','foregroundMs','endConfirmed','persisted','intervalId','durationMs','possibleAfk','partial','gameTimeStartedMs','interactionId','contentId','currentNoOperation','activeInteractions']='{}'::jsonb
 and (not(event_data?'endConfirmed') or event_data->'endConfirmed'='false'::jsonb)
 and (event_name<>'foreground_no_operation' or (jsonb_typeof(event_data->'durationMs')='number' and (event_data->>'durationMs')::numeric>0
 and event_data->'possibleAfk'=to_jsonb((event_data->>'durationMs')::numeric>30000)))
 ),false)
);

create function public.owner_player_history_v2(
 p_release text,p_environment text,p_from timestamptz,p_to timestamptz,
 p_visitor uuid default null,p_before_time timestamptz default null,p_before_id bigint default null,
 p_search text default '',p_internal text default 'all'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_release is null or p_release !~ '^[0-9]+[.][0-9]+[.][0-9]+$' or p_environment is null or p_environment not in ('production','staging','preview','development')
 or p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '31 days'
 or (p_before_time is null)<>(p_before_id is null) or p_search is null or p_search !~ '^[a-fA-F0-9-]{0,36}$'
 or p_internal is null or p_internal not in ('all','internal','external','unknown')
 then raise exception 'invalid history filter' using errcode='22023'; end if;
 with tagged as materialized (
 select id,client_event_id,visitor_id,session_id,step_id,event_name,scene_id,object_id,object_kind,outcome,dwell_ms,position_x,position_y,occurred_at,sequence,event_data
 from public.analytics_events where event_data->>'release'=p_release and event_data->>'environment'=p_environment and occurred_at<p_to
 and (p_internal='all' or p_internal='internal' and event_data->'internalTest'='true'::jsonb
 or p_internal='external' and event_data->'internalTest'='false'::jsonb or p_internal='unknown' and not(event_data?'internalTest'))
 ), filtered as materialized (
 select * from tagged where occurred_at>=p_from and visitor_id::text ilike p_search||'%'
 ), page as materialized (
 select * from filtered where (p_visitor is null or visitor_id=p_visitor)
 and (p_before_time is null or (occurred_at,id)<(p_before_time,p_before_id))
 and event_name in ('landing_entry','center_entry_completed','center_scene_entered','center_scene_exited','center_position_sample','center_object_interacted','session_checkpoint','session_end','web_visit_state','foreground_no_operation','interaction_started','gameplay_ended','business_completed')
 order by occurred_at desc,id desc limit 500
 ), players as (
 select visitor_id,max(occurred_at) as last_known_at from filtered group by visitor_id order by max(occurred_at) desc,visitor_id limit 200
 ), marks as (
 select visitor_id,occurred_at,greatest(0,(event_data->>'foregroundMs')::numeric-coalesce(lag((event_data->>'foregroundMs')::numeric) over(partition by visitor_id,event_data->>'webVisitId' order by occurred_at,sequence,id),0)) as delta
 from tagged where event_name='web_visit_state' and jsonb_typeof(event_data->'foregroundMs')='number'
 ), daily as (
 select date_trunc('day',occurred_at at time zone 'UTC') as day,count(distinct visitor_id) as players,sum(delta) as foreground_ms
 from marks where occurred_at>=p_from group by 1
 ), facts as (
 select date_trunc('day',occurred_at at time zone 'UTC') as day,
 count(*) filter(where event_name='center_object_interacted') as interactions,
 count(*) filter(where event_name='center_object_interacted' and outcome='story-completed') as story_completions,
 coalesce(sum((event_data->>'durationMs')::numeric) filter(where event_name='foreground_no_operation' and jsonb_typeof(event_data->'durationMs')='number'),0) as no_operation_ms
 from tagged where occurred_at>=p_from group by 1
 ), room_marks as (
 select scene_id,event_data->>'roomId' as room_id,occurred_at,
 greatest(0,(event_data->>'sceneForegroundMs')::numeric-coalesce(lag((event_data->>'sceneForegroundMs')::numeric) over(partition by session_id,step_id order by occurred_at,sequence,id),0)) as delta
 from tagged
 where event_name in ('session_checkpoint','center_scene_entered','center_scene_exited') and step_id is not null and jsonb_typeof(event_data->'sceneForegroundMs')='number'
 ), locations as (
 select scene_id,room_id,sum(delta) as foreground_ms from room_marks where occurred_at>=p_from group by scene_id,room_id
 ) select jsonb_build_object(
 'items',(select coalesce(jsonb_agg(to_jsonb(page)-'id' order by occurred_at,sequence,id),'[]'::jsonb) from page),
 'players',(select coalesce(jsonb_agg(to_jsonb(players) order by last_known_at desc),'[]'::jsonb) from players),
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',coalesce(daily.day,facts.day),'players',coalesce(daily.players,0),'foreground_ms',coalesce(daily.foreground_ms,0),'interactions',coalesce(facts.interactions,0),'story_completions',coalesce(facts.story_completions,0),'no_operation_ms',coalesce(facts.no_operation_ms,0)) order by coalesce(daily.day,facts.day)),'[]'::jsonb) from daily full join facts using(day)),
 'locations',(select coalesce(jsonb_agg(to_jsonb(locations) order by scene_id,room_id),'[]'::jsonb) from locations),
 'nextCursor',case when (select count(*) from page)=500 then (select jsonb_build_object('at',occurred_at,'id',id::text) from page order by occurred_at,id limit 1) else null end
 ) into result;
 return result;
end $$;
revoke all on function public.owner_player_history_v2(text,text,timestamptz,timestamptz,uuid,timestamptz,bigint,text,text) from public,anon;
grant execute on function public.owner_player_history_v2(text,text,timestamptz,timestamptz,uuid,timestamptz,bigint,text,text) to authenticated;
commit;
-- Rollback plan: disable v2 frontend first, retain v2 rows and new accepting constraints.
-- Do not restore restrictive old constraints while v2 rows exist; never delete history to roll back UI.
-- No UPDATE/DELETE/backfill, no policy change, no SECURITY DEFINER, no new anonymous read grant.

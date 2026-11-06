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

-- Pure validation helpers are outside the exposed public API schema. No data access.
create schema if not exists analytics_validation;
create function analytics_validation.fields(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; n numeric;
begin
 if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>8192 then return false; end if;
 for k,v in select * from jsonb_each(d) loop
  if k=any(array['webVisitId','documentId','interactionId','intervalId','roomId','sceneId','contentId','lineId','objectId','objectKind','slotId','shopId','visitId']) then
   if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~ '^[A-Za-z0-9:_-]{1,128}$' then return false; end if;
  elsif k='buildSha' then
   if v<>'null'::jsonb and (jsonb_typeof(v) is distinct from 'string' or v#>>'{}' !~ '^[a-fA-F0-9]{40}$') then return false; end if;
  elsif k=any(array['sentenceIndex','pageIndex']) then
   if jsonb_typeof(v) is distinct from 'number' then return false; end if;
   n=(v#>>'{}')::numeric; if n<0 or n>1000000 or trunc(n)<>n then return false; end if;
  elsif k=any(array['startedAt','endedAt','lastKnownAt','previousLastKnownAt','at','gameTimeMs','gameTimeStartedMs','gameTimeEndedMs']) then
   if v='null'::jsonb and k=any(array['previousLastKnownAt','gameTimeMs','gameTimeStartedMs','gameTimeEndedMs']) then continue; end if;
   if jsonb_typeof(v) is distinct from 'number' then return false; end if;
   n=(v#>>'{}')::numeric; if n<0 or n>8640000000000000 then return false; end if;
  elsif k=any(array['durationMs','foregroundMs','sceneForegroundMs','sceneEngagedMs','elapsedMs','engagedMs','idleMs','movementMs','readingMs','phoneMs','orderNumber','queueAheadAtOrder']) then
   if jsonb_typeof(v) is distinct from 'number' then return false; end if;
   n=(v#>>'{}')::numeric; if n<0 or n>31536000000 then return false; end if;
  elsif k=any(array['possibleAfk','partial','persisted','endConfirmed','internalTest']) then
   if jsonb_typeof(v) is distinct from 'boolean' then return false; end if;
   if k='endConfirmed' and v<>'false'::jsonb then return false; end if;
  elsif k='status' then
   if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('foreground','background','end-unconfirmed') then return false; end if;
  elsif k='reason' then
   if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('opened','document-resumed','visibility','checkpoint','page-leaving-signal','page-restored','online','offline','input','movement','location-change','page-leaving','document-interrupted','runtime-stop') then return false; end if;
  elsif k='release' then
   if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>32 or v#>>'{}' !~ '^[0-9]+[.][0-9]+[.][0-9]+$' then return false; end if;
  elsif k='environment' then
   if jsonb_typeof(v) is distinct from 'string' or v#>>'{}' not in ('production','staging','preview','development') then return false; end if;
  elsif k='historyProtocol' then
   if v is distinct from '2'::jsonb then return false; end if;
  elsif k=any(array['intent','languageSource','storeType','drink','sugar','ice','stage']) then
   if jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>64 then return false; end if;
  end if;
 end loop;
 if d ?& array['startedAt','endedAt'] and (d->>'endedAt')::numeric<(d->>'startedAt')::numeric then return false; end if;
 return true;
end $$;
create function analytics_validation.unit(d jsonb, kind text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare allowed text[]; required text[]; k text;
begin
 if kind='progress' then
  allowed=array['lineId','sentenceIndex','pageIndex','at','gameTimeMs']; required=array['lineId','sentenceIndex'];
 elsif kind='active' then
  allowed=array['interactionId','objectId','objectKind','lastShown','lastConfirmed']; required=array['interactionId','objectId'];
 elsif kind='idle' then
  allowed=array['intervalId','startedAt','gameTimeStartedMs','sceneId','roomId','buildSha','internalTest','durationMs','possibleAfk']; required=array['intervalId','startedAt','durationMs','possibleAfk'];
 else return false;
 end if;
 if not analytics_validation.fields(d) or not(d ?& required) or d-allowed<>'{}'::jsonb then return false; end if;
 for k in select unnest(array['lastShown','lastConfirmed']) loop
  if d?k and not analytics_validation.unit(d->k,'progress') then return false; end if;
 end loop;
 if kind='idle' and (d->'possibleAfk') is distinct from to_jsonb((d->>'durationMs')::numeric>30000) then return false; end if;
 return true;
end $$;
create function analytics_validation.payload(d jsonb, event text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare v jsonb; k text; introduced text[]=array['webVisitId','documentId','buildSha','internalTest','gameTimeMs','historyProtocol','interactionId','startedAt','gameTimeStartedMs','gameTimeEndedMs','lastShown','lastConfirmed','intervalId','lastKnownAt','previousLastKnownAt','endConfirmed','persisted','durationMs','possibleAfk','currentNoOperation','activeInteractions','status','reason'];
 allowed text[]=array['release','environment','webVisitId','documentId','buildSha','internalTest','gameTimeMs','historyProtocol','interactionId','startedAt','endedAt','gameTimeStartedMs','gameTimeEndedMs','lastShown','lastConfirmed','intervalId','lastKnownAt','previousLastKnownAt','endConfirmed','persisted','durationMs','possibleAfk','currentNoOperation','activeInteractions','status','reason','foregroundMs','roomId','sceneId','contentId','partial','intent','shopId','languageSource','slotId','storeType','drink','sugar','ice','orderNumber','queueAheadAtOrder','stage','visitId','sceneForegroundMs','sceneEngagedMs','elapsedMs','engagedMs','idleMs','movementMs','readingMs','phoneMs'];
begin
 if jsonb_typeof(d) is distinct from 'object' then return false; end if;
 -- Existing rows with no newly introduced fields retain their exact prior contract.
 if not(d ?| introduced) and event not in ('web_visit_state','foreground_no_operation','interaction_started','gameplay_ended','business_completed') then return true; end if;
 if not analytics_validation.fields(d) or not(d ?& array['historyProtocol','webVisitId','documentId','buildSha','internalTest','gameTimeMs','release','environment']) or d-allowed<>'{}'::jsonb then return false; end if;
 if d->'historyProtocol' is distinct from '2'::jsonb then return false; end if;
 for k in select unnest(array['lastShown','lastConfirmed']) loop
  if d?k and not analytics_validation.unit(d->k,'progress') then return false; end if;
 end loop;
 if d?'activeInteractions' then
  if jsonb_typeof(d->'activeInteractions') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'activeInteractions')>8 then return false; end if;
  for v in select * from jsonb_array_elements(d->'activeInteractions') loop
   if not analytics_validation.unit(v,'active') then return false; end if;
  end loop;
 end if;
 if d?'currentNoOperation' and not analytics_validation.unit(d->'currentNoOperation','idle') then return false; end if;
 if event='web_visit_state' and not(d ?& array['status','reason','foregroundMs','startedAt','lastKnownAt','endConfirmed']) then return false; end if;
 if event='interaction_started' and not(d ?& array['interactionId','startedAt']) then return false; end if;
 if event='foreground_no_operation' then
  if not(d ?& array['intervalId','startedAt','endedAt','durationMs','possibleAfk']) then return false; end if;
  if (d->>'durationMs')::numeric<=0 or (d->>'durationMs')::numeric<>((d->>'endedAt')::numeric-(d->>'startedAt')::numeric)
   or (d->'possibleAfk') is distinct from to_jsonb((d->>'durationMs')::numeric>30000) then return false; end if;
 end if;
 return true;
end $$;
revoke all on schema analytics_validation from public;
grant usage on schema analytics_validation to anon,authenticated;
revoke all on function analytics_validation.fields(jsonb),analytics_validation.unit(jsonb,text),analytics_validation.payload(jsonb,text) from public;
grant execute on function analytics_validation.fields(jsonb),analytics_validation.unit(jsonb,text),analytics_validation.payload(jsonb,text) to anon,authenticated;
alter table public.analytics_events add constraint analytics_events_history_v2_check
 check (analytics_validation.payload(event_data,event_name));

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
 with cohort as materialized (
 select id,client_event_id,visitor_id,session_id,step_id,event_name,scene_id,object_id,object_kind,outcome,dwell_ms,position_x,position_y,occurred_at,sequence,event_data
 from public.analytics_events where event_data->>'release'=p_release and event_data->>'environment'=p_environment
 and (p_internal='all' or p_internal='internal' and event_data->'internalTest'='true'::jsonb
 or p_internal='external' and event_data->'internalTest'='false'::jsonb or p_internal='unknown' and not(event_data?'internalTest'))
 ), tagged as materialized (select * from cohort where occurred_at<p_to), filtered as materialized (
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
 count(*) filter(where event_name='center_object_interacted' and outcome='story-completed') as story_completions
 from tagged where occurred_at>=p_from group by 1
 ), idle_ranked as (
 -- A recovery checkpoint and later completion for the same interval are one interval.
 select visitor_id,event_data,
 row_number() over(partition by visitor_id,event_data->>'webVisitId',event_data->>'documentId',event_data->>'intervalId'
 order by (event_data->>'endedAt')::numeric desc,coalesce((event_data->>'partial')::boolean,false),occurred_at desc,id desc) as rank
 from cohort where event_name='foreground_no_operation' and event_data->'historyProtocol'='2'::jsonb
 ), idle_clipped as (
 select visitor_id,greatest((event_data->>'startedAt')::numeric,extract(epoch from p_from)*1000) as start_ms,
 least((event_data->>'endedAt')::numeric,extract(epoch from p_to)*1000) as end_ms
 from idle_ranked where rank=1
 ), idle_days as (
 select visitor_id,day,
 least(end_ms,extract(epoch from ((day+interval '1 day') at time zone 'UTC'))*1000)
 -greatest(start_ms,extract(epoch from (day at time zone 'UTC'))*1000) as overlap_ms
 from idle_clipped cross join lateral generate_series(
 date_trunc('day',to_timestamp((start_ms/1000)::double precision) at time zone 'UTC'),
 date_trunc('day',to_timestamp((end_ms/1000)::double precision) at time zone 'UTC'),interval '1 day') days(day)
 where end_ms>start_ms
 ), idle_daily as (
 select day,sum(overlap_ms) as no_operation_ms from idle_days where overlap_ms>0 group by day
 ), player_days as (
 select visitor_id,date_trunc('day',occurred_at at time zone 'UTC') as day from tagged where occurred_at>=p_from
 union select visitor_id,day from idle_days where overlap_ms>0
 ), player_counts as (
 select day,count(*) as players from player_days group by day
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
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',coalesce(daily.day,facts.day,idle_daily.day),'players',coalesce(player_counts.players,0),'foreground_ms',coalesce(daily.foreground_ms,0),'interactions',coalesce(facts.interactions,0),'story_completions',coalesce(facts.story_completions,0),'no_operation_ms',coalesce(idle_daily.no_operation_ms,0)) order by coalesce(daily.day,facts.day,idle_daily.day)),'[]'::jsonb) from daily full join facts using(day) full join idle_daily using(day) full join player_counts using(day)),
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

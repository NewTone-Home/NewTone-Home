-- Run on staging only. All synthetic rows/rollups are rolled back.
begin;
do $$
declare base uuid := gen_random_uuid(); visitor uuid := gen_random_uuid();
  sess uuid := gen_random_uuid(); report jsonb; history jsonb;
begin
  insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data)
  values (base,visitor,sess,1,'center_entry_completed','{"release":"99.0.0","environment":"development","intent":"create"}');
  begin
    insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data)
    values (base,visitor,sess,1,'center_entry_completed','{"release":"99.0.0","environment":"development","intent":"create"}');
    raise exception 'duplicate accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data)
    values (gen_random_uuid(),visitor,sess,2,'shop_order_submitted','{"release":"99.0.0","environment":"development","shopId":"commercial-cafe-slot","text":"must-not-collect"}');
    raise exception 'free text accepted';
  exception when check_violation then null; end;
  insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data,scene_id,step_id,occurred_at)
  values (gen_random_uuid(),visitor,sess,2,'session_checkpoint','{"release":"99.0.0","environment":"development","foregroundMs":100,"sceneForegroundMs":100,"sceneEngagedMs":100,"roomId":"cafe"}','commercial-street','visit-test',now()-interval '2 minutes'),
         (gen_random_uuid(),visitor,sess,3,'session_checkpoint','{"release":"99.0.0","environment":"development","foregroundMs":500,"sceneForegroundMs":500,"sceneEngagedMs":400,"roomId":"cafe"}','commercial-street','visit-test',now()),
         (gen_random_uuid(),visitor,sess,4,'landing_entry','{}',null,null,now());
  insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data,object_id,object_kind,dwell_ms,outcome)
  values(gen_random_uuid(),visitor,sess,5,'center_object_interacted','{"release":"99.0.0","environment":"development","contentId":"switch"}','switch','fixture',null,'completed');
  report := public.owner_release_analytics('99.0.0','development',now()-interval '1 minute',now()+interval '1 minute');
  if (report->'summary'->>'entered_sessions')::int <> 1 or (report->'summary'->>'foreground_ms')::int <> 400 or (report->'summary'->>'engaged_ms')::int <> 300
    or (report->'summary'->>'visitors')::int <> 0 then raise exception 'cohort/max checkpoint accounting failed'; end if;
  if jsonb_array_length(report->'interactions') <> 1 or report->'interactions'->0->>'dwell_ms' is not null then raise exception 'raw null duration lost'; end if;
  history := public.owner_player_history('99.0.0','development',now()-interval '1 minute',now()+interval '1 minute',visitor);
  if jsonb_array_length(history->'items') <> 3 then raise exception 'timeline filter or records missing'; end if;
  if history->'items'->0->>'event_name' <> 'center_entry_completed' or history->'items'->2->>'event_name' <> 'center_object_interacted'
    then raise exception 'timeline order incorrect'; end if;
  begin
    insert into public.analytics_events(client_event_id,visitor_id,session_id,sequence,event_name,event_data)
    values(gen_random_uuid(),visitor,sess,6,'center_object_interacted','{"release":"0.3.0","environment":"development","freeText":"must-not-collect"}');
    raise exception 'raw free text accepted';
  exception when check_violation then null;end;
  if has_function_privilege('anon','public.owner_release_analytics(text,text,timestamptz,timestamptz)','execute')
    then raise exception 'anonymous report exposed'; end if;
end $$;
set local role authenticated;
do $$ begin
  if (public.owner_release_analytics('99.0.0','development')->'summary'->>'entered_sessions')::int <> 0
    then raise exception 'non-owner read exposed'; end if;
  if jsonb_array_length(public.owner_player_history('99.0.0','development',now()-interval '1 minute',now()+interval '1 minute')->'items') <> 0 then raise exception 'history exposed'; end if;
end $$;
rollback;
select 'analytics release contracts passed, synthetic rows rolled back' as result;

-- Additive analytics only: no historical row rewrites, save changes, or read-policy widening.
-- Existing event vocabulary remains accepted, including already queued Reader events.
do $$
declare old_expression text;
begin
  select pg_get_expr(conbin, conrelid) into strict old_expression from pg_constraint
    where conrelid = 'public.analytics_events'::regclass and conname = 'analytics_events_event_name_check';
  alter table public.analytics_events drop constraint analytics_events_event_name_check;
  execute 'alter table public.analytics_events add constraint analytics_events_event_name_check check ((' || old_expression || ') or event_name in (''center_entry_action'',''center_entry_completed'',''shop_order_submitted'',''shop_order_ready'',''shop_order_collected'',''shop_item_consumed''))';
end $$;

alter table public.analytics_events add constraint analytics_events_release_context_check check (
  (not (event_data ? 'release') or (jsonb_typeof(event_data->'release') = 'string' and event_data->>'release' ~ '^[0-9]+[.][0-9]+[.][0-9]+$'))
  and (not (event_data ? 'environment') or (jsonb_typeof(event_data->'environment') = 'string' and event_data->>'environment' in ('production','staging','preview','development')))
);
alter table public.analytics_events add constraint analytics_events_v030_payload_check check (
  event_name not in ('center_entry_action','center_entry_completed','shop_order_submitted','shop_order_ready','shop_order_collected','shop_item_consumed')
  or coalesce((event_data ?& array['release','environment'] and (
    (event_name in ('center_entry_action','center_entry_completed') and event_data ? 'intent'
      and event_data->>'intent' in ('create','continue','replace','restart','recovered','expand','request-replace','cancel','collapse')
      and event_data - array['release','environment','intent'] = '{}'::jsonb)
    or (event_name in ('shop_order_submitted','shop_order_ready','shop_order_collected','shop_item_consumed') and event_data ? 'shopId'
      and event_data->>'shopId' in ('commercial-south-slot-5','commercial-north-slot-1','commercial-cafe-slot','yonghe-eatery')
      and event_data - array['release','environment','shopId'] = '{}'::jsonb)
  )),false)
);
create index analytics_events_release_environment_time_idx on public.analytics_events
  ((event_data->>'release'), (event_data->>'environment'), occurred_at)
  where event_data ? 'release';

create function public.owner_release_analytics(
  p_release text default '0.3.0', p_environment text default 'production',
  p_from timestamptz default now() - interval '7 days', p_to timestamptz default now()
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_release is null or p_release !~ '^[0-9]+[.][0-9]+[.][0-9]+$'
    or p_environment is null or p_environment not in ('production','staging','preview','development')
    or p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '31 days'
    then raise exception 'invalid analytics filter' using errcode = '22023'; end if;
  -- SECURITY INVOKER: existing owner SELECT RLS applies; no anon execution.
  with filtered as materialized (
    select event_name, event_data, session_id, visitor_id from public.analytics_events
    where event_data->>'release' = p_release and event_data->>'environment' = p_environment
      and occurred_at >= p_from and occurred_at < p_to
  ), checkpoints as (
    select session_id, max(case when jsonb_typeof(event_data->'foregroundMs') = 'number'
      then least(31536000000, greatest(0, (event_data->>'foregroundMs')::numeric)) else 0 end) as foreground_ms
    from filtered where event_name = 'session_checkpoint' group by session_id
  ), groups as (
    select event_name, coalesce(event_data->>'intent',event_data->>'shopId',event_data->>'stage','') as dimension,
      count(*) as events, count(distinct session_id) as sessions, count(distinct visitor_id) as visitors
    from filtered where event_name in ('landing_entry','center_entry_action','center_entry_completed',
      'shop_order_submitted','shop_order_ready','shop_order_collected','shop_item_consumed',
      'cafe_story_stage_reached','cafe_completed','commercial_question_completed','center_interaction_completed')
    group by event_name, coalesce(event_data->>'intent',event_data->>'shopId',event_data->>'stage','')
  ) select jsonb_build_object('release',p_release,'environment',p_environment,'from',p_from,'to',p_to,
    'summary',jsonb_build_object(
      'visitors',(select count(distinct visitor_id) from filtered where event_name = 'landing_entry'),
      'sessions',(select count(distinct session_id) from filtered where event_name = 'landing_entry'),
      'entered_sessions',(select count(distinct session_id) from filtered where event_name = 'center_entry_completed'),
      'foreground_ms',(select coalesce(sum(foreground_ms),0) from checkpoints)),
    'events',(select coalesce(jsonb_agg(to_jsonb(groups) order by event_name,dimension),'[]'::jsonb) from groups)
  ) into result;
  return result;
end $$;
revoke all on function public.owner_release_analytics(text,text,timestamptz,timestamptz) from public, anon;
grant execute on function public.owner_release_analytics(text,text,timestamptz,timestamptz) to authenticated;

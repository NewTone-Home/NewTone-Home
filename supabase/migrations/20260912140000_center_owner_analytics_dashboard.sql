-- Owner-only Center analytics read model.
-- Public clients can still write constrained events/feedback, but cannot read them.
create or replace function public.owner_center_analytics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner(auth.uid()) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from public.analytics_events where event_name like 'center_%'),
      'sessions', (select count(distinct session_id) from public.analytics_events where event_name like 'center_%'),
      'reached_ride_boundary', (select count(distinct session_id) from public.analytics_events where event_name = 'center_ride_ready'),
      'feedback_submissions', (select count(*) from public.center_feedback_submissions)
    ),
    'scenes', coalesce((
      select jsonb_agg(to_jsonb(scene_rows) order by scene_rows.scene_id)
      from (
        select
          scene_id,
          count(distinct visitor_id) as visitors,
          count(distinct session_id) as sessions,
          count(*) filter (where event_name = 'center_scene_entered') as entries,
          count(*) filter (where event_name = 'center_scene_exited') as exits,
          round(avg(dwell_ms) filter (where event_name = 'center_scene_exited') / 1000.0, 1) as average_seconds,
          round(max(dwell_ms) filter (where event_name = 'center_scene_exited') / 1000.0, 1) as longest_seconds
        from public.analytics_events
        where scene_id is not null and event_name in ('center_scene_entered', 'center_scene_exited')
        group by scene_id
      ) scene_rows
    ), '[]'::jsonb),
    'objects', coalesce((
      select jsonb_agg(to_jsonb(object_rows) order by object_rows.scene_id, object_rows.object_id)
      from (
        select
          scene_id,
          object_id,
          object_kind,
          count(*) as interactions,
          count(distinct visitor_id) as visitors,
          round(avg(dwell_ms) / 1000.0, 1) as average_seconds,
          round(max(dwell_ms) / 1000.0, 1) as longest_seconds
        from public.analytics_events
        where event_name = 'center_object_interacted' and scene_id is not null and object_id is not null
        group by scene_id, object_id, object_kind
      ) object_rows
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(to_jsonb(feedback_rows) order by feedback_rows.created_at desc)
      from (
        select
          source,
          experience_length,
          portrait_adaptation,
          continuation_interest,
          free_text,
          created_at
        from public.center_feedback_submissions
        order by created_at desc
        limit 100
      ) feedback_rows
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.owner_center_analytics() from public, anon, authenticated;
grant execute on function public.owner_center_analytics() to authenticated;

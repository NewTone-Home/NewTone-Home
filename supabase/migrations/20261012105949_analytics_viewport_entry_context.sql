alter table public.analytics_events
  add column device_category text not null default 'unknown',
  add column viewport_width integer,
  add column viewport_height integer;

alter table public.analytics_events
  add constraint analytics_events_device_category_check
  check (device_category in ('phone', 'tablet', 'computer', 'unknown')),
  add constraint analytics_events_viewport_pair_check
  check ((viewport_width is null and viewport_height is null) or
    (viewport_width is not null and viewport_height is not null and
     viewport_width between 1 and 10000 and viewport_height between 1 and 10000));

grant insert (device_category, viewport_width, viewport_height)
  on table public.analytics_events to anon, authenticated;

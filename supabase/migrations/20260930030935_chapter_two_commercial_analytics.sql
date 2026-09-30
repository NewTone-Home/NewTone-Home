-- Chapter Two adds only enumerated gameplay facts. Free text remains outside
-- analytics_events, and this migration is intentionally repo-local until an
-- authorized non-production database applies it.
alter table public.analytics_events
  add column if not exists event_data jsonb not null default '{}'::jsonb;

alter table public.analytics_events
  drop constraint if exists analytics_events_event_data_object_check;
alter table public.analytics_events
  add constraint analytics_events_event_data_object_check
  check (jsonb_typeof(event_data) = 'object');

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
    'center_door_crossed', 'center_phone_opened', 'center_ride_ready',
    'center_feedback_prompt_shown', 'center_feedback_opened', 'center_feedback_submitted',
    'commercial_street_entered', 'commercial_question_triggered', 'commercial_question_completed',
    'commercial_storefront_interacted', 'milk_tea_app_unlocked', 'milk_tea_order_started',
    'milk_tea_order_confirmed', 'milk_tea_order_ready', 'milk_tea_order_picked_up',
    'cafe_storefront_revealed', 'cafe_entered', 'cafe_story_stage_reached',
    'cafe_coffee_ordered', 'cafe_ready_to_leave', 'cafe_completed', 'cafe_banknote_presented'
  ));

grant insert (event_data) on public.analytics_events to anon, authenticated;

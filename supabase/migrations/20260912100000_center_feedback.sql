-- Center feedback is write-only from the public client. Read access remains closed.
create table if not exists public.center_feedback_submissions (
  id bigint generated always as identity primary key,
  client_submission_id uuid not null unique,
  visitor_id uuid not null,
  session_id uuid not null,
  source text not null check (source in ('exit-prompt', 'phone')),
  experience_length text check (experience_length is null or experience_length in ('too-short', 'okay', 'cannot-understand')),
  portrait_adaptation text check (portrait_adaptation is null or portrait_adaptation in ('yes', 'no')),
  continuation_interest text check (continuation_interest is null or continuation_interest in ('yes', 'no-interest')),
  free_text text check (free_text is null or length(free_text) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.center_feedback_submissions enable row level security;

revoke all on table public.center_feedback_submissions from anon, authenticated;
grant insert (
  client_submission_id,
  visitor_id,
  session_id,
  source,
  experience_length,
  portrait_adaptation,
  continuation_interest,
  free_text
) on table public.center_feedback_submissions to anon, authenticated;
grant usage, select on sequence public.center_feedback_submissions_id_seq to anon, authenticated;

drop policy if exists center_feedback_constrained_insert on public.center_feedback_submissions;
create policy center_feedback_constrained_insert
  on public.center_feedback_submissions
  for insert
  to anon, authenticated
  with check (
    created_at >= now() - interval '1 minute'
    and created_at <= now() + interval '1 minute'
  );

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_entry', 'reader_entry_requested', 'language_selected', 'mode_selected', 'reading_started',
  'page_entered', 'chapter_entered', 'beat_reached', 'beat_dwell', 'progress_milestone',
  'chapter_completed', 'reader_return', 'reader_exit', 'visibility_dwell', 'session_end', 'content_status',
  'entry_step_shown', 'entry_step_dwell', 'entry_blocked', 'reader_checkpoint',
  'admin_login', 'admin_draft_saved', 'admin_published',
  'center_entry_requested', 'center_scene_entered', 'center_scene_exited',
  'center_object_interacted', 'center_door_attempted', 'center_door_blocked',
  'center_door_crossed', 'center_phone_opened', 'center_ride_ready',
  'center_feedback_prompt_shown', 'center_feedback_opened', 'center_feedback_submitted'
));

-- The automatic questionnaire is shown only after the current playable segment completes.
-- Keep the legacy source accepted for historical rows; new clients write completion-prompt.
alter table public.center_feedback_submissions
  drop constraint if exists center_feedback_submissions_source_check;

alter table public.center_feedback_submissions
  add constraint center_feedback_submissions_source_check
  check (source in ('completion-prompt', 'exit-prompt', 'phone'));

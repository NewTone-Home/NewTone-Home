# Owner admin and analytics runbook

## One-time owner setup

1. In Supabase Authentication, invite or create the owner's real email. The app does not guess or hard-code it.
2. After that user exists, run this once in the Supabase SQL Editor, replacing the marker with the same email:

```sql
insert into private.owner_allowlist (user_id)
select id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE')
on conflict (user_id) do nothing;
```

3. Add `https://YOUR_PRODUCTION_DOMAIN/admin` and the preview equivalent to the Supabase Auth redirect allow-list. Set the production Site URL to the production domain.
4. Visit `/admin`, request a magic link, and use the same browser to finish sign-in. Public readers do not sign in.

The `/admin` path is not linked from Landing or Reader. Authentication alone is insufficient: all draft and publish operations also require the database allow-list and RLS. Never put a service-role key in Vite or Vercel.

## Content gate

The database intentionally starts with zero publication rows and zero draft rows. The public site shows a clear unpublished state. Production must not be merged/deployed as the formal launch until the owner authors and explicitly publishes the approved new body content.

## Analytics event dictionary

| Event | Meaning | Optional fields |
| --- | --- | --- |
| `landing_entry` | Public shell/Landing entered | `step_id` |
| `reader_entry_requested` | User committed to entering Reader from Landing | `step_id=entry:start/continue`, `language`, `reading_mode` |
| `entry_step_shown` | One entry step became visible | `step_id=entry:landing-transition/language/mode/reader-handoff`, `language`, `reading_mode` |
| `entry_step_dwell` | Visible foreground time accumulated until an entry step was left or the page was closed | same `step_id`, `dwell_ms`, `exit_reason=completed/abandoned/unload` |
| `entry_blocked` | A repeat entry request arrived while that entry step or a global transition was already busy | matching entry step, or entry:global-transition; this is an explicit UI block, not a silent exit |
| `language_selected` | Reader language chosen or changed | `step_id`, `language` |
| `mode_selected` | Reading mode chosen or changed | `step_id`, `reading_mode` |
| `content_status` | Published content load resolved | `step_id=content:<status>[:vN]` |
| `reading_started` | Reader mounted | `step_id`, `language`, `reading_mode` |
| `page_entered` | Reader entered/re-entered a page | `step_id=page:<page_id>`, `progress_ratio` |
| `chapter_entered` | Reader entered/re-entered a chapter | `step_id=chapter:<chapter_id>`, `progress_ratio` |
| `beat_reached` | A Reader beat was reached | `step_id`, `progress_ratio` |
| `beat_dwell` | Visible time accumulated on a beat before focus changes | `step_id`, `progress_ratio`, `dwell_ms` |
| `reader_checkpoint` | Low-frequency Reader position confirmation: every 60 visible seconds, and when the tab/page leaves | `step_id`, `progress_ratio`, `dwell_ms`, optional `exit_reason=hidden/unload` |
| `progress_milestone` | First reach of 25/50/75/100% in a session | `step_id`, `progress_ratio` |
| `chapter_completed` | User completed the current released chapter/trial boundary | `step_id=chapter:<chapter_id>`, `progress_ratio` |
| `reader_return` | Reader return control used | `step_id`, `progress_ratio`, `exit_reason=return` |
| `reader_exit` | Reader exited through another app path | `progress_ratio`, `exit_reason` |
| `visibility_dwell` | One visible foreground segment ended | `dwell_ms`, `exit_reason=hidden` |
| `session_end` | `pagehide`/unload best-effort end with cumulative visible dwell | `dwell_ms`, `exit_reason=unload` |
| `admin_login` | Authorized owner session confirmed | none |
| `admin_draft_saved` | Owner draft saved | `step_id` |
| `admin_published` | Owner published a version | `step_id` |

Client identifiers are random UUIDs in local/session storage. No cookies, email, IP column, user agent, URL query, arbitrary metadata, or manuscript text is sent. Analytics failure never blocks the product. Product reporting should use distinct `session_id`/`visitor_id` for people/session counts; raw event counts are interaction volume and may include revisits.

## Owner aggregate queries

Run these in the Supabase SQL Editor (database-owner context). No unauthenticated raw-event or analytics UI is exposed.

```sql
select * from private.analytics_daily_summary order by day desc limit 90;
select * from private.analytics_funnel order by event_name, step_id;
select * from private.analytics_session_summary order by started_at desc limit 100;
select * from private.analytics_step_dwell order by average_seconds desc, sessions desc;
select * from private.analytics_entry_friction order by sessions_without_completion desc, p90_seconds desc;
select * from private.analytics_reader_last_position order by confirmed_at desc limit 100;
```

Useful funnel slices:

```sql
select event_name, count(distinct session_id) as sessions
from public.analytics_events
where event_name in (
  'landing_entry', 'reader_entry_requested', 'language_selected',
  'mode_selected', 'reading_started', 'chapter_completed'
)
group by event_name;

select step_id, count(distinct session_id) as sessions
from public.analytics_events
where event_name in ('page_entered', 'chapter_entered', 'beat_reached')
group by step_id
order by sessions desc, step_id;
```

How to read the two new aggregates:

- `analytics_entry_friction` shows which entrance step took longest, how often it was completed, and how often a user tried again while the interface was busy. A session without completion means only that the next step was not observed; it is not proof that the user disliked the step.
- `analytics_reader_last_position` gives the last Reader position confirmed by normal progress, an explicit return, or a low-frequency checkpoint. It supports a “where did the reading stop?” review without storing manuscript text.

Raw events are intended for 90-day retention. Until a reviewed scheduled job is approved, run this owner-only maintenance query monthly:

```sql
delete from public.analytics_events where received_at < now() - interval '90 days';
```

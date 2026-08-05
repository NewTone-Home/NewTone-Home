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
| `language_selected` | Reader language chosen | `language` |
| `mode_selected` | Reading mode chosen | `reading_mode` |
| `reading_started` | Reader mounted | `step_id` |
| `beat_reached` | A Reader beat was reached | `step_id`, `progress_ratio` |
| `progress_milestone` | First reach of 25/50/75/100% in a session | `step_id`, `progress_ratio` |
| `reader_return` | Reader return control used | `exit_reason=return` |
| `reader_exit` | Reader exited through another app path | `exit_reason` |
| `visibility_dwell` | Page became hidden/visible, best effort | `dwell_ms`, `exit_reason=hidden` |
| `session_end` | `pagehide`/unload best-effort end | `dwell_ms`, `exit_reason=unload` |
| `admin_login` | Authorized owner session confirmed | none |
| `admin_draft_saved` | Owner draft saved | `step_id` |
| `admin_published` | Owner published a version | `step_id` |

Client identifiers are random UUIDs in local/session storage. No cookies, email, IP column, user agent, URL query, arbitrary metadata, or manuscript text is sent. Analytics failure never blocks the product.

## Owner aggregate queries

Run these in the Supabase SQL Editor (database-owner context). No unauthenticated raw-event or analytics UI is exposed.

```sql
select * from private.analytics_daily_summary order by day desc limit 90;
select * from private.analytics_funnel order by event_name, step_id;
select * from private.analytics_session_summary order by started_at desc limit 100;
```

Raw events are intended for 90-day retention. Until a reviewed scheduled job is approved, run this owner-only maintenance query monthly:

```sql
delete from public.analytics_events where received_at < now() - interval '90 days';
```

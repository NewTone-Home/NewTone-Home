create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists private.owner_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.owner_allowlist from public, anon, authenticated;

create or replace function private.is_owner(candidate uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate is not null and exists (
    select 1 from private.owner_allowlist where user_id = candidate
  );
$$;
revoke all on function private.is_owner(uuid) from public, anon;
grant execute on function private.is_owner(uuid) to authenticated;

create or replace function public.owner_admin_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_owner(auth.uid()); $$;
revoke all on function public.owner_admin_status() from public, anon;
grant execute on function public.owner_admin_status() to authenticated;

create table if not exists public.reader_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  version integer not null check (version > 0),
  status text not null check (status in ('published', 'retired')),
  content jsonb not null check (jsonb_typeof(content) = 'array' and jsonb_array_length(content) > 0),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (slug, version)
);
create unique index if not exists reader_publications_one_live_slug
  on public.reader_publications (slug) where status = 'published';
alter table public.reader_publications enable row level security;
revoke all on public.reader_publications from public, anon, authenticated;
grant select (id, slug, version, status, content, content_sha256, published_at) on public.reader_publications to anon, authenticated;

create policy reader_publications_public_read
  on public.reader_publications for select
  to anon, authenticated
  using (status = 'published');
create policy reader_publications_owner_read
  on public.reader_publications for select
  to authenticated
  using ((select private.is_owner(auth.uid())));

create table if not exists public.reader_drafts (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace jsonb not null default '{"schemaVersion":1,"chapters":[]}'::jsonb,
  base_publication_id uuid references public.reader_publications(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, owner_id),
  check (jsonb_typeof(workspace) = 'object')
);
alter table public.reader_drafts enable row level security;
revoke all on public.reader_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.reader_drafts to authenticated;

create policy reader_drafts_owner_select on public.reader_drafts for select to authenticated
  using (owner_id = auth.uid() and (select private.is_owner(auth.uid())));
create policy reader_drafts_owner_insert on public.reader_drafts for insert to authenticated
  with check (owner_id = auth.uid() and (select private.is_owner(auth.uid())));
create policy reader_drafts_owner_update on public.reader_drafts for update to authenticated
  using (owner_id = auth.uid() and (select private.is_owner(auth.uid())))
  with check (owner_id = auth.uid() and (select private.is_owner(auth.uid())));
create policy reader_drafts_owner_delete on public.reader_drafts for delete to authenticated
  using (owner_id = auth.uid() and (select private.is_owner(auth.uid())));

create or replace function public.publish_reader_draft(
  draft_id uuid,
  compiled_content jsonb,
  compiled_sha256 text default null
)
returns public.reader_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.reader_drafts%rowtype;
  next_version integer;
  publication public.reader_publications%rowtype;
begin
  if not private.is_owner(auth.uid()) then raise exception 'owner authorization required' using errcode = '42501'; end if;
  if jsonb_typeof(compiled_content) <> 'array' or jsonb_array_length(compiled_content) = 0 then
    raise exception 'compiled content must be a non-empty Reader publication' using errcode = '22023';
  end if;
  if compiled_sha256 is not null and compiled_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid content digest' using errcode = '22023';
  end if;
  select * into draft from public.reader_drafts
    where id = draft_id and owner_id = auth.uid() for update;
  if not found then raise exception 'draft not found' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('reader-publication:' || draft.slug));
  select coalesce(max(version), 0) + 1 into next_version
    from public.reader_publications where slug = draft.slug;
  update public.reader_publications set status = 'retired'
    where slug = draft.slug and status = 'published';
  insert into public.reader_publications (slug, version, status, content, content_sha256, published_by)
    values (draft.slug, next_version, 'published', compiled_content, compiled_sha256, auth.uid())
    returning * into publication;
  update public.reader_drafts set base_publication_id = publication.id, updated_at = now()
    where id = draft.id;
  return publication;
end;
$$;
revoke all on function public.publish_reader_draft(uuid, jsonb, text) from public, anon;
grant execute on function public.publish_reader_draft(uuid, jsonb, text) to authenticated;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique,
  visitor_id uuid not null,
  session_id uuid not null,
  sequence integer not null check (sequence between 1 and 10000),
  event_name text not null check (event_name in (
    'landing_entry', 'language_selected', 'mode_selected', 'reading_started',
    'beat_reached', 'progress_milestone', 'reader_return', 'reader_exit',
    'visibility_dwell', 'session_end', 'admin_login', 'admin_draft_saved', 'admin_published'
  )),
  step_id text check (step_id is null or (length(step_id) between 1 and 96 and step_id ~ '^[A-Za-z0-9:_-]+$')),
  language text check (language is null or language in ('zh', 'en')),
  reading_mode text check (reading_mode is null or reading_mode in ('immersive', 'standard')),
  progress_ratio numeric(6,5) check (progress_ratio is null or progress_ratio between 0 and 1),
  dwell_ms integer check (dwell_ms is null or dwell_ms between 0 and 86400000),
  exit_reason text check (exit_reason is null or exit_reason in ('return', 'landing', 'hidden', 'unload', 'completed', 'abandoned')),
  received_at timestamptz not null default now()
);
create index if not exists analytics_events_session_received_idx on public.analytics_events (session_id, received_at);
create index if not exists analytics_events_received_name_idx on public.analytics_events (received_at, event_name);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
grant insert (client_event_id, visitor_id, session_id, sequence, event_name, step_id, language, reading_mode, progress_ratio, dwell_ms, exit_reason)
  on public.analytics_events to anon, authenticated;
grant usage on sequence public.analytics_events_id_seq to anon, authenticated;
create policy analytics_events_constrained_insert on public.analytics_events for insert to anon, authenticated
  with check (received_at >= now() - interval '1 minute' and received_at <= now() + interval '1 minute');

create or replace view private.analytics_session_summary with (security_invoker = true) as
select
  session_id,
  (array_agg(visitor_id order by received_at))[1] as visitor_id,
  min(received_at) as started_at,
  max(received_at) as last_event_at,
  coalesce(max(dwell_ms), extract(epoch from (max(received_at) - min(received_at)))::integer * 1000) as dwell_ms,
  max(progress_ratio) as farthest_progress,
  (array_agg(step_id order by received_at desc) filter (where step_id is not null))[1] as last_step,
  bool_or(event_name = 'reading_started') as started_reading,
  bool_or(event_name in ('reader_return', 'reader_exit', 'session_end')) as ended_explicitly
from public.analytics_events
group by session_id;

create or replace view private.analytics_daily_summary with (security_invoker = true) as
select
  started_at::date as day,
  count(*) as sessions,
  count(distinct visitor_id) as visitors,
  count(*) filter (where started_reading) as reading_starts,
  count(*) filter (where started_reading and not ended_explicitly) as inferred_abandons,
  round(avg(dwell_ms) / 1000.0, 1) as average_seconds,
  round(avg(farthest_progress) * 100, 1) as average_farthest_percent,
  round(max(farthest_progress) * 100, 1) as max_farthest_percent
from private.analytics_session_summary
group by started_at::date;

create or replace view private.analytics_funnel with (security_invoker = true) as
select event_name, step_id, count(*) as events, count(distinct session_id) as sessions
from public.analytics_events
group by event_name, step_id;

revoke all on private.analytics_session_summary from public, anon, authenticated;
revoke all on private.analytics_daily_summary from public, anon, authenticated;
revoke all on private.analytics_funnel from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

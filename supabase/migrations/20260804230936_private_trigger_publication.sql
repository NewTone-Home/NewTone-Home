drop function if exists public.owner_admin_status();
drop function if exists public.publish_reader_draft(uuid, jsonb, text);

alter table public.reader_drafts
  add column if not exists publish_content jsonb,
  add column if not exists publish_sha256 text,
  add column if not exists published_version integer;

alter table public.reader_drafts
  drop constraint if exists reader_drafts_publish_content_check,
  add constraint reader_drafts_publish_content_check check (
    publish_content is null or (jsonb_typeof(publish_content) = 'array' and jsonb_array_length(publish_content) > 0)
  ),
  drop constraint if exists reader_drafts_publish_sha256_check,
  add constraint reader_drafts_publish_sha256_check check (
    publish_sha256 is null or publish_sha256 ~ '^[a-f0-9]{64}$'
  );

revoke update on public.reader_drafts from authenticated;
grant update (workspace, publish_content, publish_sha256, updated_at) on public.reader_drafts to authenticated;

create or replace function private.publish_reader_draft_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_version integer;
  publication_id uuid;
begin
  if new.publish_content is null then return new; end if;
  if new.owner_id <> auth.uid() or not private.is_owner(auth.uid()) then
    raise exception 'owner authorization required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('reader-publication:' || new.slug));
  select coalesce(max(version), 0) + 1 into next_version
    from public.reader_publications where slug = new.slug;
  update public.reader_publications set status = 'retired'
    where slug = new.slug and status = 'published';
  insert into public.reader_publications (slug, version, status, content, content_sha256, published_by)
    values (new.slug, next_version, 'published', new.publish_content, new.publish_sha256, auth.uid())
    returning id into publication_id;
  new.base_publication_id := publication_id;
  new.published_version := next_version;
  new.publish_content := null;
  new.publish_sha256 := null;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.publish_reader_draft_trigger() from public, anon, authenticated;

drop trigger if exists reader_drafts_publish on public.reader_drafts;
create trigger reader_drafts_publish
  before update of publish_content on public.reader_drafts
  for each row
  when (new.publish_content is not null)
  execute function private.publish_reader_draft_trigger();

-- Canonical content is now Story -> Chapter / Release -> Scene -> language text.
-- Legacy compiled Reader arrays remain readable during the transition.

create or replace function private.is_scene_publication(value jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  required_language text;
  required_languages text[] := ARRAY['zh', 'en', 'ja', 'ko', 'fr'];
  chapter jsonb;
  scene jsonb;
  chapter_id text;
  scene_id text;
  chapter_ids text[] := '{}';
  scene_ids text[] := '{}';
  chapter_index integer := 0;
  scene_index integer;
begin
  if jsonb_typeof(value) <> 'object' or value->>'schemaVersion' <> '2' then return false; end if;
  if nullif(btrim(value->>'storyId'), '') is null then return false; end if;
  if jsonb_typeof(value->'languages') <> 'array' or value->'languages' <> '["zh","en","ja","ko","fr"]'::jsonb then return false; end if;
  if jsonb_typeof(value->'chapters') <> 'array' or jsonb_array_length(value->'chapters') = 0 then return false; end if;

  for chapter in select item from jsonb_array_elements(value->'chapters') as item loop
    chapter_index := chapter_index + 1;
    chapter_id := nullif(btrim(chapter->>'id'), '');
    if chapter_id is null or chapter_id !~ '^[A-Za-z0-9_]+$' or chapter_id = any(chapter_ids) then return false; end if;
    if chapter->>'order' is null or (chapter->>'order')::integer <> chapter_index then return false; end if;
    if nullif(btrim(chapter->'title'->>'zh'), '') is null then return false; end if;
    if jsonb_typeof(chapter->'scenes') <> 'array' or jsonb_array_length(chapter->'scenes') = 0 then return false; end if;
    chapter_ids := array_append(chapter_ids, chapter_id);

    scene_index := 0;
    for scene in select item from jsonb_array_elements(chapter->'scenes') as item loop
      scene_index := scene_index + 1;
      scene_id := nullif(btrim(scene->>'id'), '');
      if scene_id is null or scene_id !~ '^[A-Za-z0-9_]+_scene_[0-9]{2,}$' or scene_id = any(scene_ids) then return false; end if;
      if scene->>'order' is null or (scene->>'order')::integer <> scene_index then return false; end if;
      if jsonb_typeof(scene->'content') <> 'object' or nullif(btrim(scene->'content'->>'zh'), '') is null then return false; end if;
      foreach required_language in array required_languages loop
        if nullif(btrim(scene->'content'->>required_language), '') is null then return false; end if;
      end loop;
      scene_ids := array_append(scene_ids, scene_id);
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_scene_publication(jsonb) from public, anon, authenticated;

alter table public.reader_publications
  drop constraint if exists reader_publications_content_check,
  add constraint reader_publications_content_check check (
    (jsonb_typeof(content) = 'array' and jsonb_array_length(content) > 0)
    or private.is_scene_publication(content)
  );

alter table public.reader_drafts
  drop constraint if exists reader_drafts_workspace_schema_check,
  add constraint reader_drafts_workspace_schema_check check (
    jsonb_typeof(workspace) = 'object'
    and (workspace->>'schemaVersion') in ('1', '2')
  ),
  drop constraint if exists reader_drafts_publish_content_check,
  add constraint reader_drafts_publish_content_check check (
    publish_content is null
    or (jsonb_typeof(publish_content) = 'array' and jsonb_array_length(publish_content) > 0)
    or private.is_scene_publication(publish_content)
  );

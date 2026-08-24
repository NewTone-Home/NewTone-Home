-- Scene v3 keeps authored environmental context and event markers with the shared multilingual body.
-- Reader-only Beat/Block output remains derived by the compatibility adapter.

create or replace function private.is_scene_publication(value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  required_language text;
  required_languages text[] := ARRAY['zh', 'en', 'ja', 'ko', 'fr'];
  allowed_world_layers text[] := ARRAY['surface', 'inner', 'transition', 'unknown'];
  chapter jsonb;
  scene jsonb;
  event_id jsonb;
  schema_version text;
  chapter_id text;
  scene_id text;
  chapter_ids text[] := '{}';
  scene_ids text[] := '{}';
  chapter_index integer := 0;
  scene_index integer;
begin
  if jsonb_typeof(value) <> 'object' then return false; end if;
  schema_version := value->>'schemaVersion';
  if schema_version not in ('2', '3') then return false; end if;
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

      if schema_version = '3' then
        if jsonb_typeof(scene->'context') <> 'object' then return false; end if;
        if (scene->'context'->>'worldLayer') is null or not (scene->'context'->>'worldLayer' = any(allowed_world_layers)) then return false; end if;
        if jsonb_typeof(scene->'context'->'locationLabels') <> 'object' then return false; end if;
        if jsonb_typeof(scene->'context'->'locationId') <> 'string' then return false; end if;
        if nullif(btrim(scene->'context'->>'time'), '') is null or nullif(btrim(scene->'context'->>'weather'), '') is null then return false; end if;
        if jsonb_typeof(scene->'context'->'eventIds') <> 'array' then return false; end if;
        for event_id in select item from jsonb_array_elements(scene->'context'->'eventIds') as item loop
          if jsonb_typeof(event_id) <> 'string' or nullif(btrim(event_id #>> '{}'), '') is null then return false; end if;
        end loop;
      end if;
      scene_ids := array_append(scene_ids, scene_id);
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_scene_publication(jsonb) from public, anon, authenticated;

alter table public.reader_drafts
  drop constraint if exists reader_drafts_workspace_schema_check,
  add constraint reader_drafts_workspace_schema_check check (
    jsonb_typeof(workspace) = 'object'
    and (workspace->>'schemaVersion') in ('1', '2', '3')
  );

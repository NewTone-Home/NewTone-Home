drop policy if exists reader_publications_owner_read on public.reader_publications;

drop policy if exists reader_drafts_owner_select on public.reader_drafts;
drop policy if exists reader_drafts_owner_insert on public.reader_drafts;
drop policy if exists reader_drafts_owner_update on public.reader_drafts;
drop policy if exists reader_drafts_owner_delete on public.reader_drafts;

create policy reader_drafts_owner_select on public.reader_drafts for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_owner((select auth.uid()))));
create policy reader_drafts_owner_insert on public.reader_drafts for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_owner((select auth.uid()))));
create policy reader_drafts_owner_update on public.reader_drafts for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_owner((select auth.uid()))))
  with check (owner_id = (select auth.uid()) and (select private.is_owner((select auth.uid()))));
create policy reader_drafts_owner_delete on public.reader_drafts for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_owner((select auth.uid()))));

create index if not exists reader_drafts_owner_id_idx on public.reader_drafts (owner_id);
create index if not exists reader_drafts_base_publication_id_idx on public.reader_drafts (base_publication_id);
create index if not exists reader_publications_published_by_idx on public.reader_publications (published_by);

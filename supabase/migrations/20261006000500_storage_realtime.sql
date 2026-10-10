-- ============================================================================
-- SOMS - Storage buckets, storage RLS policies and Realtime
-- Phase 1 migration 5/5.
--
-- All buckets are PRIVATE. Files are only reachable through signed URLs
-- created server-side. Path convention (enforced by app code + policies):
--
--   submissions   : {organization_id}/{module}/{record_id}/{filename}
--                   module = proposals | reports | audit | other
--   org-documents : {organization_id}/{category}/{document_id}/{filename}
--   org-logos     : {organization_id}/logo/{filename}
--
-- Limits (defense in depth - the server also validates type and size):
--   10 MB max, PDF / DOC / DOCX / XLS / XLSX / JPG / PNG
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submissions', 'submissions', false, 10485760, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'image/jpeg',
     'image/png'
   ]),
  ('org-documents', 'org-documents', false, 10485760, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'image/jpeg',
     'image/png'
   ]),
  ('org-logos', 'org-logos', false, 10485760, array[
     'image/jpeg',
     'image/png'
   ])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- storage.objects policies
-- Supabase's default: only `authenticated` may even attempt these (anon is
-- already stripped of storage privileges by the platform), and RLS narrows
-- it further to the caller's own organization.
-- ----------------------------------------------------------------------------

drop policy if exists soms_read_submissions on storage.objects;
create policy soms_read_submissions on storage.objects
  for select to authenticated
  using (
    bucket_id in ('submissions', 'org-documents')
    and public.can_access_org_path(split_part(name, '/', 1))
  );

drop policy if exists soms_write_submissions on storage.objects;
create policy soms_write_submissions on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('submissions', 'org-documents')
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  );

drop policy if exists soms_update_submissions on storage.objects;
create policy soms_update_submissions on storage.objects
  for update to authenticated
  using (
    bucket_id in ('submissions', 'org-documents')
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  )
  with check (
    bucket_id in ('submissions', 'org-documents')
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  );

drop policy if exists soms_delete_submissions on storage.objects;
create policy soms_delete_submissions on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('submissions', 'org-documents')
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  );

-- Logos are shown on dashboards and reports across the whole system, so any
-- signed-in user may READ them; writing stays limited to the owning org / OSA.
drop policy if exists soms_read_logos on storage.objects;
create policy soms_read_logos on storage.objects
  for select to authenticated
  using (bucket_id = 'org-logos');

drop policy if exists soms_write_logos on storage.objects;
create policy soms_write_logos on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  );

drop policy if exists soms_delete_logos on storage.objects;
create policy soms_delete_logos on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and (
      public.is_osa()
      or split_part(name, '/', 1) = public.get_my_org_id()::text
    )
  );

-- ----------------------------------------------------------------------------
-- Realtime: notifications are streamed to their owner. Realtime applies the
-- same SELECT policies, so a user only ever receives their own rows.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

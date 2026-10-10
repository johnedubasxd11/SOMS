-- ============================================================================
-- SOMS - Grants and Row Level Security
-- Phase 1 migration 3/5.
--
-- RULES
--  * Every table gets RLS enabled. No table is public.
--  * `anon` gets no table privileges at all (there is no anonymous data in SOMS).
--  * Authorization lives in the database: policies call the SECURITY DEFINER
--    helpers from 20261006000200_functions.sql.
--  * INSERT of review_logs / notifications happens only through those
--    SECURITY DEFINER functions, therefore no INSERT policy exists for clients.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Table privileges
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'colleges', 'school_years', 'organizations', 'profiles', 'advisers',
    'organization_officers', 'activity_proposals', 'accomplishment_reports',
    'audit_documents', 'other_documents', 'documents', 'review_logs',
    'notifications', 'hardcopy_records', 'requirements', 'audit_logs',
    'system_settings', 'rate_limits'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant usage on schema public to authenticated, service_role;
-- Identity columns (review_logs, audit_logs) need sequence usage.
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Reference / taxonomy tables
-- ----------------------------------------------------------------------------
alter table public.colleges enable row level security;
create policy colleges_select on public.colleges
  for select to authenticated using (true);
create policy colleges_write on public.colleges
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

alter table public.school_years enable row level security;
create policy school_years_select on public.school_years
  for select to authenticated using (true);
create policy school_years_write on public.school_years
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

alter table public.organizations enable row level security;
create policy organizations_select on public.organizations
  for select to authenticated using (true);
create policy organizations_write on public.organizations
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

alter table public.system_settings enable row level security;
create policy system_settings_select on public.system_settings
  for select to authenticated using (true);
create policy system_settings_write on public.system_settings
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- rate_limits: no policy on purpose -> only the SECURITY DEFINER
-- check_rate_limit() function (and the service role) can touch it.
alter table public.rate_limits enable row level security;

-- ----------------------------------------------------------------------------
-- 2. profiles
--    INSERT: none (signup trigger / service role only)
--    DELETE: none (OSA deactivates accounts instead)
--    UPDATE: own row, or OSA (role/org/e-mail changes are further guarded by
--            enforce_profile_guard())
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_osa()
    or (
      organization_id is not null
      and (
        organization_id = public.get_my_org_id()
        or public.is_adviser_of(organization_id)
      )
    )
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_update_osa on public.profiles
  for update to authenticated
  using (public.is_osa()) with check (public.is_osa());

-- ----------------------------------------------------------------------------
-- 3. advisers / organization_officers
-- ----------------------------------------------------------------------------
alter table public.advisers enable row level security;

create policy advisers_select on public.advisers
  for select to authenticated
  using (
    public.is_osa()
    or profile_id = auth.uid()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
  );

create policy advisers_write on public.advisers
  for all to authenticated
  using (public.is_osa()) with check (public.is_osa());

alter table public.organization_officers enable row level security;

create policy officers_select on public.organization_officers
  for select to authenticated
  using (
    public.is_osa()
    or profile_id = auth.uid()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
  );

create policy officers_write on public.organization_officers
  for all to authenticated
  using (public.is_osa()) with check (public.is_osa());

-- ----------------------------------------------------------------------------
-- 4. Submissions (proposals / reports / audit documents / other documents)
--    SELECT : own organization, own records, adviser of that org, OSA
--    INSERT : officers of their own organization (always as draft), OSA
--    UPDATE : officers editing draft|revision_requested, OSA.
--             Advisers get no UPDATE policy at all - they endorse/comment
--             through the SECURITY DEFINER RPCs.
--    DELETE : draft owner or OSA
--    Status changes are additionally blocked by guard_submission_change().
-- ----------------------------------------------------------------------------
alter table public.activity_proposals enable row level security;
alter table public.accomplishment_reports enable row level security;
alter table public.audit_documents enable row level security;
alter table public.other_documents enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'activity_proposals', 'accomplishment_reports', 'audit_documents', 'other_documents'
  ] loop
    execute format($p$
      create policy %1$I_select on public.%1$I
        for select to authenticated
        using (
          public.is_osa()
          or created_by = auth.uid()
          or organization_id = public.get_my_org_id()
          or public.is_adviser_of(organization_id)
        );

      create policy %1$I_insert on public.%1$I
        for insert to authenticated
        with check (
          created_by = auth.uid()
          and status = 'draft'
          and (
            organization_id = public.get_my_org_id()
            or public.is_osa()
          )
        );

      create policy %1$I_update on public.%1$I
        for update to authenticated
        using (
          public.is_osa()
          or (
            created_by = auth.uid()
            and organization_id = public.get_my_org_id()
            and status in ('draft', 'revision_requested')
          )
        )
        with check (
          public.is_osa()
          or (
            created_by = auth.uid()
            and organization_id = public.get_my_org_id()
            and status in ('draft', 'revision_requested')
          )
        );

      create policy %1$I_delete on public.%1$I
        for delete to authenticated
        using (
          public.is_osa()
          or (
            created_by = auth.uid()
            and organization_id = public.get_my_org_id()
            and status = 'draft'
          )
        );
    $p$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. documents (storage metadata, versioned)
-- ----------------------------------------------------------------------------
alter table public.documents enable row level security;

create policy documents_select on public.documents
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      organization_id = public.get_my_org_id()
      or public.is_osa()
    )
    and size_bytes <= 10485760
  );

-- Used when a new version marks the previous row is_active = false.
create policy documents_update on public.documents
  for update to authenticated
  using (
    public.is_osa()
    or (
      uploaded_by = auth.uid()
      and organization_id = public.get_my_org_id()
    )
  )
  with check (
    public.is_osa()
    or (
      uploaded_by = auth.uid()
      and organization_id = public.get_my_org_id()
    )
  );

create policy documents_delete on public.documents
  for delete to authenticated
  using (public.is_osa() or uploaded_by = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. review_logs - read only for the org / adviser / OSA
-- ----------------------------------------------------------------------------
alter table public.review_logs enable row level security;

create policy review_logs_select on public.review_logs
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or actor_id = auth.uid()
  );
-- no INSERT/UPDATE/DELETE policy: only transition_submission(),
-- add_review_comment() and mark_hardcopy_received() may write.

-- ----------------------------------------------------------------------------
-- 7. notifications - strictly personal
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 8. hardcopy_records - OSA writes, org/adviser/OSA read
-- ----------------------------------------------------------------------------
alter table public.hardcopy_records enable row level security;

create policy hardcopy_select on public.hardcopy_records
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
  );

create policy hardcopy_write on public.hardcopy_records
  for all to authenticated
  using (public.is_osa()) with check (public.is_osa());

-- ----------------------------------------------------------------------------
-- 9. requirements - OSA creates, the organization sees its own
-- ----------------------------------------------------------------------------
alter table public.requirements enable row level security;

create policy requirements_select on public.requirements
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
  );

create policy requirements_write on public.requirements
  for all to authenticated
  using (public.is_osa()) with check (public.is_osa());

-- ----------------------------------------------------------------------------
-- 10. audit_logs - readable by OSA and Super Admin only, never writable
-- ----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_osa());
-- no write policy: rows come from the log_audit() trigger only.

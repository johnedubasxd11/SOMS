-- ============================================================================
-- SOMS - Phase 8, migration 1/2: the Dean / Department Head role.
--
--  * new user_role value `dean` and a new review_action `step_approved`
--    (an intermediate approval inside a multi-step chain is not the final
--    `approved` decision and not an `endorsed` either).
--  * profiles.college_id - which college a dean / department head belongs to,
--  * SECURITY DEFINER helpers: is_dean_of(), is_dean_of_org(), can_view_org()
--  * RLS: deans can read the submissions, files, logs and officers of the
--    organizations under their college (they act at their chain step there).
--
-- NOTE ON ENUM VALUES: ALTER TYPE ... ADD VALUE is transactional-safe on
-- Postgres 12+, but the new value may not be *used* inside the same
-- transaction: `language plpgsql` bodies are parsed lazily (safe), while
-- `language sql` bodies and straight SQL are parsed immediately - there the
-- role is compared as text instead.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum values
-- ----------------------------------------------------------------------------
alter type public.user_role     add value if not exists 'dean';
alter type public.review_action add value if not exists 'step_approved';

-- ----------------------------------------------------------------------------
-- 2. profiles: the college of a dean / department head.
--    Like role / organization_id / is_active, it is a privileged field:
--    only OSA or a Super Admin may change it (enforce_profile_guard below).
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists college_id uuid references public.colleges (id) on delete set null;

create index if not exists profiles_college_idx on public.profiles (college_id);

create or replace function public.enforce_profile_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.role            is distinct from old.role)
  or (new.organization_id is distinct from old.organization_id)
  or (new.college_id      is distinct from old.college_id)
  or (new.is_active       is distinct from old.is_active)
  or (new.email           is distinct from old.email) then
    -- auth.uid() IS NULL means the service role (or a direct postgres
    -- session): RLS has already removed every client-side UPDATE path that
    -- could reach here without a uid, so it is allowed through.
    if auth.uid() is not null and not public.is_osa() then
      raise exception 'Only OSA or a Super Admin can change role, organization, college, e-mail or active flag'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Authorization helpers (SECURITY DEFINER - no RLS recursion)
-- ----------------------------------------------------------------------------

-- The college of the signed-in dean (null for everyone else).
create or replace function public.get_my_college_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select college_id from public.profiles where id = auth.uid() and is_active;
$$;

-- Strict dean check: role AND active AND that exact college. OSA does NOT
-- pass this - approval steps are checked strictly (see migration 2).
-- NOTE: compared as text because a `language sql` body is parsed at CREATE
-- time and the 'dean' enum value was added earlier in THIS transaction.
create or replace function public.is_dean_of(p_college_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    public.get_my_role()::text = 'dean'
    and p_college_id is not null
    and public.get_my_college_id() = p_college_id,
    false
  );
$$;

-- Same, but expressed against an organization (looks up its college).
create or replace function public.is_dean_of_org(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.organizations o
      where o.id = p_organization_id
        and public.is_dean_of(o.college_id)
    ),
    false
  );
$$;

-- "May this account see rows belonging to this organization?" -
-- the shared read scope used by the approval_records policy (and available
-- to future policies): OSA, a member of the org, its adviser, its dean.
create or replace function public.can_view_org(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    public.is_osa()
    or public.get_my_org_id() = p_organization_id
    or public.is_adviser_of(p_organization_id)
    or public.is_dean_of_org(p_organization_id),
    false
  );
$$;

revoke all on function public.get_my_college_id() from public, anon;
revoke all on function public.is_dean_of(uuid) from public, anon;
revoke all on function public.is_dean_of_org(uuid) from public, anon;
revoke all on function public.can_view_org(uuid) from public, anon;
grant execute on function public.get_my_college_id() to authenticated, service_role;
grant execute on function public.is_dean_of(uuid) to authenticated, service_role;
grant execute on function public.is_dean_of_org(uuid) to authenticated, service_role;
grant execute on function public.can_view_org(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RLS - deans read the rows of the organizations under their college.
--    Nothing here widens WRITE access: advisers and deans still act only
--    through the SECURITY DEFINER RPCs (transition_submission et al.).
-- ----------------------------------------------------------------------------

-- profiles: also visible for the officers/advisers of the dean's college
-- (the organization detail page and reviewer names resolve through it).
drop policy if exists profiles_select on public.profiles;
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
        or public.is_dean_of_org(organization_id)
      )
    )
  );

-- The four submission tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'activity_proposals', 'accomplishment_reports', 'audit_documents', 'other_documents'
  ] loop
    execute format($p$
      drop policy if exists %1$I_select on public.%1$I;
      create policy %1$I_select on public.%1$I
        for select to authenticated
        using (
          public.is_osa()
          or created_by = auth.uid()
          or organization_id = public.get_my_org_id()
          or public.is_adviser_of(organization_id)
          or public.is_dean_of_org(organization_id)
        );
    $p$, t);
  end loop;
end $$;

-- review_logs, documents, hardcopy_records, requirements, organization_officers:
-- the dean reads the same rows an adviser of that organization would.
drop policy if exists review_logs_select on public.review_logs;
create policy review_logs_select on public.review_logs
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or public.is_dean_of_org(organization_id)
    or actor_id = auth.uid()
  );

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or public.is_dean_of_org(organization_id)
  );

drop policy if exists hardcopy_select on public.hardcopy_records;
create policy hardcopy_select on public.hardcopy_records
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or public.is_dean_of_org(organization_id)
  );

drop policy if exists requirements_select on public.requirements;
create policy requirements_select on public.requirements
  for select to authenticated
  using (
    public.is_osa()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or public.is_dean_of_org(organization_id)
  );

drop policy if exists officers_select on public.organization_officers;
create policy officers_select on public.organization_officers
  for select to authenticated
  using (
    public.is_osa()
    or profile_id = auth.uid()
    or organization_id = public.get_my_org_id()
    or public.is_adviser_of(organization_id)
    or public.is_dean_of_org(organization_id)
  );

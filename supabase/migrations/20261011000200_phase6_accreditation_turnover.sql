-- ============================================================================
-- SOMS - Phase 6 (foundation features): accreditation checklist workflow,
-- officer-list turnover and school-year rollover.
--
-- Builds on the Phase 1 foundation tables (accreditation_items/-submissions,
-- officer_terms, school_years.is_archived) and adds what they were waiting on:
--
--   1. notification_type gains 'accreditation' and 'turnover'
--   2. officer_term_members - the actual name/position/email list that the
--      officers submit and OSA approves (officer_terms stays the header row)
--   3. notify_osa_staff()   - SECURITY DEFINER fan-out to every active OSA /
--      super-admin profile (the mirror of notify_org_officers for the other
--      direction: officers -> OSA)
--   4. guard_officer_term_change()      - status moves only draft <-> submitted
--      by the organization, submitted -> approved|draft by OSA; members are
--      frozen once the list leaves draft (RLS on members enforces the freeze)
--   5. guard_accreditation_submission() - only OSA approves/rejects; the
--      organization may replace a pending OR rejected upload (reset to pending)
--   6. enforce_archived_school_year()   - every school-year-scoped table
--      refuses INSERT/UPDATE/DELETE once its year is archived
--   7. accreditation_submissions_update policy widened: the organization can
--      re-upload after a rejection (status back to pending)
--
-- Service role / migrations / cron keep working: the guards skip when
-- auth.uid() is null (same contract as enforce_profile_guard).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Notification types
-- ----------------------------------------------------------------------------
alter type public.notification_type add value if not exists 'accreditation';
alter type public.notification_type add value if not exists 'turnover';

-- ----------------------------------------------------------------------------
-- 2. officer_term_members - the submitted list itself.
--    Free-text names on purpose: incoming officers may not have accounts yet.
--    OSA creates the accounts from the approved list (/admin/users).
-- ----------------------------------------------------------------------------
create table public.officer_term_members (
  id         uuid primary key default gen_random_uuid(),
  term_id    uuid not null references public.officer_terms (id) on delete cascade,
  full_name  text not null,
  position   text not null,
  email      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint officer_term_members_name check (length(btrim(full_name)) > 0),
  constraint officer_term_members_position check (length(btrim(position)) > 0),
  constraint officer_term_members_email check (email is null or position('@' in email) > 0)
);

comment on table public.officer_term_members is 'Officer names on one turnover list; frozen once the term leaves draft.';

create index officer_term_members_term_idx on public.officer_term_members (term_id, sort_order);

create trigger set_updated_at before update on public.officer_term_members
  for each row execute function public.set_updated_at();
create trigger audit_log after insert or update or delete on public.officer_term_members
  for each row execute function public.log_audit();

revoke all on public.officer_term_members from anon;
grant select, insert, update, delete on public.officer_term_members to authenticated;
grant all on public.officer_term_members to service_role;

alter table public.officer_term_members enable row level security;

-- Readable by anyone who may view the owning organization.
create policy officer_term_members_select on public.officer_term_members
  for select to authenticated
  using (
    exists (
      select 1 from public.officer_terms t
      where t.id = term_id and public.can_view_org(t.organization_id)
    )
  );

-- Written while the term is still a draft (own organization) or by OSA.
create policy officer_term_members_write on public.officer_term_members
  for all to authenticated
  using (
    public.is_osa()
    or exists (
      select 1 from public.officer_terms t
      where t.id = term_id
        and t.organization_id = public.get_my_org_id()
        and t.status = 'draft'
    )
  )
  with check (
    public.is_osa()
    or exists (
      select 1 from public.officer_terms t
      where t.id = term_id
        and t.organization_id = public.get_my_org_id()
        and t.status = 'draft'
    )
  );

-- ----------------------------------------------------------------------------
-- 3. notify_osa_staff() - officers (or anyone signed in) ping OSA.
--    The only sanctioned write path into notifications for this direction,
--    exactly like notify_announcement_recipients for bulletins.
-- ----------------------------------------------------------------------------
create or replace function public.notify_osa_staff(
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  if btrim(p_title) = '' then
    raise exception 'Notification title is required' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select u.id, p_type, p_title, nullif(btrim(coalesce(p_body, '')), ''), nullif(btrim(coalesce(p_link, '')), '')
  from public.profiles u
  where u.is_active and u.role in ('osa_admin', 'super_admin');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_osa_staff(public.notification_type, text, text, text)
  from public, anon;
grant execute on function public.notify_osa_staff(public.notification_type, text, text, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Officer term status guard.
--    Officers: draft -> submitted (send) and submitted -> draft (withdraw).
--    OSA:      submitted -> approved, or submitted/approved -> draft (send back).
--    Bookkeeping columns (submitted_by/at, reviewed_by/at) are set by the
--    server actions; this trigger only owns the status matrix.
-- ----------------------------------------------------------------------------
create or replace function public.guard_officer_term_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    -- auth.uid() IS NULL: service role, migrations or a direct postgres
    -- session - RLS has already removed every client path that reaches here
    -- without a uid.
    if auth.uid() is null then
      return new;
    end if;

    if public.is_osa() then
      if new.status not in ('draft', 'submitted', 'approved') then
        raise exception 'Invalid officer term status' using errcode = '22023';
      end if;
      if old.status = 'approved' and new.status = 'submitted' then
        raise exception 'An approved officer list cannot go back to submitted - send it back to draft first'
          using errcode = '42501';
      end if;
    else
      if not (
        (old.status = 'draft' and new.status = 'submitted')
        or (old.status = 'submitted' and new.status = 'draft')
      ) then
        raise exception 'Officers may only submit or withdraw their officer list - OSA approves it'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_officer_term_change on public.officer_terms;
create trigger guard_officer_term_change
  before update on public.officer_terms
  for each row execute function public.guard_officer_term_change();

-- ----------------------------------------------------------------------------
-- 5. Accreditation submission guard + widened org replace policy.
--    The organization may re-upload after a rejection (back to pending);
--    only OSA moves a row to approved / rejected.
-- ----------------------------------------------------------------------------
create or replace function public.guard_accreditation_submission()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.item_id is distinct from old.item_id then
    raise exception 'An accreditation upload cannot be moved to another item or organization'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_osa() then
    -- The only status move the organization may make: replace a rejected
    -- upload (or re-save a pending one) as pending again.
    if not (old.status in ('pending', 'rejected') and new.status = 'pending') then
      raise exception 'Only OSA can approve or reject an accreditation upload'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_accreditation_submission on public.accreditation_submissions;
create trigger guard_accreditation_submission
  before update on public.accreditation_submissions
  for each row execute function public.guard_accreditation_submission();

drop policy if exists accreditation_submissions_update on public.accreditation_submissions;
create policy accreditation_submissions_update on public.accreditation_submissions
  for update to authenticated
  using (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status in ('pending', 'rejected')
    )
  )
  with check (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status = 'pending'
    )
  );

-- The organization may withdraw its own pending/rejected upload; approved
-- rows stay OSA-only (delete cascade needs the row gone to clean storage).
drop policy if exists accreditation_submissions_delete on public.accreditation_submissions;
create policy accreditation_submissions_delete on public.accreditation_submissions
  for delete to authenticated
  using (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status in ('pending', 'rejected')
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Archived school years are read-only.
--    Attached to every school-year-scoped table plus accreditation_submissions
--    (which carries the year through its item). The school_years row itself
--    stays writable so super admin can archive / unarchive.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_archived_school_year()
returns trigger
language plpgsql
as $$
declare
  v_year uuid;
begin
  -- Service role, migrations, cron: allowed through (archival data fixes).
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'accreditation_submissions' then
    -- Reaches the year through its checklist item (no school_year_id column).
    select i.school_year_id into v_year
    from public.accreditation_items i
    where i.id = (case when tg_op = 'DELETE' then old.item_id else new.item_id end);
  elsif tg_op = 'INSERT' then
    v_year := new.school_year_id;
  else
    v_year := old.school_year_id;
  end if;

  if v_year is not null and exists (
    select 1 from public.school_years sy
    where sy.id = v_year and sy.is_archived
  ) then
    raise exception 'This school year is archived - its records are read-only'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'activity_proposals', 'accomplishment_reports', 'audit_documents',
    'other_documents', 'requirements', 'accreditation_items',
    'accreditation_submissions', 'officer_terms', 'advisers',
    'organization_officers'
  ] loop
    execute format(
      'drop trigger if exists enforce_archived_school_year on public.%I;
       create trigger enforce_archived_school_year
         before insert or update or delete on public.%I
         for each row execute function public.enforce_archived_school_year()',
      t, t
    );
  end loop;
end $$;

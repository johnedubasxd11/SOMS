-- ============================================================================
-- SOMS - Phase 8, migration 2/2: configurable approval chains.
--
--  * approval_chains / approval_chain_steps - one chain per submission module,
--    editable by OSA (Adviser -> Dean -> OSA, or any other order).
--  * approval_records - the chain snapshotted for one submission version;
--    one row per step, written only by the SECURITY DEFINER RPCs below.
--  * transition_submission() is rewritten around strict current-step
--    ownership: whoever owns the pending step (adviser of that org, dean of
--    that college, OSA) may approve / reject / request revision. No OSA
--    override anymore - OSA waits its turn like everyone else.
--  * Status mapping while a chain is in flight:
--        current step 1            -> 'submitted'   (set on submit)
--        current step in the middle -> 'endorsed'
--        current step last (>1)     -> 'under_review'
--        every step approved        -> 'approved'
--        single-step chain          -> stays 'submitted' after submit so the
--                                       OSA "Start review" button still shows.
--  * Resubmit bumps the submission version and instantiates a fresh chain;
--    withdraw deletes the current version's rows.
--
-- Client roles never get EXECUTE on the helpers - they are called only from
-- inside transition_submission() (SECURITY DEFINER) or by the service role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type public.approval_step_role as enum (
  'adviser',    -- active adviser of the submission's organization
  'dean',       -- dean / department head of that organization's college
  'osa_admin'   -- Office of Student Affairs (or Super Admin)
);

create type public.approval_step_status as enum (
  'pending',            -- waiting for the owner of this step
  'approved',           -- this step approved the submission
  'rejected',           -- this step rejected it (terminal)
  'revision_requested', -- this step sent it back to the officers
  'cancelled'           -- later pending steps after reject / revision
);

comment on type public.approval_step_role is 'Which kind of account owns an approval step.';
comment on type public.approval_step_status is 'Lifecycle of one approval step of one submission version.';

-- ----------------------------------------------------------------------------
-- 2. Tables
--    The chain is snapshotted into approval_records at submit time, so later
--    edits of approval_chain_steps never rewrite history.
-- ----------------------------------------------------------------------------
create table public.approval_chains (
  id          uuid primary key default gen_random_uuid(),
  record_type public.record_type not null unique,   -- exactly one chain per module
  name        text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint approval_chains_name check (length(btrim(name)) > 0)
);

comment on table public.approval_chains is 'Approval workflow per submission module (one active chain per record_type).';

create table public.approval_chain_steps (
  id          uuid primary key default gen_random_uuid(),
  chain_id    uuid not null references public.approval_chains (id) on delete cascade,
  step_number integer not null check (step_number >= 1),
  step_role   public.approval_step_role not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint approval_chain_steps_unique unique (chain_id, step_number)
);

comment on table public.approval_chain_steps is 'Ordered steps of one approval chain.';

create table public.approval_records (
  id              uuid primary key default gen_random_uuid(),
  record_type     public.record_type not null,
  record_id       uuid not null,          -- polymorphic target (no FK possible)
  version         integer not null default 1 check (version >= 1),
  step_number     integer not null check (step_number >= 1),
  step_role       public.approval_step_role not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status          public.approval_step_status not null default 'pending',
  acted_by        uuid references public.profiles (id) on delete set null,
  acted_at        timestamptz,
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint approval_records_unique unique (record_type, record_id, version, step_number)
);

comment on table public.approval_records is 'Snapshot of the approval chain for one submission version; written only by SECURITY DEFINER RPCs.';
comment on column public.approval_records.record_id is 'Polymorphic target (activity_proposal / report / audit / other document).';

create index approval_records_org_idx   on public.approval_records (organization_id);
create index approval_records_status_idx on public.approval_records (step_role, status);
create index approval_chain_steps_chain_idx on public.approval_chain_steps (chain_id);

create trigger set_updated_at before update on public.approval_chains
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.approval_chain_steps
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.approval_records
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['approval_chains', 'approval_chain_steps'] loop
    execute format(
      'drop trigger if exists audit_log on public.%I;
       create trigger audit_log
         after insert or update or delete on public.%I
         for each row execute function public.log_audit()',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Privileges: clients may READ everything, but only OSA (through RLS) may
--    edit chains, and approval_records is read-only for clients (the RPCs
--    write them as SECURITY DEFINER).
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- The chain tables are editable by OSA through RLS (approval_chains_write /
  -- approval_chain_steps_write), so authenticated keeps full grants.
  foreach t in array array['approval_chains', 'approval_chain_steps'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  -- approval_records is written only by the SECURITY DEFINER RPCs: clients
  -- may read it (RLS decides which rows), never write it.
  execute 'revoke all on public.approval_records from anon, authenticated';
  execute 'grant select on public.approval_records to authenticated';
  execute 'grant all on public.approval_records to service_role';
end $$;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.approval_chains enable row level security;

create policy approval_chains_select on public.approval_chains
  for select to authenticated using (true);
create policy approval_chains_write on public.approval_chains
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

alter table public.approval_chain_steps enable row level security;

create policy approval_chain_steps_select on public.approval_chain_steps
  for select to authenticated using (true);
create policy approval_chain_steps_write on public.approval_chain_steps
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

alter table public.approval_records enable row level security;

create policy approval_records_select on public.approval_records
  for select to authenticated
  using (public.can_view_org(organization_id));
-- no write policy and no write grant: only the RPCs touch this table.

-- ----------------------------------------------------------------------------
-- 5. Private helpers (never granted to anon / authenticated)
-- ----------------------------------------------------------------------------

-- Snapshot the configured chain as pending rows for one submission version.
create or replace function public.instantiate_approval_chain(
  p_record_type public.record_type,
  p_record_id uuid,
  p_organization_id uuid,
  p_version integer
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.approval_records
   where record_type = p_record_type
     and record_id   = p_record_id
     and version     = p_version;

  insert into public.approval_records (
    record_type, record_id, version, step_number, step_role, organization_id, status
  )
  select p_record_type, p_record_id, p_version, s.step_number, s.step_role,
         p_organization_id, 'pending'
  from public.approval_chain_steps s
  join public.approval_chains c on c.id = s.chain_id
  where c.record_type = p_record_type
  order by s.step_number;
end;
$$;

-- Idempotent backfill for records that were already in flight when chains
-- were introduced (and for seed data): derives each step's state from the
-- submission status.
create or replace function public.ensure_approval_instance(
  p_record_type public.record_type,
  p_record_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status    public.submission_status;
  v_org       uuid;
  v_version   integer;
  v_total     integer;
  v_endorsed  timestamptz;
  v_reviewed  timestamptz;
  v_approved  timestamptz;
begin
  execute format(
    'select status, organization_id, version, endorsed_at, reviewed_at, approved_at
       from public.%I where id = $1',
    public.record_type_table(p_record_type)
  )
    into v_status, v_org, v_version, v_endorsed, v_reviewed, v_approved
    using p_record_id;

  if v_status is null or v_org is null then
    return;
  end if;

  if exists (
    select 1 from public.approval_records
    where record_type = p_record_type
      and record_id   = p_record_id
      and version     = v_version
  ) then
    return;                                    -- already instantiated
  end if;

  if v_status not in ('submitted', 'endorsed', 'under_review', 'approved') then
    return;                                    -- nothing in flight (or terminal)
  end if;

  select count(*) into v_total
  from public.approval_chain_steps s
  join public.approval_chains c on c.id = s.chain_id
  where c.record_type = p_record_type;

  if coalesce(v_total, 0) = 0 then
    return;                                    -- no chain configured
  end if;

  insert into public.approval_records (
    record_type, record_id, version, step_number, step_role,
    organization_id, status, acted_at
  )
  select
    p_record_type, p_record_id, v_version, s.step_number, s.step_role, v_org,
    case
      when v_status = 'approved' then 'approved'
      when v_status = 'endorsed'
           and v_total > 1 and s.step_number = 1 then 'approved'
      when v_status = 'under_review'
           and s.step_number < v_total then 'approved'
      else 'pending'
    end::public.approval_step_status,
    case
      when v_status = 'approved' then coalesce(v_approved, now())
      when v_status = 'endorsed'
           and v_total > 1 and s.step_number = 1 then coalesce(v_endorsed, v_reviewed, now())
      when v_status = 'under_review'
           and s.step_number < v_total then coalesce(v_reviewed, v_endorsed, now())
    end
  from public.approval_chain_steps s
  join public.approval_chains c on c.id = s.chain_id
  where c.record_type = p_record_type
  order by s.step_number;
end;
$$;

-- In-app notification to everyone who owns the given step of an organization.
create or replace function public.notify_approval_step(
  p_organization_id uuid,
  p_step_role public.approval_step_role,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_record_type public.record_type,
  p_record_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_step_role = 'adviser' then
    insert into public.notifications (user_id, type, title, body, link, record_type, record_id)
    select u.id, p_type, p_title, p_body,
           public.submission_path(p_record_type, p_record_id),
           p_record_type, p_record_id
    from public.profiles u
    join public.advisers a
      on a.profile_id = u.id
     and a.organization_id = p_organization_id
     and a.is_active
    where u.is_active and u.role = 'adviser';

  elsif p_step_role = 'dean' then
    insert into public.notifications (user_id, type, title, body, link, record_type, record_id)
    select u.id, p_type, p_title, p_body,
           public.submission_path(p_record_type, p_record_id),
           p_record_type, p_record_id
    from public.profiles u
    where u.is_active
      and u.role = 'dean'
      and u.college_id = (
        select o.college_id from public.organizations o where o.id = p_organization_id
      );

  else -- osa_admin
    insert into public.notifications (user_id, type, title, body, link, record_type, record_id)
    select u.id, p_type, p_title, p_body,
           public.submission_path(p_record_type, p_record_id),
           p_record_type, p_record_id
    from public.profiles u
    where u.is_active and u.role in ('osa_admin', 'super_admin');
  end if;
end;
$$;

revoke all on function public.instantiate_approval_chain(public.record_type, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.ensure_approval_instance(public.record_type, uuid)
  from public, anon, authenticated;
revoke all on function public.notify_approval_step(uuid, public.approval_step_role, public.notification_type, text, text, public.record_type, uuid)
  from public, anon, authenticated;
grant execute on function public.instantiate_approval_chain(public.record_type, uuid, uuid, integer)
  to service_role, postgres;
grant execute on function public.ensure_approval_instance(public.record_type, uuid)
  to service_role, postgres;
grant execute on function public.notify_approval_step(uuid, public.approval_step_role, public.notification_type, text, text, public.record_type, uuid)
  to service_role, postgres;

-- ----------------------------------------------------------------------------
-- 6. v_pending_approval - the approval queues.
--    One row per submission whose CURRENT step (the lowest still-pending one)
--    is waiting - future steps of the same chain never show up early.
--    security_invoker, so RLS of the base tables (deans see their college's
--    orgs, officers see their own, OSA sees all) is evaluated per caller.
--    The status filter keeps abandoned versions out.
-- ----------------------------------------------------------------------------
create or replace view public.v_pending_approval
with (security_invoker = true) as
with current_steps as (
  select distinct on (record_type, record_id, version)
    id, record_type, record_id, version, step_number, step_role,
    organization_id, created_at
  from public.approval_records
  where status = 'pending'
  order by record_type, record_id, version, step_number
)
select
  ar.id as approval_record_id,
  'activity_proposal'::public.record_type as record_type,
  p.id as record_id,
  ar.version,
  ar.step_number,
  ar.step_role,
  p.reference_number,
  p.title,
  p.organization_id,
  o.name as organization_name,
  p.status as submission_status,
  p.submitted_at,
  ar.created_at as step_created_at
from public.activity_proposals p
join public.organizations o on o.id = p.organization_id
join current_steps ar
  on ar.record_type = 'activity_proposal'
 and ar.record_id = p.id
 and ar.version = p.version
where p.status in ('submitted', 'endorsed', 'under_review')

union all

select
  ar.id,
  'accomplishment_report',
  r.id,
  ar.version,
  ar.step_number,
  ar.step_role,
  r.reference_number,
  r.title,
  r.organization_id,
  o.name,
  r.status,
  r.submitted_at,
  ar.created_at
from public.accomplishment_reports r
join public.organizations o on o.id = r.organization_id
join current_steps ar
  on ar.record_type = 'accomplishment_report'
 and ar.record_id = r.id
 and ar.version = r.version
where r.status in ('submitted', 'endorsed', 'under_review')

union all

select
  ar.id,
  'audit_document',
  a.id,
  ar.version,
  ar.step_number,
  ar.step_role,
  a.reference_number,
  a.title,
  a.organization_id,
  o.name,
  a.status,
  a.submitted_at,
  ar.created_at
from public.audit_documents a
join public.organizations o on o.id = a.organization_id
join current_steps ar
  on ar.record_type = 'audit_document'
 and ar.record_id = a.id
 and ar.version = a.version
where a.status in ('submitted', 'endorsed', 'under_review')

union all

select
  ar.id,
  'other_document',
  d.id,
  ar.version,
  ar.step_number,
  ar.step_role,
  d.reference_number,
  d.title,
  d.organization_id,
  o.name,
  d.status,
  d.submitted_at,
  ar.created_at
from public.other_documents d
join public.organizations o on o.id = d.organization_id
join current_steps ar
  on ar.record_type = 'other_document'
 and ar.record_id = d.id
 and ar.version = d.version
where d.status in ('submitted', 'endorsed', 'under_review');

grant select on public.v_pending_approval to authenticated;

-- ----------------------------------------------------------------------------
-- 7. transition_submission() - rewritten around the approval chain.
--
--    officer  : own organization  draft|revision_requested -> submitted
--                                              submitted   -> draft (withdraw)
--    any step : STRICT current-step ownership - only the account that owns
--               the pending step may act (no OSA override):
--                 approved            -> approve this step (final step makes
--                                        the record 'approved')
--                 rejected            -> terminal, remarks required
--                 revision_requested  -> back to the officers, remarks required
--                 under_review        -> OSA picks it up at an osa_admin step
--    Anything else (e.g. the old adviser target 'endorsed') is rejected with
--    a hint: approving a step produces the correct status automatically.
-- ----------------------------------------------------------------------------
create or replace function public.transition_submission(
  p_record_type public.record_type,
  p_record_id uuid,
  p_to_status public.submission_status,
  p_remarks text default null
)
returns public.submission_status
language plpgsql security definer set search_path = public
as $$
declare
  v_table        text := public.record_type_table(p_record_type);
  v_profile      public.profiles;
  v_from         public.submission_status;
  v_org          uuid;
  v_version      integer;
  v_ok           boolean := false;
  v_action       public.review_action;
  v_now          timestamptz := now();
  v_new_status   public.submission_status;
  v_is_resubmit  boolean := false;
  v_step         public.approval_records;
  v_next_role    public.approval_step_role;
  v_first_role   public.approval_step_role;
  v_total        integer;
begin
  execute format('select status, organization_id, version from public.%I where id = $1', v_table)
    into v_from, v_org, v_version
    using p_record_id;

  if v_from is null then
    raise exception 'Record % (%) not found', p_record_id, p_record_type
      using errcode = 'P0002';
  end if;

  if p_to_status = v_from then
    raise exception 'Record is already %', v_from using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or not v_profile.is_active then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_to_status in ('submitted', 'draft') then
    -- ---- officer intents: submit / withdraw ----
    if v_profile.role <> 'officer'
       or v_org is distinct from v_profile.organization_id
       or not (
            (v_from in ('draft', 'revision_requested') and p_to_status = 'submitted')
         or (v_from = 'submitted' and p_to_status = 'draft')
          ) then
      raise exception 'Role % may not move % from % to %',
        v_profile.role, p_record_type, v_from, p_to_status
        using errcode = '42501';
    end if;

    v_new_status  := p_to_status;
    v_is_resubmit := v_from = 'revision_requested';
    v_action      := case
      when p_to_status = 'draft' then 'withdrawn'
      when v_is_resubmit then 'resubmitted'
      else 'submitted'
    end;

    select s.step_role into v_first_role
      from public.approval_chain_steps s
      join public.approval_chains c on c.id = s.chain_id
     where c.record_type = p_record_type
       and s.step_number = 1;

    if v_new_status = 'submitted' and v_first_role is null then
      raise exception 'No approval chain is configured for %', p_record_type
        using errcode = 'P0001';
    end if;

  elsif p_to_status in ('approved', 'rejected', 'revision_requested', 'under_review') then
    -- ---- approval-step intents: approve / reject / revision / pick up ----
    if v_profile.role = 'officer' then
      raise exception 'Officers may not decide approvals' using errcode = '42501';
    end if;

    if v_from not in ('submitted', 'endorsed', 'under_review') then
      raise exception 'Role % may not move % from % to %',
        v_profile.role, p_record_type, v_from, p_to_status
        using errcode = '42501';
    end if;

    -- Records submitted before chains existed get their rows now.
    perform public.ensure_approval_instance(p_record_type, p_record_id);

    select * into v_step
      from public.approval_records
     where record_type = p_record_type
       and record_id   = p_record_id
       and version     = v_version
       and status      = 'pending'
     order by step_number
     limit 1
       for update;

    if v_step.id is null then
      raise exception 'Nothing is awaiting approval for this record'
        using errcode = 'P0001';
    end if;

    -- strict ownership of the current step
    if v_step.step_role = 'adviser' then
      -- is_adviser_of() would also let OSA through - query the table directly.
      v_ok := exists (
        select 1 from public.advisers a
         where a.organization_id = v_org
           and a.profile_id = auth.uid()
           and a.is_active
      );
    elsif v_step.step_role = 'dean' then
      v_ok := public.is_dean_of(
        (select o.college_id from public.organizations o where o.id = v_org)
      );
    else -- osa_admin
      v_ok := public.is_osa();
    end if;

    if not v_ok then
      raise exception 'Only the % step may move this submission to %',
        v_step.step_role, p_to_status
        using errcode = '42501';
    end if;

    if p_to_status = 'under_review' and v_step.step_role <> 'osa_admin' then
      raise exception 'Only an OSA step can be picked up for review'
        using errcode = '42501';
    end if;

    if p_to_status in ('rejected', 'revision_requested')
       and (p_remarks is null or length(btrim(p_remarks)) = 0) then
      raise exception 'Remarks are required';
    end if;

    if p_to_status = 'approved' then
      select count(*) into v_total
        from public.approval_records
       where record_type = p_record_type
         and record_id   = p_record_id
         and version     = v_version;

      update public.approval_records
         set status   = 'approved',
             acted_by = v_profile.id,
             acted_at = v_now,
             remarks  = p_remarks
       where id = v_step.id;

      if v_step.step_number >= v_total then
        v_new_status := 'approved';
        v_action     := 'approved';
      else
        -- next step is last -> the record lands with OSA; otherwise endorsed.
        v_new_status := case when v_step.step_number + 1 = v_total
                             then 'under_review'::public.submission_status
                             else 'endorsed'::public.submission_status
                        end;
        v_action     := 'step_approved';
        select s.step_role into v_next_role
          from public.approval_records s
         where s.record_type = p_record_type
           and s.record_id   = p_record_id
           and s.version     = v_version
           and s.step_number = v_step.step_number + 1;
      end if;

    elsif p_to_status = 'rejected' then
      v_new_status := 'rejected';
      v_action     := 'rejected';

      update public.approval_records
         set status   = 'rejected',
             acted_by = v_profile.id,
             acted_at = v_now,
             remarks  = p_remarks
       where id = v_step.id;

      update public.approval_records
         set status = 'cancelled'
       where record_type = p_record_type
         and record_id   = p_record_id
         and version     = v_version
         and status      = 'pending';

    elsif p_to_status = 'revision_requested' then
      v_new_status := 'revision_requested';
      v_action     := 'revision_requested';

      update public.approval_records
         set status   = 'revision_requested',
             acted_by = v_profile.id,
             acted_at = v_now,
             remarks  = p_remarks
       where id = v_step.id;

      update public.approval_records
         set status = 'cancelled'
       where record_type = p_record_type
         and record_id   = p_record_id
         and version     = v_version
         and status      = 'pending';

    else
      -- OSA picks the record up; its step stays pending (still OSA's turn).
      v_new_status := 'under_review';
      v_action     := 'started_review';
    end if;

  else
    raise exception 'Unsupported transition: approvers use approved / rejected / revision_requested / under_review (got %)',
      p_to_status
      using errcode = '42501';
  end if;

  -- Transaction-local bypass of guard_submission_change().
  perform set_config('app.status_guard_bypass', 'true', true);

  execute format($stmt$
    update public.%I
       set status           = $1,
           reviewer_remarks = coalesce($2, reviewer_remarks),
           submitted_at     = case when $3 then $4 else submitted_at end,
           endorsed_at      = case when $5 then $4 else endorsed_at end,
           reviewed_at      = case when $6 then $4 else reviewed_at end,
           approved_at      = case when $7 then $4 else approved_at end,
           version          = case when $8 then version + 1 else version end
     where id = $9
     returning version
  $stmt$, v_table)
    into v_version
    using v_new_status, p_remarks,
          v_new_status = 'submitted', v_now,
          v_new_status = 'endorsed',
          v_new_status in ('under_review', 'approved', 'rejected', 'revision_requested'),
          v_new_status = 'approved',
          coalesce(v_is_resubmit, false),
          p_record_id;

  perform set_config('app.status_guard_bypass', 'false', true);

  insert into public.review_logs (
    record_type, record_id, organization_id, from_status, to_status,
    action, remarks, actor_id, actor_role, actor_name
  ) values (
    p_record_type, p_record_id, v_org, v_from, v_new_status,
    v_action, p_remarks, v_profile.id, v_profile.role, v_profile.full_name
  );

  -- ---- approval_records bookkeeping ----
  if v_new_status = 'submitted' then
    if v_is_resubmit then
      -- stale pending rows of older versions never reach a queue again
      update public.approval_records
         set status = 'cancelled'
       where record_type = p_record_type
         and record_id   = p_record_id
         and version     < v_version
         and status      = 'pending';
    end if;

    perform public.instantiate_approval_chain(p_record_type, p_record_id, v_org, v_version);

    if v_first_role is not null then
      perform public.notify_approval_step(
        v_org, v_first_role, 'status_change',
        format('%s: %s -> %s', v_profile.full_name, v_from, v_new_status),
        p_remarks, p_record_type, p_record_id
      );
    end if;

  elsif v_new_status = 'draft' then
    -- withdraw: drop this version's chain instance
    delete from public.approval_records
     where record_type = p_record_type
       and record_id   = p_record_id
       and version     = v_version;

    if v_first_role is not null then
      perform public.notify_approval_step(
        v_org, v_first_role, 'status_change',
        format('%s: %s -> %s', v_profile.full_name, v_from, v_new_status),
        p_remarks, p_record_type, p_record_id
      );
    end if;

  elsif v_action = 'step_approved' and v_next_role is not null then
    perform public.notify_approval_step(
      v_org, v_next_role, 'status_change',
      format('%s: %s -> %s', v_profile.full_name, v_from, v_new_status),
      p_remarks, p_record_type, p_record_id
    );
  end if;

  -- ---- in-app notifications to the organization's officers ----
  if v_profile.role <> 'officer' then
    perform public.notify_user(
      u.id, 'status_change',
      format('Your submission is now %s', v_new_status),
      p_remarks,
      public.submission_path(p_record_type, p_record_id),
      p_record_type, p_record_id
    )
    from public.profiles u
    where u.is_active and u.role = 'officer' and u.organization_id = v_org;
  end if;

  return v_new_status;
end;
$$;

revoke all on function public.transition_submission(public.record_type, uuid, public.submission_status, text)
  from public, anon;
grant execute on function public.transition_submission(public.record_type, uuid, public.submission_status, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. add_review_comment() - advisers, the dean of the org's college, plus OSA
-- ----------------------------------------------------------------------------
create or replace function public.add_review_comment(
  p_record_type public.record_type,
  p_record_id uuid,
  p_remarks text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_table   text := public.record_type_table(p_record_type);
  v_profile public.profiles;
  v_org     uuid;
  v_status  public.submission_status;
begin
  if p_remarks is null or length(btrim(p_remarks)) = 0 then
    raise exception 'Remarks are required';
  end if;

  execute format('select status, organization_id from public.%I where id = $1', v_table)
    into v_status, v_org using p_record_id;

  if v_status is null then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile is null or not v_profile.is_active then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Advisers of this organization, the dean of its college, plus OSA
  -- (is_adviser_of() grants OSA).
  if not (public.is_adviser_of(v_org) or public.is_dean_of_org(v_org)) then
    raise exception 'You may not comment on this submission' using errcode = '42501';
  end if;

  insert into public.review_logs (
    record_type, record_id, organization_id, from_status, to_status,
    action, remarks, actor_id, actor_role, actor_name
  ) values (
    p_record_type, p_record_id, v_org, v_status, v_status,
    'commented', p_remarks, v_profile.id, v_profile.role, v_profile.full_name
  );

  perform public.notify_user(
    u.id, 'comment',
    format('Comment from %s', v_profile.full_name),
    p_remarks,
    public.submission_path(p_record_type, p_record_id),
    p_record_type, p_record_id
  )
  from public.profiles u
  where u.is_active
    and (u.role = 'officer' and u.organization_id = v_org);
end;
$$;

revoke all on function public.add_review_comment(public.record_type, uuid, text) from public, anon;
grant execute on function public.add_review_comment(public.record_type, uuid, text) to authenticated, service_role;

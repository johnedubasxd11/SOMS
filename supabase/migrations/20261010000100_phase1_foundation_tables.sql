-- ============================================================================
-- SOMS - Phase 1 completion: foundation tables that were still missing.
--
-- The original five Phase 1 migrations created the submission pipeline. This
-- migration adds the remaining schema pieces the spec lists under DATABASE:
--
--   1. accreditation_status aligned to the spec's four values
--      (Pending / Accredited / Conditional / Not Accredited) - replaces the
--      ad-hoc six-value enum; every seeded row is 'pending', so the CASE
--      mapping below is defensive only.
--   2. venues                       - canonical venue list (conflict checks, Phase 4)
--   3. templates                    - OSA-uploaded form templates, versioned (Phase 7)
--   4. announcements + targets      - OSA bulletin with college/org targeting (Phase 7)
--   5. accreditation_items/-submissions - per-school-year checklist (Phase 6)
--   6. officer_terms                - officer-list turnover approval (Phase 6)
--   7. v_calendar_events            - calendar projection over activity_proposals
--      (spec allows a view; Phase 4 builds the UI on top of it)
--   8. school_years.is_archived     - read-only flag for archived years
--      (enforcement trigger arrives with Phase 6 rollover)
--   9. storage buckets `templates` and `announcements`
--
-- DECISION: there is NO separate `comments` table. Comment threads already
-- live in review_logs (action = 'commented') written by add_review_comment();
-- adding a second comment store would split one timeline into two.
--
-- Every new table gets RLS enabled here (checkpoint: RLS on every table).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. accreditation_status -> the four spec values.
--    The two summary views depend on the column, so they are dropped first
--    and recreated verbatim from 20261006000700_phase6_reports.sql below.
-- ----------------------------------------------------------------------------
drop view if exists public.v_activity_summary_by_college;
drop view if exists public.v_organization_summary;

alter type public.accreditation_status rename to accreditation_status_old;

create type public.accreditation_status as enum (
  'pending',         -- not yet reviewed / default for new organizations
  'accredited',      -- fully accredited for the validity period
  'conditional',     -- accredited with conditions (previous: provisional)
  'not_accredited'   -- renewal failed / suspended / expired (previous: expired|suspended)
);

alter table public.organizations
  alter column accreditation_status drop default,
  alter column accreditation_status type public.accreditation_status
    using (
      case accreditation_status::text
        when 'accredited'  then 'accredited'::public.accreditation_status
        when 'provisional' then 'conditional'::public.accreditation_status
        when 'for_renewal' then 'conditional'::public.accreditation_status
        when 'expired'     then 'not_accredited'::public.accreditation_status
        when 'suspended'   then 'not_accredited'::public.accreditation_status
        else 'pending'::public.accreditation_status
      end
    );

alter table public.organizations
  alter column accreditation_status set default 'pending';

drop type public.accreditation_status_old;

-- Recreate the summary views (latest definitions from the phase-6 migration).
create view public.v_organization_summary
with (security_invoker = true) as
with proposal_counts as (
  select organization_id, school_year_id,
         count(*)::int as total_proposals,
         count(*) filter (where status = 'approved')::int as approved_proposals,
         count(*) filter (where status in ('draft','submitted','endorsed','under_review','revision_requested'))::int as pending_proposals,
         count(*) filter (where status = 'rejected')::int as rejected_proposals,
         coalesce(sum(budget) filter (where status = 'approved'), 0)::numeric(14,2) as approved_budget
  from public.activity_proposals
  group by 1, 2
),
report_counts as (
  select organization_id, school_year_id,
         count(*)::int as total_reports,
         count(*) filter (where status = 'approved')::int as approved_reports
  from public.accomplishment_reports
  group by 1, 2
),
audit_counts as (
  select organization_id, school_year_id,
         count(*)::int as total_audit_documents,
         count(*) filter (where status = 'approved')::int as approved_audit_documents
  from public.audit_documents
  group by 1, 2
),
req_counts as (
  select organization_id, school_year_id,
         count(*)::int as total_requirements,
         count(*) filter (where status = 'open')::int as open_requirements,
         count(*) filter (where status = 'completed')::int as completed_requirements,
         count(*) filter (where status = 'overdue')::int as overdue_requirements
  from public.requirements
  group by 1, 2
)
select
  o.id as organization_id,
  o.code as organization_code,
  o.name as organization_name,
  o.accreditation_status,
  o.membership_count,
  o.is_active,
  c.id as college_id,
  c.name as college_name,
  sy.id as school_year_id,
  sy.name as school_year_name,
  coalesce(pc.total_proposals, 0) as total_proposals,
  coalesce(pc.approved_proposals, 0) as approved_proposals,
  coalesce(pc.pending_proposals, 0) as pending_proposals,
  coalesce(pc.rejected_proposals, 0) as rejected_proposals,
  coalesce(pc.approved_budget, 0) as approved_budget,
  coalesce(rc.total_reports, 0) as total_reports,
  coalesce(rc.approved_reports, 0) as approved_reports,
  coalesce(ac.total_audit_documents, 0) as total_audit_documents,
  coalesce(ac.approved_audit_documents, 0) as approved_audit_documents,
  coalesce(rqc.total_requirements, 0) as total_requirements,
  coalesce(rqc.open_requirements, 0) as open_requirements,
  coalesce(rqc.completed_requirements, 0) as completed_requirements,
  coalesce(rqc.overdue_requirements, 0) as overdue_requirements
from public.organizations o
join public.colleges c      on c.id = o.college_id
cross join public.school_years sy
left join proposal_counts pc on pc.organization_id = o.id and pc.school_year_id = sy.id
left join report_counts   rc on rc.organization_id = o.id and rc.school_year_id = sy.id
left join audit_counts    ac on ac.organization_id = o.id and ac.school_year_id = sy.id
left join req_counts     rqc on rqc.organization_id = o.id and rqc.school_year_id = sy.id
where o.is_active;

create view public.v_activity_summary_by_college
with (security_invoker = true) as
select
  c.id as college_id,
  c.code as college_code,
  c.name as college_name,
  sy.id as school_year_id,
  sy.name as school_year_name,
  count(distinct o.id)::int as organization_count,
  sum(s.total_proposals)::int as total_proposals,
  sum(s.approved_proposals)::int as approved_proposals,
  sum(s.pending_proposals)::int as pending_proposals,
  sum(s.total_reports)::int as total_reports,
  sum(s.approved_reports)::int as approved_reports,
  sum(s.total_audit_documents)::int as total_audit_documents,
  sum(s.approved_budget)::numeric(14,2) as approved_budget
from public.colleges c
join public.organizations o on o.college_id = c.id and o.is_active
cross join public.school_years sy
join public.v_organization_summary s
  on s.organization_id = o.id and s.school_year_id = sy.id
where public.is_osa()
group by c.id, c.code, c.name, sy.id, sy.name;

grant select on
  public.v_organization_summary,
  public.v_activity_summary_by_college
to authenticated;

-- ----------------------------------------------------------------------------
-- 2. school_years: archived years are read-only (Phase 6 enforces in DB).
-- ----------------------------------------------------------------------------
alter table public.school_years
  add column if not exists is_archived boolean not null default false;

-- ----------------------------------------------------------------------------
-- 3. New enums for the foundation tables.
-- ----------------------------------------------------------------------------
create type public.template_category as enum (
  'proposal_form',        -- blank activity-proposal template
  'liquidation_form',
  'accomplishment_report',
  'other'
);

create type public.announcement_target_type as enum (
  'all',          -- every authenticated user
  'college',      -- one or more colleges (see announcement_targets)
  'organization'  -- one or more organizations (see announcement_targets)
);

create type public.accreditation_submission_status as enum (
  'pending',     -- uploaded by the organization, awaiting OSA review
  'approved',
  'rejected'
);

create type public.officer_term_status as enum (
  'draft',       -- officers editing the list
  'submitted',   -- sent to OSA for approval
  'approved',    -- OSA accepted the officer list for the school year
  'rejected'
);

-- ----------------------------------------------------------------------------
-- 4. Tables.
-- ----------------------------------------------------------------------------

-- Canonical venue list: the proposal form picks from here (free text stays
-- possible for off-campus activities), Phase 4 conflict checks match on name.
create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  location   text,
  capacity   integer check (capacity > 0),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_name check (length(btrim(name)) > 0)
);

comment on table public.venues is 'Canonical list of on-campus venues (conflict detection, Phase 4).';

create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    public.template_category not null default 'other',

  storage_path text not null unique,   -- bucket `templates`, path {template_id}/{filename}
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),

  parent_id   uuid references public.templates (id) on delete set null,
  version     integer not null default 1 check (version >= 1),
  is_active   boolean not null default true,   -- only the newest version is offered

  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.templates is 'OSA-uploaded blank forms (proposal, liquidation, accomplishment). Versioned like documents: never overwritten.';
comment on column public.templates.parent_id is 'Previous version of the same template.';

create index templates_category_idx on public.templates (category) where is_active;

create table public.announcements (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  body      text not null,
  target_type public.announcement_target_type not null default 'all',
  is_pinned boolean not null default false,
  expires_at timestamptz,

  -- Optional attachment stored in the `announcements` bucket
  -- (path {announcement_id}/{filename}). A single file per announcement:
  -- for multi-file bulletins, link to org-documents or attach the PDF.
  attachment_path       text,
  attachment_file_name  text,
  attachment_mime_type  text,
  attachment_size_bytes bigint check (attachment_size_bytes is null or (attachment_size_bytes > 0 and attachment_size_bytes <= 10485760)),

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title check (length(btrim(title)) > 0),
  constraint announcements_body  check (length(btrim(body)) > 0),
  constraint announcements_attachment check (
    (attachment_path is null and attachment_file_name is null
       and attachment_mime_type is null and attachment_size_bytes is null)
    or (attachment_path is not null and attachment_file_name is not null
       and attachment_mime_type is not null and attachment_size_bytes is not null)
  )
);

comment on table public.announcements is 'OSA bulletin board entries (Phase 7). Visibility is computed in the RLS policy from target_type + announcement_targets.';

create index announcements_pinned_idx on public.announcements (is_pinned, created_at desc);
create index announcements_expiry_idx  on public.announcements (expires_at) where expires_at is not null;

-- Exactly one of college_id / organization_id is set (check constraint).
-- announcement_targets itself is not sensitive (ids already visible through
-- organizations), so its SELECT policy is `using (true)` - this also keeps
-- the announcements policy free of RLS recursion.
create table public.announcement_targets (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  college_id      uuid references public.colleges (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint announcement_targets_scope check ((college_id is null) <> (organization_id is null))
);

create unique index announcement_targets_unique
  on public.announcement_targets (announcement_id, college_id, organization_id) nulls not distinct;
create index announcement_targets_college_idx on public.announcement_targets (college_id);
create index announcement_targets_org_idx     on public.announcement_targets (organization_id);

-- Accreditation checklist: OSA defines the items per school year, every
-- organization uploads one file per item.
create table public.accreditation_items (
  id             uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  title          text not null,
  description    text,
  sort_order     integer not null default 0,
  is_required    boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint accreditation_items_title check (length(btrim(title)) > 0),
  constraint accreditation_items_unique unique (school_year_id, title)
);

comment on table public.accreditation_items is 'Accreditation checklist items for one school year (OSA-managed).';

create index accreditation_items_sy_idx on public.accreditation_items (school_year_id, sort_order);

create table public.accreditation_submissions (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.accreditation_items (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Files live in the `org-documents` bucket under
  -- {organization_id}/accreditation/{item_id}/{filename}, so the existing
  -- org-scoped storage policies apply unchanged.
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),

  status       public.accreditation_submission_status not null default 'pending',
  remarks      text,                       -- OSA feedback when rejected/approved

  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint accreditation_submissions_unique unique (item_id, organization_id)
);

comment on table public.accreditation_submissions is 'One upload per organization per checklist item. Status is decided by OSA (Phase 6).';

create index accreditation_subs_org_idx on public.accreditation_submissions (organization_id);
create index accreditation_subs_status_idx on public.accreditation_submissions (status);

-- Officer turnover: the officer list for one organization per school year,
-- submitted by the officers and approved by OSA (Phase 6).
create table public.officer_terms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  school_year_id  uuid not null references public.school_years (id) on delete cascade,
  status          public.officer_term_status not null default 'draft',
  notes           text,

  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint officer_terms_unique unique (organization_id, school_year_id)
);

comment on table public.officer_terms is 'Officer-list turnover record per organization per school year; OSA approves it (Phase 6).';

create index officer_terms_org_idx on public.officer_terms (organization_id);
create index officer_terms_status_idx on public.officer_terms (status);

-- ----------------------------------------------------------------------------
-- 5. updated_at + audit triggers for the new tables.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'venues', 'templates', 'announcements', 'accreditation_items',
    'accreditation_submissions', 'officer_terms'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t
    );
    execute format(
      'create trigger audit_log
         after insert or update or delete on public.%I
         for each row execute function public.log_audit()',
      t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Privileges (same contract as every other table: no anon, CRUD for
--    authenticated, everything for service_role; RLS narrows the rows).
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'venues', 'templates', 'announcements', 'announcement_targets',
    'accreditation_items', 'accreditation_submissions', 'officer_terms'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. RLS.
-- ----------------------------------------------------------------------------

-- venues: everyone reads the list, OSA maintains it.
alter table public.venues enable row level security;
create policy venues_select on public.venues
  for select to authenticated using (true);
create policy venues_write on public.venues
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

-- templates: every signed-in user downloads the latest version, only OSA
-- uploads / supersedes / deletes.
alter table public.templates enable row level security;
create policy templates_select on public.templates
  for select to authenticated using (true);
create policy templates_write on public.templates
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

-- announcement_targets: readable by all (the ids are not sensitive and the
-- announcements policy subqueries this table - a restrictive policy here
-- would recurse); writable by OSA only.
alter table public.announcement_targets enable row level security;
create policy announcement_targets_select on public.announcement_targets
  for select to authenticated using (true);
create policy announcement_targets_write on public.announcement_targets
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

-- announcements: OSA sees everything (including expired); everyone else sees
-- live announcements that target them - 'all', their dean's college / their
-- own org's college, or their own organization.
alter table public.announcements enable row level security;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_osa()
    or (
      (expires_at is null or expires_at > now())
      and (
        target_type = 'all'
        or (
          target_type = 'college'
          and exists (
            select 1 from public.announcement_targets t
            where t.announcement_id = announcements.id
              and t.college_id is not null
              and (
                t.college_id = public.get_my_college_id()
                or t.college_id = (
                  select o.college_id from public.organizations o
                  where o.id = public.get_my_org_id()
                )
              )
          )
        )
        or (
          target_type = 'organization'
          and exists (
            select 1 from public.announcement_targets t
            where t.announcement_id = announcements.id
              and t.organization_id = public.get_my_org_id()
          )
        )
      )
    )
  );
create policy announcements_insert on public.announcements
  for insert to authenticated with check (public.is_osa());
create policy announcements_update on public.announcements
  for update to authenticated using (public.is_osa()) with check (public.is_osa());
create policy announcements_delete on public.announcements
  for delete to authenticated using (public.is_osa());

-- accreditation_items: the checklist is public to the community (every org
-- must see what is required), only OSA edits it.
alter table public.accreditation_items enable row level security;
create policy accreditation_items_select on public.accreditation_items
  for select to authenticated using (true);
create policy accreditation_items_write on public.accreditation_items
  for all to authenticated using (public.is_osa()) with check (public.is_osa());

-- accreditation_submissions: visible to anyone who may view the org; the org
-- uploads (always as 'pending'); OSA reviews and sets approved/rejected; the
-- org may replace its own pending upload, OSA may delete any.
alter table public.accreditation_submissions enable row level security;
create policy accreditation_submissions_select on public.accreditation_submissions
  for select to authenticated
  using (public.can_view_org(organization_id));

create policy accreditation_submissions_insert on public.accreditation_submissions
  for insert to authenticated
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
    and (organization_id = public.get_my_org_id() or public.is_osa())
  );

create policy accreditation_submissions_update on public.accreditation_submissions
  for update to authenticated
  using (
    public.is_osa()
    or (organization_id = public.get_my_org_id() and status = 'pending')
  )
  with check (
    public.is_osa()
    or (organization_id = public.get_my_org_id() and status = 'pending')
  );

create policy accreditation_submissions_delete on public.accreditation_submissions
  for delete to authenticated
  using (public.is_osa());

-- officer_terms: officers of the org create/edit their draft and submit it;
-- OSA reviews (approve / reject). Approved terms are frozen for everyone
-- except OSA (the using clause drops non-OSA once status leaves draft/submitted).
alter table public.officer_terms enable row level security;
create policy officer_terms_select on public.officer_terms
  for select to authenticated
  using (public.can_view_org(organization_id));

create policy officer_terms_insert on public.officer_terms
  for insert to authenticated
  with check (
    organization_id = public.get_my_org_id()
    and submitted_by = auth.uid()
    and status = 'draft'
  );

create policy officer_terms_update on public.officer_terms
  for update to authenticated
  using (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status in ('draft', 'submitted')
    )
  )
  with check (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status in ('draft', 'submitted')
    )
  );

create policy officer_terms_delete on public.officer_terms
  for delete to authenticated
  using (
    public.is_osa()
    or (
      organization_id = public.get_my_org_id()
      and status = 'draft'
    )
  );

-- ----------------------------------------------------------------------------
-- 8. v_calendar_events - calendar projection over activity_proposals.
--
--    DELIBERATELY NOT security_invoker: the spec requires officers to see
--    their own events plus every APPROVED event of other organizations, which
--    base-table RLS cannot express without widening the proposals policies
--    system-wide. The rules are therefore embedded in the WHERE clause using
--    the SECURITY DEFINER helpers (is_osa / get_my_org_id / is_adviser_of /
--    is_dean_of_org) - a view can never grant more than its definition says.
--    Phase 4 builds the calendar UI on this view.
-- ----------------------------------------------------------------------------
create view public.v_calendar_events as
select
  p.id,
  p.reference_number,
  p.title,
  p.activity_date,
  p.start_time,
  p.end_time,
  p.venue,
  p.status,
  p.organization_id,
  o.name as organization_name,
  p.school_year_id,
  p.created_at
from public.activity_proposals p
join public.organizations o on o.id = p.organization_id
where public.is_osa()
   or p.organization_id = public.get_my_org_id()
   or public.is_adviser_of(p.organization_id)
   or public.is_dean_of_org(p.organization_id)
   or p.status = 'approved';

grant select on public.v_calendar_events to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Storage buckets `templates` and `announcements`.
--    Private like every other bucket; readable by any authenticated user
--    (the download links are signed server-side), writable by OSA only.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('templates', 'templates', false, 10485760, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'image/jpeg',
     'image/png'
   ]),
  ('announcements', 'announcements', false, 10485760, array[
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'image/jpeg',
     'image/png'
   ])
on conflict (id) do nothing;

drop policy if exists soms_read_shared_buckets on storage.objects;
create policy soms_read_shared_buckets on storage.objects
  for select to authenticated
  using (bucket_id in ('templates', 'announcements'));

drop policy if exists soms_write_shared_buckets on storage.objects;
create policy soms_write_shared_buckets on storage.objects
  for insert to authenticated
  with check (bucket_id in ('templates', 'announcements') and public.is_osa());

drop policy if exists soms_update_shared_buckets on storage.objects;
create policy soms_update_shared_buckets on storage.objects
  for update to authenticated
  using (bucket_id in ('templates', 'announcements') and public.is_osa())
  with check (bucket_id in ('templates', 'announcements') and public.is_osa());

drop policy if exists soms_delete_shared_buckets on storage.objects;
create policy soms_delete_shared_buckets on storage.objects
  for delete to authenticated
  using (bucket_id in ('templates', 'announcements') and public.is_osa());

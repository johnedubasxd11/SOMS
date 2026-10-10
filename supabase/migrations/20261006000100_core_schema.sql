-- ============================================================================
-- SOMS - Core schema
-- Assumption College of Davao - Office of Student Affairs
--
-- Phase 1 migration 1/5: extensions, enums, tables, indexes, updated_at
-- triggers and the reference-number generator.
--
-- Every table created here gets RLS enabled in migration 20261006000300_rls.sql.
-- Nothing in this file is public: SELECT is granted to `authenticated` only.
-- ============================================================================

-- pg_trgm powers the trigram indexes used by the search filters (Phase 6).
create extension if not exists pg_trgm with schema extensions;

-- ----------------------------------------------------------------------------
-- Reference numbers: SOMS-<year>-0001
-- One SEQUENCE per calendar year so the counter restarts every year, plus a
-- helper function that lazily creates the sequence for the current year.
-- SECURITY DEFINER because `authenticated` cannot create sequences itself.
-- ----------------------------------------------------------------------------
do $$
declare
  v_year int;
begin
  for v_year in 2024..2040 loop
    execute format('create sequence if not exists public.reference_number_seq_%s', v_year);
  end loop;
end $$;

create or replace function public.generate_reference_number(p_prefix text default 'SOMS')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int    := extract(year from now())::int;
  v_name   text   := 'reference_number_seq_' || v_year;
  v_n      bigint;
begin
  -- A year outside the pre-created range still works (created on first use).
  if to_regclass('public.' || v_name) is null then
    execute format('create sequence public.%I', v_name);
  end if;

  execute format('select nextval(%L)', 'public.' || v_name) into v_n;
  return format('%s-%s-%s', p_prefix, v_year, lpad(v_n::text, 4, '0'));
end;
$$;

grant execute on function public.generate_reference_number(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

-- Everyone who can sign in. `officer` covers every org position
-- (President, Secretary, Treasurer, ...); the position itself lives in
-- organization_officers / profiles.position.
create type public.user_role as enum (
  'super_admin',  -- IT: users, roles, school years, settings
  'osa_admin',    -- Office of Student Affairs staff
  'adviser',      -- Faculty adviser of an organization
  'officer'       -- Student organization officer
);

-- Shared lifecycle for every submission module (proposals, reports, ...).
create type public.submission_status as enum (
  'draft',
  'submitted',           -- officer sent it to OSA
  'endorsed',            -- adviser endorsed it (optional step)
  'under_review',        -- OSA picked it up
  'revision_requested',  -- OSA sent it back for changes
  'approved',
  'rejected'
);

create type public.review_action as enum (
  'created',
  'submitted',
  'resubmitted',
  'withdrawn',
  'endorsed',
  'commented',
  'started_review',
  'revision_requested',
  'approved',
  'rejected',
  'hardcopy_received'
);

-- Polymorphic discriminator used by documents / review_logs / notifications /
-- hardcopy_records so one row can point at any submission table.
create type public.record_type as enum (
  'activity_proposal',
  'accomplishment_report',
  'audit_document',
  'other_document'
);

create type public.document_kind as enum (
  'proposal',        -- activity_proposal attachments
  'report',          -- accomplishment_report attachments
  'audit',           -- audit_documents attachments
  'other',           -- other_documents attachments / general org documents
  'logo'             -- organization logos
);

create type public.document_category as enum (
  'constitution_by_laws',
  'resolution',
  'memo',
  'minutes',
  'other'
);

create type public.audit_doc_type as enum (
  'financial_statement',
  'receipt',
  'audit_report',
  'other'
);

create type public.semester as enum ('first', 'second', 'summer');

create type public.accreditation_status as enum (
  'pending',
  'provisional',
  'accredited',
  'for_renewal',
  'expired',
  'suspended'
);

create type public.requirement_status as enum (
  'open',
  'completed',
  'overdue',
  'waived'
);

create type public.notification_type as enum (
  'status_change',
  'comment',
  'requirement',
  'reminder',
  'system'
);

-- Derived badge shown next to a submission:
-- softcopy only / hardcopy received / complete (approved + hardcopy in).
create type public.copy_status as enum (
  'softcopy_only',
  'hardcopy_received',
  'complete'
);

-- ----------------------------------------------------------------------------
-- updated_at maintenance (one generic trigger function for every table)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reference / taxonomy tables
-- ----------------------------------------------------------------------------

create table public.colleges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.colleges is 'Colleges / departments that student organizations belong to.';

create table public.school_years (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,     -- e.g. '2026-2027'
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint school_years_order check (end_date > start_date)
);

-- Only one school year may be flagged as current.
create unique index school_years_single_current
  on public.school_years (is_current) where is_current;

create table public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  name                   text not null,
  college_id             uuid not null references public.colleges (id) on delete restrict,
  description            text,
  logo_path              text,
  accreditation_status   public.accreditation_status not null default 'pending',
  accreditation_valid_until date,
  membership_count       integer not null default 0,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint organizations_membership check (membership_count >= 0)
);

comment on table public.organizations is 'Student organizations (18 seeded from the OSA list).';

create index organizations_college_idx on public.organizations (college_id);
create index organizations_name_trgm_idx on public.organizations using gin (name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Auth-linked profiles.
-- Populated by the trigger on auth.users (see 20261006000200_functions.sql).
-- The trigger always inserts role='officer' and organization_id=NULL: metadata
-- sent by a public signup can never escalate privileges. Roles/orgs are then
-- assigned by OSA (or by scripts/seed-users.ts using the service role key).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null unique,
  full_name       text not null,
  role            public.user_role not null default 'officer',
  organization_id uuid references public.organizations (id) on delete set null,
  position        text,                     -- e.g. 'President', 'Secretary'
  is_active       boolean not null default true,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_organization_idx on public.profiles (organization_id);
create index profiles_role_idx on public.profiles (role);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);

create table public.advisers (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  school_year_id  uuid not null references public.school_years (id) on delete cascade,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One adviser per organization per school year.
  constraint advisers_unique unique (organization_id, school_year_id),
  constraint advisers_profile_unique unique (profile_id, school_year_id)
);

comment on table public.advisers is 'Adviser assignments per organization per school year.';

create index advisers_profile_idx on public.advisers (profile_id);
create index advisers_org_idx on public.advisers (organization_id);
create index advisers_school_year_idx on public.advisers (school_year_id);

create table public.organization_officers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  school_year_id  uuid not null references public.school_years (id) on delete cascade,
  position        text not null,            -- President, Secretary, Treasurer, ...
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Exactly one holder per position, per organization, per school year.
  constraint officers_position_unique unique (organization_id, school_year_id, position),
  constraint officers_profile_unique  unique (profile_id, school_year_id, position)
);

create index officers_org_idx on public.organization_officers (organization_id);
create index officers_profile_idx on public.organization_officers (profile_id);
create index officers_school_year_idx on public.organization_officers (school_year_id);

-- ----------------------------------------------------------------------------
-- Submission tables. All four share the same review lifecycle, the same
-- reference number and the same RLS rules.
-- ----------------------------------------------------------------------------

create table public.activity_proposals (
  id                 uuid primary key default gen_random_uuid(),
  reference_number   text not null unique default public.generate_reference_number('SOMS'),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  school_year_id     uuid not null references public.school_years (id) on delete restrict,
  created_by         uuid not null references public.profiles (id) on delete restrict,

  title              text not null,
  description        text,
  objectives         text,
  activity_date      date not null,
  start_time         time,
  end_time           time,
  venue              text not null,
  participants_count integer not null default 0,
  budget             numeric(14, 2) not null default 0,
  source_of_funds    text,

  status             public.submission_status not null default 'draft',
  reviewer_remarks   text,                  -- latest remark from adviser/OSA
  version            integer not null default 1,   -- bumped on every resubmit

  submitted_at       timestamptz,
  endorsed_at        timestamptz,
  reviewed_at        timestamptz,
  approved_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint proposals_participants check (participants_count >= 0),
  constraint proposals_budget check (budget >= 0),
  constraint proposals_title check (length(btrim(title)) > 0)
);

comment on table public.activity_proposals is 'Activity proposals submitted by organization officers.';

create index proposals_org_idx      on public.activity_proposals (organization_id);
create index proposals_sy_idx       on public.activity_proposals (school_year_id);
create index proposals_status_idx   on public.activity_proposals (status);
create index proposals_created_by_idx on public.activity_proposals (created_by);
create index proposals_date_idx     on public.activity_proposals (activity_date);
create index proposals_created_idx  on public.activity_proposals (created_at desc);
create index proposals_title_trgm_idx on public.activity_proposals using gin (title gin_trgm_ops);

create table public.accomplishment_reports (
  id                 uuid primary key default gen_random_uuid(),
  reference_number   text not null unique default public.generate_reference_number('SOMS'),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  school_year_id     uuid not null references public.school_years (id) on delete restrict,
  -- Accomplishment reports are written for an already approved activity.
  proposal_id        uuid references public.activity_proposals (id) on delete set null,
  created_by         uuid not null references public.profiles (id) on delete restrict,

  title              text not null,
  summary            text,
  outcomes           text,
  attendance_count   integer not null default 0,
  budget_spent       numeric(14, 2) not null default 0,
  liquidation_summary text,

  status             public.submission_status not null default 'draft',
  reviewer_remarks   text,
  version            integer not null default 1,

  submitted_at       timestamptz,
  endorsed_at        timestamptz,
  reviewed_at        timestamptz,
  approved_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint reports_attendance check (attendance_count >= 0),
  constraint reports_budget check (budget_spent >= 0),
  constraint reports_title check (length(btrim(title)) > 0)
);

create index reports_org_idx    on public.accomplishment_reports (organization_id);
create index reports_sy_idx     on public.accomplishment_reports (school_year_id);
create index reports_status_idx on public.accomplishment_reports (status);
create index reports_proposal_idx on public.accomplishment_reports (proposal_id);
create index reports_created_by_idx on public.accomplishment_reports (created_by);
create index reports_title_trgm_idx on public.accomplishment_reports using gin (title gin_trgm_ops);

create table public.audit_documents (
  id                 uuid primary key default gen_random_uuid(),
  reference_number   text not null unique default public.generate_reference_number('SOMS'),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  school_year_id     uuid not null references public.school_years (id) on delete restrict,
  created_by         uuid not null references public.profiles (id) on delete restrict,

  doc_type           public.audit_doc_type not null default 'other',
  semester           public.semester not null default 'first',
  title              text not null,
  description        text,

  status             public.submission_status not null default 'draft',
  reviewer_remarks   text,
  version            integer not null default 1,

  submitted_at       timestamptz,
  endorsed_at        timestamptz,
  reviewed_at        timestamptz,
  approved_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint audit_docs_title check (length(btrim(title)) > 0)
);

create index audit_docs_org_idx    on public.audit_documents (organization_id);
create index audit_docs_sy_idx     on public.audit_documents (school_year_id);
create index audit_docs_type_idx   on public.audit_documents (doc_type, semester);
create index audit_docs_status_idx on public.audit_documents (status);
create index audit_docs_created_by_idx on public.audit_documents (created_by);
create index audit_docs_title_trgm_idx on public.audit_documents using gin (title gin_trgm_ops);

-- "Other Documents" module (Constitution and By-Laws, Resolutions, Memos, ...).
-- Kept as its own table (not raw documents rows) so it can carry a title,
-- status, reviewer remarks and a reference number like every other module.
create table public.other_documents (
  id                 uuid primary key default gen_random_uuid(),
  reference_number   text not null unique default public.generate_reference_number('SOMS'),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  school_year_id     uuid not null references public.school_years (id) on delete restrict,
  created_by         uuid not null references public.profiles (id) on delete restrict,

  category           public.document_category not null default 'other',
  title              text not null,
  description        text,

  status             public.submission_status not null default 'draft',
  reviewer_remarks   text,
  version            integer not null default 1,

  submitted_at       timestamptz,
  endorsed_at        timestamptz,
  reviewed_at        timestamptz,
  approved_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint other_docs_title check (length(btrim(title)) > 0)
);

create index other_docs_org_idx    on public.other_documents (organization_id);
create index other_docs_sy_idx     on public.other_documents (school_year_id);
create index other_docs_cat_idx    on public.other_documents (category);
create index other_docs_status_idx on public.other_documents (status);
create index other_docs_created_by_idx on public.other_documents (created_by);

-- ----------------------------------------------------------------------------
-- documents: one row per stored object. Files are NEVER overwritten - a new
-- upload inserts a new row (version = prev + 1, parent_id = prev.id) and the
-- previous row keeps its storage_path forever.
-- path convention: {organization_id}/{module}/{record_id}/{filename}
-- ----------------------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  bucket          text not null check (bucket in ('submissions', 'org-documents', 'org-logos')),
  storage_path    text not null unique,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 10485760), -- 10 MB cap

  doc_type        public.document_kind not null,
  category        public.document_category,     -- only for org-documents / 'other'
  record_type     public.record_type,           -- null for logos
  record_id       uuid,                         -- polymorphic target (no FK possible)
  parent_id       uuid references public.documents (id) on delete set null,
  version         integer not null default 1 check (version >= 1),

  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by     uuid not null references public.profiles (id) on delete restrict,
  is_active       boolean not null default true, -- false on superseded versions
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.documents.parent_id is 'Previous version of the same logical file (never overwritten).';
comment on column public.documents.is_active is 'Only the newest version of a file is active.';

create index documents_record_idx    on public.documents (record_type, record_id);
create index documents_parent_idx    on public.documents (parent_id);
create index documents_org_idx       on public.documents (organization_id);
create index documents_uploader_idx  on public.documents (uploaded_by);
create index documents_bucket_idx    on public.documents (bucket);
create index documents_kind_idx      on public.documents (doc_type);

-- ----------------------------------------------------------------------------
-- review_logs: immutable history of every status change / comment
-- ----------------------------------------------------------------------------
create table public.review_logs (
  id              bigint generated always as identity primary key,
  record_type     public.record_type not null,
  record_id       uuid not null,
  organization_id uuid references public.organizations (id) on delete cascade,
  from_status     public.submission_status,
  to_status       public.submission_status,
  action          public.review_action not null,
  remarks         text,
  actor_id        uuid references public.profiles (id) on delete set null,
  actor_role      public.user_role,
  actor_name      text,
  created_at      timestamptz not null default now()
);

create index review_logs_record_idx on public.review_logs (record_type, record_id, created_at desc);
create index review_logs_actor_idx  on public.review_logs (actor_id);
create index review_logs_org_idx    on public.review_logs (organization_id);

-- ----------------------------------------------------------------------------
-- notifications: realtime in-app inbox
-- ----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        public.notification_type not null default 'system',
  title       text not null,
  body        text,
  link        text,
  record_type public.record_type,
  record_id   uuid,
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx      on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where not is_read;

-- ----------------------------------------------------------------------------
-- hardcopy_records: OSA confirms the paper copy of a submission
-- ----------------------------------------------------------------------------
create table public.hardcopy_records (
  id               uuid primary key default gen_random_uuid(),
  record_type      public.record_type not null,
  record_id        uuid not null,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  reference_number text not null,

  received         boolean not null default false,
  received_at      timestamptz,
  received_by      uuid references public.profiles (id) on delete set null,
  receiver_name    text,
  remarks          text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint hardcopy_unique unique (record_type, record_id)
);

create index hardcopy_org_idx on public.hardcopy_records (organization_id);

-- ----------------------------------------------------------------------------
-- requirements: OSA-created obligations with due dates
-- ----------------------------------------------------------------------------
create table public.requirements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  school_year_id  uuid not null references public.school_years (id) on delete cascade,
  assigned_by     uuid references public.profiles (id) on delete set null,

  title           text not null,
  description     text,
  due_date        date,
  status          public.requirement_status not null default 'open',
  completed_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index requirements_org_idx on public.requirements (organization_id, due_date);
create index requirements_sy_idx  on public.requirements (school_year_id, status);
create index requirements_due_idx on public.requirements (due_date) where status = 'open';

-- ----------------------------------------------------------------------------
-- audit_logs: who changed what, written by trigger only (no client INSERT)
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  record_id       text,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data        jsonb,
  new_data        jsonb,
  changed_by      uuid,
  changed_by_email text,
  created_at      timestamptz not null default now()
);

create index audit_logs_table_idx  on public.audit_logs (table_name, created_at desc);
create index audit_logs_actor_idx  on public.audit_logs (changed_by);
create index audit_logs_record_idx on public.audit_logs (record_id);

-- ----------------------------------------------------------------------------
-- system_settings (Super Admin) and rate_limits (login brute-force protection)
-- ----------------------------------------------------------------------------
create table public.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create table public.rate_limits (
  key             text primary key,          -- e.g. 'login:<email>'
  window_started  timestamptz not null default now(),
  attempts        integer not null default 0,
  blocked_until   timestamptz,
  updated_at      timestamptz not null default now()
);

comment on table public.rate_limits is 'Fixed-window counters for login / sensitive routes. Never readable by clients (no RLS policy -> service role only).';

-- ----------------------------------------------------------------------------
-- Attach the generic updated_at trigger to every table that has the column.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'colleges', 'school_years', 'organizations', 'profiles', 'advisers',
    'organization_officers', 'activity_proposals', 'accomplishment_reports',
    'audit_documents', 'other_documents', 'documents', 'hardcopy_records',
    'requirements', 'rate_limits'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end $$;

-- system_settings only has updated_at (no created_at) - same trigger works.
create trigger set_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

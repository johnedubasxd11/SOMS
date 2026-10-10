-- ============================================================================
-- SOMS - Seed data (runs automatically on `supabase db reset`)
--
-- Only data that does NOT need an auth user lives here. Auth users, profiles,
-- adviser/officer links and sample submissions are created by
-- `npm run seed:auth` (scripts/seed-users.ts) using the service role key.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Colleges / categories (labels taken verbatim from the OSA list)
-- ----------------------------------------------------------------------------
insert into public.colleges (code, name) values
  ('BSIT', 'BSIT'),
  ('BADM', 'Business Administration'),
  ('SW',   'Social Work'),
  ('TE',   'Teacher Education'),
  ('HM',   'Hospitality Management'),
  ('CW',   'College-Wide')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- School years (PH SY runs June -> May). 2026-2027 is the current year.
-- ----------------------------------------------------------------------------
insert into public.school_years (name, start_date, end_date, is_current) values
  ('2025-2026', date '2025-06-01', date '2026-05-31', false),
  ('2026-2027', date '2026-06-01', date '2027-05-31', true)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Organizations (18 - see README: the brief mentions 19 but lists 18)
-- ----------------------------------------------------------------------------
insert into public.organizations (code, name, college_id)
select v.code, v.name, c.id
from (values
  ('LITS',  'BSIT-LITS', 'BSIT'),
  ('JFINEX','JFINEX',    'BADM'),
  ('BAS',   'BAS',       'BADM'),
  ('JPMAP', 'JPMAP',     'BADM'),
  ('AYMA',  'AYMA',      'BADM'),
  ('JSWAP', 'JSWAP',     'SW'),
  ('LOVES', 'LOVES',     'TE'),
  ('UEEC',  'UEEC',      'TE'),
  ('AMMS',  'AMMS',      'TE'),
  ('AYSO',  'AYSO',      'TE'),
  ('GEMS',  'GEMS',      'TE'),
  ('ACES',  'ACES',      'TE'),
  ('AFPHI', 'AFPHI',     'HM'),
  ('KASAMA','KASAMA',    'CW'),
  ('YAPAK', 'YAPAK',     'CW'),
  ('ASQUAD','A Squad',   'CW'),
  ('SIKLAB','Siklab',    'CW'),
  ('LAYAG', 'LAYAG',     'CW')
) as v(code, name, college_code)
join public.colleges c on c.code = v.college_code
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Approval chains - one active chain per submission module (OSA can edit them
-- at /osa/approval-chains). proposals / reports / audit documents go
-- Adviser -> Dean -> OSA; other documents are filed directly with OSA.
-- ----------------------------------------------------------------------------
insert into public.approval_chains (record_type, name) values
  ('activity_proposal',     'Proposal approval chain'),
  ('accomplishment_report', 'Accomplishment report approval chain'),
  ('audit_document',        'Audit document approval chain'),
  ('other_document',        'Other document approval chain')
on conflict (record_type) do nothing;

insert into public.approval_chain_steps (chain_id, step_number, step_role)
select c.id, v.step_number, v.step_role::public.approval_step_role
from public.approval_chains c
join (values
  ('activity_proposal',     1, 'adviser'),
  ('activity_proposal',     2, 'dean'),
  ('activity_proposal',     3, 'osa_admin'),
  ('accomplishment_report', 1, 'adviser'),
  ('accomplishment_report', 2, 'dean'),
  ('accomplishment_report', 3, 'osa_admin'),
  ('audit_document',        1, 'adviser'),
  ('audit_document',        2, 'dean'),
  ('audit_document',        3, 'osa_admin'),
  ('other_document',        1, 'osa_admin')
) as v(record_type, step_number, step_role)
  on v.record_type::public.record_type = c.record_type
on conflict (chain_id, step_number) do nothing;

-- ----------------------------------------------------------------------------
-- Venues - the canonical list used by the proposal form and by the Phase 4
-- conflict checks. Names match the values used by the sample proposals.
-- ----------------------------------------------------------------------------
insert into public.venues (name, location) values
  ('Covered Court',      'Main quadrangle, in front of the chapel'),
  ('Multipurpose Hall',  'Student Center, 2nd floor'),
  ('AVR',                'Audio-Visual Room, Academic Building'),
  ('Quadrangle',         'Open field beside the administration building'),
  ('Gymnasium',          'Sports gymnasium, rear campus')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Sample accreditation checklist for the current school year (spec examples:
-- constitution, officer list, adviser acceptance, action plan, budget plan).
-- Organizations upload one file per item via accreditation_submissions.
-- ----------------------------------------------------------------------------
insert into public.accreditation_items (school_year_id, title, description, sort_order, is_required)
select sy.id, v.title, v.description, v.sort_order, v.is_required
from public.school_years sy
cross join (values
  ('Constitution and By-Laws', 'Notarized constitution and by-laws of the organization', 1, true),
  ('List of Officers',         'Complete list of officers for the current school year', 2, true),
  ('Adviser Acceptance',       'Signed acceptance letter of the faculty adviser', 3, true),
  ('Action Plan',              'Yearly action plan aligned with the school-year development plan', 4, true),
  ('Budget Plan',              'Detailed budget plan for the current school year', 5, true)
) as v(title, description, sort_order, is_required)
where sy.is_current
on conflict (school_year_id, title) do nothing;

-- ----------------------------------------------------------------------------
-- System settings (read by the app, editable by the Super Admin)
-- ----------------------------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('max_upload_mb', to_jsonb(10), 'Maximum size of an uploaded file in MB'),
  ('allowed_mime_types', to_jsonb(json_build_array(
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'image/jpeg',
     'image/png'
   )), 'File types accepted by every upload module'),
  ('require_hardcopy', to_jsonb(true), 'Submissions also need a paper copy delivered to OSA'),
  ('rate_limit_login_max', to_jsonb(5), 'Login attempts allowed per window'),
  ('rate_limit_login_window_seconds', to_jsonb(900), 'Login rate limit window in seconds')
on conflict (key) do nothing;

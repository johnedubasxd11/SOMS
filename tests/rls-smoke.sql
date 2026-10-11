-- SOMS - RLS / RPC smoke tests (rolled back, nothing is persisted)
-- run:  npm run test:rls
--   =   docker exec -i supabase_db_SOMS psql -U postgres -d postgres -f - < tests/rls-smoke.sql
--
-- Every actor and record id is resolved from the seed data at run time (psql
-- \gset variables), so the suite keeps working after any `npm run db:reset` -
-- organizations, profiles and records all get fresh gen_random_uuid() ids.

-- ---------------------------------------------------------------------------
-- Resolve the actors (requires npm run seed:auth first)
-- ---------------------------------------------------------------------------
select id as officer_lits  from profiles where email = 'president.lits@acd.edu.ph'  \gset
select id as officer_afphi from profiles where email = 'president.afphi@acd.edu.ph' \gset
select id as officer_aces  from profiles where email = 'president.aces@acd.edu.ph'  \gset
select id as adviser_lits  from profiles where email = 'adviser.lits@acd.edu.ph'    \gset
select id as adviser_afphi from profiles where email = 'adviser.afphi@acd.edu.ph'   \gset
select id as osa_admin     from profiles where email = 'osa.admin@acd.edu.ph'       \gset

-- Dean of whichever college AFPHI belongs to (seed: dean.<collegecode>@acd.edu.ph).
select p.id as dean_afphi
  from profiles p
  join organizations o on o.college_id = p.college_id
 where o.code = 'AFPHI' and p.role = 'dean' limit 1 \gset
select college_id as afphi_college from organizations where code = 'AFPHI' \gset

select id as lits_org      from organizations where code = 'LITS'  \gset
select id as afphi_org     from organizations where code = 'AFPHI' \gset

-- One proposal per organization (seed:auth cycles the workflow statuses by
-- organization code: AFPHI is always "submitted", ACES always "draft").
select p.id as afphi_proposal
  from activity_proposals p join organizations o on o.id = p.organization_id
 where o.code = 'AFPHI' limit 1 \gset
select p.id as aces_draft
  from activity_proposals p join organizations o on o.id = p.organization_id
 where o.code = 'ACES' and p.status = 'draft' limit 1 \gset

select id as current_year from school_years where is_current limit 1 \gset

\echo '### T1 officer of LITS - visibility (expect 1 / 0 / 0 / 0 / 2 / 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'visible_proposals' as check, count(*)::text as value from activity_proposals
union all select 'other_org_proposals', count(*)::text from activity_proposals where organization_id <> :'lits_org'
union all select 'audit_logs', count(*)::text from audit_logs
union all select 'others_notifications', count(*)::text from notifications where user_id <> :'officer_lits'
union all select 'visible_profiles', count(*)::text from profiles
union all select 'college_summary_rows', count(*)::text from v_activity_summary_by_college;
rollback;

\echo '### T2 officer writes to ANOTHER org (expect UPDATE 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update activity_proposals set title = title || ' HACK' where id = :'afphi_proposal';
select 'hack_markers' as check, count(*)::text as value from activity_proposals where title like '%HACK%';
rollback;

\echo '### T3 officer flips OWN draft status directly (expect ERROR from guard trigger)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_aces', 'role', 'authenticated')::text, true);
update activity_proposals set status = 'approved' where id = :'aces_draft';
rollback;

\echo '### T4 officer escalates own role (expect ERROR from profile guard)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update profiles set role = 'super_admin' where id = :'officer_lits';
rollback;

\echo '### T5 adviser approves OWN organization step 1 (expect: endorsed, pending step dean)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adviser_afphi', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'Endorsed by adviser.')::text as new_status;
select 'pending_step' as check, step_role::text as value from v_pending_approval
 where record_id = :'afphi_proposal';
rollback;

\echo '### T6 adviser of ANOTHER org approves AFPHI (expect ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adviser_lits', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'nope');
rollback;

\echo '### T7 officer approves OWN submission (expect ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'self-approve');
rollback;

\echo '### T8 OSA - visibility + cannot jump the adviser step (expect 18 rows / >0 logs, ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_visible_proposals' as check, count(*)::text as value from activity_proposals
union all select 'osa_audit_logs', count(*)::text from audit_logs;
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'OSA jumps the queue');
rollback;

\echo '### T9 OSA - college summary view (expect 6 colleges for the current year)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select college_name, organization_count::text, total_proposals::text
from v_activity_summary_by_college
where school_year_id = :'current_year'
order by college_name;
rollback;

\echo '### T10 documents - cross-org insert rejected (expect RLS error, then 0 rows)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
savepoint doc_insert;
insert into documents (bucket, storage_path, file_name, mime_type, size_bytes, doc_type,
                       record_type, record_id, organization_id, uploaded_by)
values ('submissions', :'afphi_org' || '/proposals/x/hack.png', 'hack.png',
        'image/png', 100, 'proposal', 'activity_proposal',
        :'afphi_proposal', :'afphi_org', :'officer_lits');
rollback to savepoint doc_insert;
select 'inserted' as check, count(*)::text as value from documents where storage_path like '%hack.png';
rollback;

\echo '### T11 anon rate limiter (expect allowed -> allowed -> ... -> blocked)'
begin;
set local role anon;
select check_rate_limit('login:demo@example.com', 2, 60, 60) as attempt1;
select check_rate_limit('login:demo@example.com', 2, 60, 60) as attempt2;
select check_rate_limit('login:demo@example.com', 2, 60, 60) as attempt3;
rollback;

\echo '### T12 anon sees NOTHING in public tables (expect "permission denied" - anon has no grants)'
begin;
set local role anon;
select 'colleges' as check, count(*)::text as value from colleges
union all select 'profiles', count(*)::text from profiles
union all select 'proposals', count(*)::text from activity_proposals;
rollback;

-- ============================================================================
-- Phase 5 - notifications, requirement reminders, audit trail
-- ============================================================================

\echo '### T13 officer cannot notify an org (expect ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select notify_org_officers(:'afphi_org', 'system', 'hijack', 'x', '/dashboard');
rollback;

\echo '### T14 officer cannot insert notifications directly (expect RLS error, then 0 rows)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
savepoint notif_insert;
insert into notifications (user_id, type, title) values
  (:'officer_lits', 'system', 'forged');
rollback to savepoint notif_insert;
select 'forged_notifications' as check, count(*)::text as value from notifications where title = 'forged';
rollback;

\echo '### T15 officer cannot mark someone else''s notification read (expect UPDATE 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update notifications set is_read = true, read_at = now() where user_id <> :'officer_lits';
select 'others_read' as check, count(*)::text as value from notifications where user_id <> :'officer_lits' and is_read;
rollback;

\echo '### T16 officer cannot write requirements (expect RLS error, then 0 rows - requirements_write is OSA)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
savepoint req_insert;
insert into requirements (organization_id, school_year_id, title) values
  (:'afphi_org', :'current_year', 'officer forged requirement');
rollback to savepoint req_insert;
select 'forged_requirements' as check, count(*)::text as value from requirements where title = 'officer forged requirement';
rollback;

\echo '### T17 officer cannot run the sweep (expect ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select sweep_requirements(3);
rollback;

\echo '### T18 officer cannot read audit logs (expect 0) / OSA can (expect > 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'officer_audit_rows' as check, count(*)::text as value from audit_logs;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_audit_rows' as check, count(*)::text as value from audit_logs;
rollback;

\echo '### T19 OSA notify_org_officers -> one row per active officer/adviser (expect ids > 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select count(*)::text as notified_ids
  from notify_org_officers(:'afphi_org', 'system', 'Phase 5 test', 'body', '/requirements');
rollback;

\echo '### T20 OSA sweep_requirements (expect integer >= 0, no exception)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select sweep_requirements(3)::text as reminders_created;
rollback;

-- ============================================================================
-- Phase 6 - summary views cover every school year, RLS still applies
-- ============================================================================

\echo '### T21 summary views - all school years, own-org counts only (expect 36/1/0 then 36/18/12 = 6 colleges x 2 years)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'officer_org_rows' as check, count(*)::text as value from v_organization_summary
union all select 'officer_proposal_total', coalesce(sum(total_proposals),0)::text from v_organization_summary
union all select 'officer_college_rows', count(*)::text from v_activity_summary_by_college;
rollback;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_org_rows' as check, count(*)::text as value from v_organization_summary
union all select 'osa_proposal_total', coalesce(sum(total_proposals),0)::text from v_organization_summary
union all select 'osa_college_rows', count(*)::text from v_activity_summary_by_college;
rollback;

-- ============================================================================
-- Phase 7 - per-role read scope for advisers + requirements
-- ============================================================================

\echo '### T22 adviser - visibility (expect 1 own-org / 0 other-org / 0 audit logs)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'adviser_lits', 'role', 'authenticated')::text, true);
select 'adviser_visible_proposals' as check, count(*)::text as value from activity_proposals
union all select 'adviser_other_org_proposals', count(*)::text from activity_proposals where organization_id <> :'lits_org'
union all select 'adviser_audit_logs', count(*)::text from audit_logs;
rollback;

\echo '### T23 requirements - OSA seeds two rows, the LITS officer sees 1 and edits 0'
begin;
set local role authenticated;
-- OSA creates one requirement for LITS and one for AFPHI.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
insert into requirements (organization_id, school_year_id, title) values
  (:'lits_org', :'current_year', 'T23 own-org requirement'),
  (:'afphi_org', :'current_year', 'T23 other-org requirement');
-- Same transaction, now acting as the LITS officer:
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update requirements set title = 'hijacked' where title like 'T23 %';
select 'officer_visible_t23' as check, count(*)::text as value from requirements where title like 'T23 %'
union all select 'officer_other_org_t23', count(*)::text from requirements
         where title like 'T23 %' and organization_id <> :'lits_org'
union all select 'officer_edited_titles', count(*)::text from requirements where title = 'hijacked';
rollback;

-- ============================================================================
-- Phase 8 - approval chains + dean role
-- ============================================================================

\echo '### T24 dean visibility - only the organizations of their college (expect 0 outside)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'dean_afphi', 'role', 'authenticated')::text, true);
select 'dean_outside_college_proposals' as check, count(*)::text as value
  from activity_proposals p
  join organizations o on o.id = p.organization_id
 where o.college_id <> :'afphi_college'
union all select 'dean_college_orgs', count(*)::text from organizations
         where college_id = :'afphi_college'
union all select 'dean_pending_steps', count(*)::text from v_pending_approval
         where step_role = 'dean';
rollback;

\echo '### T25 dean cannot approve BEFORE the adviser (expect ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'dean_afphi', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'dean jumps ahead');
rollback;

\echo '### T26 full chain - adviser -> dean -> OSA + hardcopy (expect endorsed / under_review / approved / uuid)'
begin;
set local role authenticated;
-- Step 1: the adviser endorses.
select set_config('request.jwt.claims', json_build_object('sub', :'adviser_afphi', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'Endorsed by adviser.')::text as after_adviser;
select 'step_after_adviser' as check, step_role::text as value
  from v_pending_approval where record_id = :'afphi_proposal';
-- Step 2: the dean of AFPHI's college approves.
select set_config('request.jwt.claims', json_build_object('sub', :'dean_afphi', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'Cleared by the dean.')::text as after_dean;
select 'step_after_dean' as check, step_role::text as value
  from v_pending_approval where record_id = :'afphi_proposal';
-- Step 3: OSA makes the final decision.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select transition_submission('activity_proposal', :'afphi_proposal', 'approved', 'Approved by OSA.')::text as after_osa;
select 'pending_after_osa' as check, count(*)::text as value
  from v_pending_approval where record_id = :'afphi_proposal';
select mark_hardcopy_received('activity_proposal', :'afphi_proposal', 'OSA Front Desk', 'paper copy in')::text as hardcopy_id;
select 'copy_status' as check, copy_status::text as value from v_activity_proposal_list where id = :'afphi_proposal';
rollback;

\echo '### T27 approval_records - only the RPCs may write (expect both attempts blocked, 0 forged rows)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
savepoint record_update;
update approval_records set status = 'approved' where record_id = :'afphi_proposal';
rollback to savepoint record_update;
select 'record_updates' as check, count(*)::text as value
  from approval_records where record_id = :'afphi_proposal' and acted_by = :'osa_admin';
savepoint record_insert;
insert into approval_records (record_type, record_id, organization_id, step_number, step_role)
  values ('activity_proposal', :'afphi_proposal', :'afphi_org', 9, 'osa_admin');
rollback to savepoint record_insert;
select 'forged_rows' as check, count(*)::text as value
  from approval_records where step_number = 9;
rollback;

\echo '### T28 dean can comment, officer cannot (expect void then ERROR 42501)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'dean_afphi', 'role', 'authenticated')::text, true);
select add_review_comment('activity_proposal', :'afphi_proposal', 'Dean remark without a status change.') as dean_comment;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
select add_review_comment('activity_proposal', :'afphi_proposal', 'officer tries to comment');
rollback;

\echo '### T29 chains - officer cannot edit steps, OSA can reorder (expect 0 forged, then adviser>osa_admin)'
begin;
set local role authenticated;
-- Officer insert attempt is blocked by RLS (only OSA may write chains).
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
savepoint officer_chain_insert;
insert into approval_chain_steps (chain_id, step_number, step_role)
select id, 9, 'dean' from approval_chains where record_type = 'activity_proposal';
rollback to savepoint officer_chain_insert;
select 'officer_forged_steps' as check, count(*)::text as value
  from approval_chain_steps where step_number = 9;
-- OSA reorders the proposal chain: adviser -> OSA (drops the dean step).
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
delete from approval_chain_steps where chain_id =
  (select id from approval_chains where record_type = 'activity_proposal');
insert into approval_chain_steps (chain_id, step_number, step_role)
select id, 1, 'adviser' from approval_chains where record_type = 'activity_proposal';
insert into approval_chain_steps (chain_id, step_number, step_role)
select id, 2, 'osa_admin' from approval_chains where record_type = 'activity_proposal';
select 'proposal_chain' as check, string_agg(step_role::text, '>' order by step_number) as value
  from approval_chain_steps
 where chain_id = (select id from approval_chains where record_type = 'activity_proposal');
rollback;

-- ---------------------------------------------------------------------------
-- Phase 1 checkpoint: RLS on every table + the foundation tables added by
-- 20261010000100_phase1_foundation_tables.sql
-- ---------------------------------------------------------------------------

\echo '### T30 Phase 1 checkpoint - RLS enabled on EVERY public table (expect 0)'
select count(*) as check_value
  from pg_tables
 where schemaname = 'public' and rowsecurity = false;

\echo '### T31 accreditation - officer of LITS sees only own org upload (expect 1)'
begin;
insert into accreditation_items (school_year_id, title, sort_order)
values (:'current_year', 'T31 checklist item', 99)
returning id as t31_item \gset
insert into accreditation_submissions (item_id, organization_id, storage_path, file_name, mime_type, size_bytes, submitted_by)
values
  (:'t31_item', :'lits_org',  'lits/t31/a.pdf',  'a.pdf', 'application/pdf', 10, :'officer_lits'),
  (:'t31_item', :'afphi_org', 'afphi/t31/b.pdf', 'b.pdf', 'application/pdf', 10, :'officer_afphi');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'accreditation_visible' as check, count(*)::text as value from accreditation_submissions;
-- Officer may not approve their own upload (RLS rejects the UPDATE outright).
savepoint officer_accr_update;
update accreditation_submissions set status = 'approved' where organization_id = :'lits_org';
rollback to savepoint officer_accr_update;
-- OSA reviews: approves LITS, rejects AFPHI.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'approved', reviewed_by = :'osa_admin', reviewed_at = now()
 where organization_id = :'lits_org';
update accreditation_submissions set status = 'rejected', remarks = 'Illegible scan.', reviewed_by = :'osa_admin', reviewed_at = now()
 where organization_id = :'afphi_org';
select 'lits_status' as check, status::text as value
  from accreditation_submissions where organization_id = :'lits_org'
union all
select 'afphi_status', status::text
  from accreditation_submissions where organization_id = :'afphi_org';
rollback;

\echo '### T32 venues - officer cannot insert, OSA can (expect ERROR, then 1)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
savepoint officer_venue_insert;
insert into venues (name) values ('Officer-added venue');
rollback to savepoint officer_venue_insert;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
insert into venues (name) values ('OSA-added venue');
select 'venue_inserted' as check, count(*)::text as value from venues where name = 'OSA-added venue';
rollback;

\echo '### T33 announcements - expired announcements hide from officers but stay with OSA (expect 0 / 1)'
begin;
-- Expire the seeded sample while still postgres (no client role set).
update announcements set expires_at = now() - interval '1 day'
 where title like 'OSA Advisory%';
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'officer_sees_expired' as check, count(*)::text as value from announcements;
savepoint officer_announcement_insert;
insert into announcements (title, body) values ('Forged announcement', 'should not be possible');
rollback to savepoint officer_announcement_insert;
select 'forged_announcements' as check, count(*)::text as value from announcements where title = 'Forged announcement';
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_sees_expired' as check, count(*)::text as value from announcements;
rollback;

-- ---------------------------------------------------------------------------
-- Phase 4 - calendar venues + conflict detection
-- (20261010000200_phase4_calendar_venues.sql)
-- ---------------------------------------------------------------------------

\echo '### T34 venue conflicts - overlapping submit refused, non-overlapping fine (expect submitted / ERROR / submitted)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
insert into venues (name) values ('T34 Grand Hall') returning id as t34_venue \gset
-- AFPHI books the hall first - no conflict yet, so the submit succeeds.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
insert into activity_proposals (organization_id, school_year_id, created_by, title, activity_date,
                                start_time, end_time, venue, venue_id)
values (:'afphi_org', :'current_year', :'officer_afphi', 'T34 AFPHI booking', '2027-03-01',
        '09:00', '12:00', 'T34 Grand Hall', :'t34_venue')
returning id as t34_a \gset
select transition_submission('activity_proposal', :'t34_a', 'submitted', 'T34 first booking')::text as t34_a_status;
-- LITS tries an overlapping slot: the enforce_venue_conflict trigger blocks it.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
insert into activity_proposals (organization_id, school_year_id, created_by, title, activity_date,
                                start_time, end_time, venue, venue_id)
values (:'lits_org', :'current_year', :'officer_lits', 'T34 LITS double booking', '2027-03-01',
        '10:00', '13:00', 'T34 Grand Hall', :'t34_venue')
returning id as t34_b \gset
savepoint t34_conflict;
select transition_submission('activity_proposal', :'t34_b', 'submitted', 'T34 overlapping')::text as t34_b_status;
rollback to savepoint t34_conflict;
-- A later slot the same day is free - that submit goes through.
insert into activity_proposals (organization_id, school_year_id, created_by, title, activity_date,
                                start_time, end_time, venue, venue_id)
values (:'lits_org', :'current_year', :'officer_lits', 'T34 LITS later slot', '2027-03-01',
        '13:00', '15:00', 'T34 Grand Hall', :'t34_venue')
returning id as t34_c \gset
select transition_submission('activity_proposal', :'t34_c', 'submitted', 'T34 non-overlapping')::text as t34_c_status;
-- Live warning: the overlapping slot reports exactly the one blocking booking;
-- a null-window query is whole-day and overlaps everything that day.
select 'warn_overlap' as check, count(*)::text as value
  from find_venue_conflicts(:'t34_venue', '2027-03-01', '10:00', '11:00', null);
select 'warn_whole_day' as check, count(*)::text as value
  from find_venue_conflicts(:'t34_venue', '2027-03-01', null, null, null);
rollback;

\echo '### T35 conflict register + warning RPC visibility (expect 1 / 0 / 2 / 2)'
begin;
-- Recreate a conflict that only direct writes could produce (legacy data or a
-- venue attached after submit): the trigger guards submits, not historical rows.
alter table public.activity_proposals disable trigger guard_submission_change;
alter table public.activity_proposals disable trigger enforce_venue_conflict;
insert into venues (name) values ('T35 Contested Hall') returning id as t35_venue \gset
insert into activity_proposals (organization_id, school_year_id, created_by, title, activity_date,
                                start_time, end_time, venue, venue_id, status)
values (:'afphi_org', :'current_year', :'officer_afphi', 'T35 AFPHI booking', '2027-04-05',
        '09:00', '12:00', 'T35 Contested Hall', :'t35_venue', 'submitted'),
       (:'lits_org',  :'current_year', :'officer_lits',  'T35 LITS booking',  '2027-04-05',
        '10:00', '13:00', 'T35 Contested Hall', :'t35_venue', 'submitted');
alter table public.activity_proposals enable trigger guard_submission_change;
alter table public.activity_proposals enable trigger enforce_venue_conflict;
set local role authenticated;
-- OSA sees every proposal, so the pair shows in the register.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_pairs' as check, count(*)::text as value from v_venue_conflicts;
-- An officer only sees pairs where BOTH sides are visible to them.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'officer_pairs' as check, count(*)::text as value from v_venue_conflicts;
-- The live warning RPC is SECURITY DEFINER so any signed-in user gets the
-- blocking booking (that is what the form warning is built on).
select 'officer_warning' as check, count(*)::text as value
  from find_venue_conflicts(:'t35_venue', '2027-04-05', '10:30', '11:00', null);
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
select 'afphi_warning' as check, count(*)::text as value
  from find_venue_conflicts(:'t35_venue', '2027-04-05', '10:30', '11:00', null);
rollback;

-- ---------------------------------------------------------------------------
-- Phase 5 - attachment versioning (documents parent_id / version / is_active)
-- ---------------------------------------------------------------------------

\echo '### T36 documents - new version supersedes, old version stays readable (expect 1 / 1 / 2 / 0 / 2)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
-- v1 upload on own proposal.
insert into documents (bucket, storage_path, file_name, mime_type, size_bytes, doc_type,
                       record_type, record_id, organization_id, uploaded_by, version, is_active)
values ('submissions', 'afphi/t36/v1.pdf', 't36-program.pdf', 'application/pdf', 1234, 'proposal',
        'activity_proposal', :'afphi_proposal', :'afphi_org', :'officer_afphi', 1, true)
returning id as t36_v1 \gset
-- v2 upload: same logical file, parent link, then the old row goes inactive -
-- exactly what uploadAttachmentAction does. The old storage row is NOT deleted.
insert into documents (bucket, storage_path, file_name, mime_type, size_bytes, doc_type,
                       record_type, record_id, organization_id, uploaded_by, version, is_active, parent_id)
values ('submissions', 'afphi/t36/v2.pdf', 't36-program.pdf', 'application/pdf', 2345, 'proposal',
        'activity_proposal', :'afphi_proposal', :'afphi_org', :'officer_afphi', 2, true, :'t36_v1')
returning id as t36_v2 \gset
update documents set is_active = false where id = :'t36_v1';
select 'old_version_readable' as check, count(*)::text as value from documents where id = :'t36_v1';
select 'active_is_newest' as check, version::text as value
  from documents where id = :'t36_v2' and is_active;
select 'active_count' as check, count(*)::text as value
  from documents
 where record_type = 'activity_proposal' and record_id = :'afphi_proposal' and is_active;
select 'latest_view' as check, count(*)::text as value
  from v_document_latest where record_type = 'activity_proposal' and record_id = :'afphi_proposal';
-- Another org's officer can read neither version.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'cross_org_reads' as check, count(*)::text as value
  from documents where id in (:'t36_v1', :'t36_v2');
-- OSA keeps the full audit trail.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
select 'osa_audit_trail' as check, count(*)::text as value
  from documents where id in (:'t36_v1', :'t36_v2');
rollback;

-- ---------------------------------------------------------------------------
-- Phase 7 - template library (every signed-in user reads, only OSA writes)
-- ---------------------------------------------------------------------------

\echo '### T37 templates - everyone reads the active version, only OSA writes (expect >=1 / ERROR / 1 / 0)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- Officer sees the seeded template.
select 'officer_visible_templates' as check, count(*)::text as value
  from templates where is_active;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- Officer cannot insert a template (RLS write is OSA-only).
insert into templates (name, category, storage_path, file_name, mime_type, size_bytes)
values ('T37 officer template', 'other', 't37/officer.pdf', 't37.pdf', 'application/pdf', 10);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
-- OSA inserts a template, then the version row + parent link.
insert into templates (name, category, storage_path, file_name, mime_type, size_bytes, version, is_active)
values ('T37 template', 'other', 't37/v1.pdf', 't37.pdf', 'application/pdf', 10, 1, true)
returning id as t37_v1 \gset
insert into templates (name, category, storage_path, file_name, mime_type, size_bytes, version, is_active, parent_id)
values ('T37 template', 'other', 't37/v2.pdf', 't37.pdf', 'application/pdf', 20, 2, true, :'t37_v1')
returning id as t37_v2 \gset
update templates set is_active = false where id = :'t37_v1';
select 'osa_inserted_versions' as check, count(*)::text as value
  from templates where name = 'T37 template';
-- An officer of a different org still sees the active version (templates are
-- world-readable within the signed-in community).
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
select 'afphi_sees_active' as check, count(*)::text as value
  from templates where name = 'T37 template' and is_active;
rollback;

-- ---------------------------------------------------------------------------
-- Phase 7 - announcement notifications (notify_announcement_recipients)
-- ---------------------------------------------------------------------------

\echo '### T38 announcements - targeted notify reaches the right users only (expect 1 / 0 / >=1 / 0 / ERROR / ERROR)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
-- OSA posts an organization-targeted announcement for LITS.
insert into announcements (title, body, target_type, created_by)
values ('T38 LITS bulletin', 'Targeted test announcement.', 'organization', :'osa_admin')
returning id as t38_ann \gset
insert into announcement_targets (announcement_id, organization_id)
values (:'t38_ann', :'lits_org');
-- The RPC fans out to LITS officers + advisers (not AFPHI).
select notify_announcement_recipients(:'t38_ann') as t38_notified;
-- LITS officer sees the announcement and got a notification.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
select 'lits_sees_announcement' as check, count(*)::text as value
  from announcements where id = :'t38_ann';
select 'lits_notified' as check, count(*)::text as value
  from notifications where user_id = :'officer_lits' and title = 'T38 LITS bulletin';
-- AFPHI officer sees neither.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
select 'afphi_sees_announcement' as check, count(*)::text as value
  from announcements where id = :'t38_ann';
select 'afphi_notified' as check, count(*)::text as value
  from notifications where user_id = :'officer_afphi' and title = 'T38 LITS bulletin';
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- An officer cannot call the broadcast RPC.
select notify_announcement_recipients(gen_random_uuid());
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- An officer cannot insert announcements directly.
insert into announcements (title, body, target_type, created_by)
values ('T38 officer announcement', 'Should be refused.', 'all', :'officer_lits');
rollback;

-- ---------------------------------------------------------------------------
-- Phase 6 - accreditation checklist (org uploads, OSA approves, guards hold)
-- ---------------------------------------------------------------------------

\echo '### T39 accreditation - upload / review guards (expect 1 / 0 / ERROR / pending / pending / 0 / approved)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
-- OSA publishes one checklist item for the current year.
insert into accreditation_items (school_year_id, title, description, sort_order, is_required)
values (:'current_year', 'T39 Constitution', 'Notarized copy.', 99, true)
returning id as t39_item \gset

-- LITS officer uploads (always inserted as pending).
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
insert into accreditation_submissions (item_id, organization_id, storage_path, file_name, mime_type, size_bytes, submitted_by)
values (:'t39_item', :'lits_org', :'lits_org' || '/accreditation/t39/v1.pdf', 'constitution.pdf', 'application/pdf', 100, :'officer_lits')
returning id as t39_sub \gset
select 'officer_sees_own_upload' as check, count(*)::text as value
  from accreditation_submissions where id = :'t39_sub';

-- AFPHI officer cannot see nor touch the LITS upload.
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'approved' where id = :'t39_sub';
select 'cross_org_status_flips' as check, count(*)::text as value
  from accreditation_submissions where id = :'t39_sub' and status = 'approved';

-- The uploading org cannot self-approve (guard trigger).
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'approved' where id = :'t39_sub';
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
insert into accreditation_items (school_year_id, title, sort_order)
values (:'current_year', 'T39b By-Laws', 100)
returning id as t39_item \gset
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
insert into accreditation_submissions (item_id, organization_id, storage_path, file_name, mime_type, size_bytes, submitted_by)
values (:'t39_item', :'lits_org', :'lits_org' || '/accreditation/t39b/v1.pdf', 'by-laws.pdf', 'application/pdf', 100, :'officer_lits')
returning id as t39_sub \gset
-- Replace while pending: back to pending with a new storage path (allowed).
update accreditation_submissions
   set storage_path = :'lits_org' || '/accreditation/t39b/v2.pdf', status = 'pending'
 where id = :'t39_sub';
select 'replace_pending_stays_pending' as check, status::text as value
  from accreditation_submissions where id = :'t39_sub';
-- OSA rejects with remarks; the org replaces a rejected upload (back to pending).
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'rejected', remarks = 'Illegible.', reviewed_by = :'osa_admin', reviewed_at = now()
 where id = :'t39_sub';
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update accreditation_submissions
   set storage_path = :'lits_org' || '/accreditation/t39b/v3.pdf', status = 'pending', remarks = null
 where id = :'t39_sub';
select 'replace_rejected_back_to_pending' as check, status::text as value
  from accreditation_submissions where id = :'t39_sub';
-- Once OSA approves, the row freezes for the organization (RLS using drops it).
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'approved', reviewed_by = :'osa_admin', reviewed_at = now()
 where id = :'t39_sub';
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
update accreditation_submissions set status = 'pending' where id = :'t39_sub';
select 'approved_frozen_for_org' as check, status::text as value
  from accreditation_submissions where id = :'t39_sub';
rollback;

-- ---------------------------------------------------------------------------
-- Phase 6 - officer-term turnover (draft <-> submitted, members frozen)
-- ---------------------------------------------------------------------------

\echo '### T40 officer terms - transitions + member freeze (expect draft / submitted / 2 / 0 / ERROR / approved)'
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- LITS officers create the draft list and two members.
insert into officer_terms (organization_id, school_year_id, status, submitted_by)
values (:'lits_org', :'current_year', 'draft', :'officer_lits')
returning id as t40_term \gset
insert into officer_term_members (term_id, full_name, position, sort_order)
values (:'t40_term', 'T40 President', 'President', 0),
       (:'t40_term', 'T40 Secretary', 'Secretary', 1);
select 'term_starts_draft' as check, status::text as value from officer_terms where id = :'t40_term';
select 'member_count' as check, count(*)::text as value from officer_term_members where term_id = :'t40_term';
-- Submit: draft -> submitted is allowed for officers.
update officer_terms set status = 'submitted', submitted_at = now() where id = :'t40_term';
select 'submitted' as check, status::text as value from officer_terms where id = :'t40_term';
-- Members are frozen once the list leaves draft (RLS: 0 rows, no error).
update officer_term_members set full_name = 'T40 Hacked' where term_id = :'t40_term';
select 'frozen_member_edits' as check, count(*)::text as value
  from officer_term_members where term_id = :'t40_term' and full_name = 'T40 Hacked';
-- Officers cannot approve their own list (guard trigger).
update officer_terms set status = 'approved' where id = :'t40_term';
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_afphi', 'role', 'authenticated')::text, true);
insert into officer_terms (organization_id, school_year_id, status, submitted_by)
values (:'afphi_org', :'current_year', 'draft', :'officer_afphi')
returning id as t40_term \gset
insert into officer_term_members (term_id, full_name, position, sort_order)
values (:'t40_term', 'T40 AFPHI President', 'President', 0);
update officer_terms set status = 'submitted', submitted_at = now() where id = :'t40_term';
-- OSA approves the submitted list.
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
update officer_terms set status = 'approved', reviewed_by = :'osa_admin', reviewed_at = now() where id = :'t40_term';
select 'osa_approved' as check, status::text as value from officer_terms where id = :'t40_term';
-- OSA cannot move approved back to submitted (guard) - only to draft.
update officer_terms set status = 'submitted' where id = :'t40_term';
rollback;

-- ---------------------------------------------------------------------------
-- Phase 6 - archived school years are read-only (trigger on every year table)
-- ---------------------------------------------------------------------------

\echo '### T41 archived year - writes refused, service role still passes (expect ERROR / ERROR / 1 / 1)'
begin;
-- Seed one archived year (postgres bypasses RLS; the guard skips without a uid).
insert into school_years (name, start_date, end_date, is_current, is_archived)
values ('1999-2000', '1999-06-01', '2000-03-31', false, true)
returning id as t41_year \gset

savepoint t41_officer;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'officer_lits', 'role', 'authenticated')::text, true);
-- Insert into the archived year is refused for a signed-in user.
insert into requirements (organization_id, school_year_id, title)
values (:'lits_org', :'t41_year', 'T41 requirement');
rollback to t41_officer;

savepoint t41_osa;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'osa_admin', 'role', 'authenticated')::text, true);
-- Even OSA cannot write into an archived year while signed in.
insert into accreditation_items (school_year_id, title)
values (:'t41_year', 'T41 archived item');
rollback to t41_osa;

-- Back to the postgres session: service role / migrations (auth.uid() is null)
-- may still write - archival data fixes.
reset role;
insert into requirements (organization_id, school_year_id, title)
values (:'lits_org', :'t41_year', 'T41 backfill')
returning id as t41_req \gset
select 'service_role_insert' as check, count(*)::text as value from requirements where id = :'t41_req';
update requirements set title = 'T41 backfill v2' where id = :'t41_req';
select 'service_role_update' as check, title as value from requirements where id = :'t41_req';
rollback;

-- ============================================================================
-- SOMS - Views (search lists, hardcopy badges, report summaries)
-- Phase 1 migration 4/5.
--
-- Every view uses security_invoker = true, so the RLS policies of the base
-- tables are evaluated as the calling user - a view can never widen access.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Submission lists: joined with org / college / school year, the hardcopy
-- record and a derived badge:
--   softcopy_only      - digital copy only
--   hardcopy_received  - paper copy logged by OSA (not approved yet)
--   complete           - approved AND paper copy received
-- ----------------------------------------------------------------------------
create or replace view public.v_activity_proposal_list
with (security_invoker = true) as
select
  p.*,
  o.name   as organization_name,
  o.code   as organization_code,
  c.name   as college_name,
  sy.name  as school_year_name,
  pr.full_name as created_by_name,
  coalesce(h.received, false) as hardcopy_received,
  h.received_at  as hardcopy_received_at,
  h.receiver_name as hardcopy_receiver_name,
  case
    when coalesce(h.received, false) and p.status = 'approved' then 'complete'::public.copy_status
    when coalesce(h.received, false) then 'hardcopy_received'::public.copy_status
    else 'softcopy_only'::public.copy_status
  end as copy_status,
  (select count(*) from public.documents d
    where d.record_type = 'activity_proposal' and d.record_id = p.id and d.is_active) as attachment_count
from public.activity_proposals p
join public.organizations o on o.id = p.organization_id
join public.colleges c      on c.id = o.college_id
join public.school_years sy on sy.id = p.school_year_id
left join public.profiles pr on pr.id = p.created_by
left join public.hardcopy_records h
       on h.record_type = 'activity_proposal' and h.record_id = p.id;

create or replace view public.v_accomplishment_report_list
with (security_invoker = true) as
select
  r.*,
  o.name   as organization_name,
  o.code   as organization_code,
  c.name   as college_name,
  sy.name  as school_year_name,
  pr.full_name as created_by_name,
  ap.title as activity_title,
  coalesce(h.received, false) as hardcopy_received,
  h.received_at  as hardcopy_received_at,
  h.receiver_name as hardcopy_receiver_name,
  case
    when coalesce(h.received, false) and r.status = 'approved' then 'complete'::public.copy_status
    when coalesce(h.received, false) then 'hardcopy_received'::public.copy_status
    else 'softcopy_only'::public.copy_status
  end as copy_status,
  (select count(*) from public.documents d
    where d.record_type = 'accomplishment_report' and d.record_id = r.id and d.is_active) as attachment_count
from public.accomplishment_reports r
join public.organizations o on o.id = r.organization_id
join public.colleges c      on c.id = o.college_id
join public.school_years sy on sy.id = r.school_year_id
left join public.profiles pr on pr.id = r.created_by
left join public.activity_proposals ap on ap.id = r.proposal_id
left join public.hardcopy_records h
       on h.record_type = 'accomplishment_report' and h.record_id = r.id;

create or replace view public.v_audit_document_list
with (security_invoker = true) as
select
  a.*,
  o.name   as organization_name,
  o.code   as organization_code,
  c.name   as college_name,
  sy.name  as school_year_name,
  pr.full_name as created_by_name,
  coalesce(h.received, false) as hardcopy_received,
  h.received_at  as hardcopy_received_at,
  h.receiver_name as hardcopy_receiver_name,
  case
    when coalesce(h.received, false) and a.status = 'approved' then 'complete'::public.copy_status
    when coalesce(h.received, false) then 'hardcopy_received'::public.copy_status
    else 'softcopy_only'::public.copy_status
  end as copy_status,
  (select count(*) from public.documents d
    where d.record_type = 'audit_document' and d.record_id = a.id and d.is_active) as attachment_count
from public.audit_documents a
join public.organizations o on o.id = a.organization_id
join public.colleges c      on c.id = o.college_id
join public.school_years sy on sy.id = a.school_year_id
left join public.profiles pr on pr.id = a.created_by
left join public.hardcopy_records h
       on h.record_type = 'audit_document' and h.record_id = a.id;

create or replace view public.v_other_document_list
with (security_invoker = true) as
select
  d.*,
  o.name   as organization_name,
  o.code   as organization_code,
  c.name   as college_name,
  sy.name  as school_year_name,
  pr.full_name as created_by_name,
  coalesce(h.received, false) as hardcopy_received,
  h.received_at  as hardcopy_received_at,
  case
    when coalesce(h.received, false) and d.status = 'approved' then 'complete'::public.copy_status
    when coalesce(h.received, false) then 'hardcopy_received'::public.copy_status
    else 'softcopy_only'::public.copy_status
  end as copy_status,
  (select count(*) from public.documents f
    where f.record_type = 'other_document' and f.record_id = d.id and f.is_active) as attachment_count
from public.other_documents d
join public.organizations o on o.id = d.organization_id
join public.colleges c      on c.id = o.college_id
join public.school_years sy on sy.id = d.school_year_id
left join public.profiles pr on pr.id = d.created_by
left join public.hardcopy_records h
       on h.record_type = 'other_document' and h.record_id = d.id;

-- ----------------------------------------------------------------------------
-- Documents: the newest version of every logical file (a file whose parent
-- has no child is the tail of its version chain).
-- ----------------------------------------------------------------------------
create or replace view public.v_document_latest
with (security_invoker = true) as
select d.*
from public.documents d
left join public.documents child on child.parent_id = d.id
where child.id is null;

-- ----------------------------------------------------------------------------
-- Organization report: one row per organization per school year with
-- proposal / report / audit / requirement counters (module 4 - reports).
-- ----------------------------------------------------------------------------
create or replace view public.v_organization_summary
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
where o.is_active and sy.is_current;

-- ----------------------------------------------------------------------------
-- College-wide summary (OSA only - officers must not see other orgs' totals)
-- ----------------------------------------------------------------------------
create or replace view public.v_activity_summary_by_college
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
join public.school_years sy on sy.is_current
join public.v_organization_summary s
  on s.organization_id = o.id and s.school_year_id = sy.id
where public.is_osa()
group by c.id, c.code, c.name, sy.id, sy.name;

-- ----------------------------------------------------------------------------
-- Grants (views are not covered by table grants)
-- ----------------------------------------------------------------------------
grant select on
  public.v_activity_proposal_list,
  public.v_accomplishment_report_list,
  public.v_audit_document_list,
  public.v_other_document_list,
  public.v_document_latest,
  public.v_organization_summary,
  public.v_activity_summary_by_college
to authenticated;

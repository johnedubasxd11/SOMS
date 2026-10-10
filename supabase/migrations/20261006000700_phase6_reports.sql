-- SOMS - Phase 6: reports
--
-- Both summary views were pinned to the current school year. The OSA report
-- screen must summarise ANY school year, so they now cross join every school
-- year row and the caller picks one with `school_year_id = ...`.
--
-- Nothing else changes: same columns (so `create or replace` is legal), same
-- security_invoker behaviour (RLS of the querying user applies inside the
-- aggregates - an officer still only sums rows they can read), and the college
-- view keeps its `is_osa()` guard, so officers still see zero rows there.
--
-- Consumers:
--   src/app/(app)/osa/reports/page.tsx        filters both by school_year_id
--   src/app/api/exports/summary/route.ts      same queries, Excel + PDF
--   src/app/(app)/organizations/[id]/page.tsx must now filter by school_year_id
--                                               (it used maybeSingle() on the view)

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
where o.is_active;

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
cross join public.school_years sy
join public.v_organization_summary s
  on s.organization_id = o.id and s.school_year_id = sy.id
where public.is_osa()
group by c.id, c.code, c.name, sy.id, sy.name;

-- ============================================================================
-- SOMS - Phase 4: calendar and venue conflict detection.
--
--   1. activity_proposals.venue_id      - links the free-text venue to the
--                                         canonical `venues` row (nullable:
--                                         off-campus activities stay free text)
--   2. find_venue_conflicts()           - SECURITY DEFINER RPC used by the
--                                         proposal form's live warning
--   3. enforce_venue_conflict() trigger - blocks a submit that would
--                                         double-book a venue (the only path
--                                         to status = 'submitted' is
--                                         transition_submission())
--   4. v_venue_conflicts                - every overlapping pair, for OSA's
--                                         conflict register
--   5. v_calendar_events                - now carries college + venue ids so
--                                         the calendar screen can filter
--
-- Conflict semantics (documented, not incidental):
--   * only proposals that are in flight or approved block a slot
--     (submitted / endorsed / under_review / approved) - drafts, revisions,
--     rejections and withdrawals never hold a venue;
--   * a missing start/end is treated as the whole day (00:00-24:00);
--   * intervals overlap when start < other.end AND other.start < end.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Link proposals to the canonical venue list.
-- ----------------------------------------------------------------------------
alter table public.activity_proposals
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

create index if not exists proposals_venue_idx
  on public.activity_proposals (venue_id, activity_date)
  where venue_id is not null;

comment on column public.activity_proposals.venue_id is
  'Canonical venue (Phase 4 conflict checks). NULL = off-campus / free text.';

-- ----------------------------------------------------------------------------
-- 2. find_venue_conflicts() - the candidate slot vs. every live booking.
--    Granted to authenticated: the form asks BEFORE submitting, and the
--    answer (title + reference + organization of a blocking booking) is the
--    same information the calendar already shows for approved events.
-- ----------------------------------------------------------------------------
create or replace function public.find_venue_conflicts(
  p_venue_id uuid,
  p_date date,
  p_start time default null,
  p_end time default null,
  p_exclude_id uuid default null
)
returns table (
  record_id         uuid,
  reference_number  text,
  title             text,
  organization_name text,
  status            public.submission_status,
  start_time        time,
  end_time          time
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.reference_number, p.title, o.name, p.status, p.start_time, p.end_time
    from public.activity_proposals p
    join public.organizations o on o.id = p.organization_id
   where p.venue_id = p_venue_id
     and p.activity_date = p_date
     and p.status in ('submitted', 'endorsed', 'under_review', 'approved')
     and (p_exclude_id is null or p.id <> p_exclude_id)
     and coalesce(p.start_time, '00:00'::time) < coalesce(p_end,   '24:00'::time)
     and coalesce(p_start,    '00:00'::time) < coalesce(p.end_time, '24:00'::time)
   order by p.start_time nulls first, p.created_at;
$$;

revoke all on function public.find_venue_conflicts(uuid, date, time, time, uuid)
  from public, anon;
grant execute on function public.find_venue_conflicts(uuid, date, time, time, uuid)
  to authenticated, service_role;

comment on function public.find_venue_conflicts(uuid, date, time, time, uuid) is
  'Live bookings of one venue slot that would be double-booked by a proposal (used by the form warning and the submit guard).';

-- ----------------------------------------------------------------------------
-- 3. Server-side check on submit: BEFORE UPDATE trigger on activity_proposals.
--    transition_submission() is the only writer that may move status, so a
--    guard trigger is exactly as strong as the workflow engine - and it keeps
--    working even if a future RPC forgets to check.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_venue_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict record;
  v_details  text := '';
begin
  if NEW.status = 'submitted'
     and OLD.status in ('draft', 'revision_requested')
     and NEW.venue_id is not null then

    for v_conflict in
      select * from public.find_venue_conflicts(
        NEW.venue_id, NEW.activity_date, NEW.start_time, NEW.end_time, NEW.id
      )
    loop
      v_details := v_details || format(
        '%s (%s) is already booked %s by %s; ',
        v_conflict.title,
        v_conflict.reference_number,
        case
          when v_conflict.start_time is null and v_conflict.end_time is null
            then 'for the whole day'
          else format('%s-%s',
                 coalesce(to_char(v_conflict.start_time, 'HH24:MI'), '00:00'),
                 coalesce(to_char(v_conflict.end_time,   'HH24:MI'), '24:00'))
        end,
        v_conflict.organization_name
      );
    end loop;

    if v_details <> '' then
      raise exception 'Venue conflict: % pick another venue or time slot before submitting',
        v_details
        using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_venue_conflict on public.activity_proposals;
create trigger enforce_venue_conflict
  before update of status, venue_id, activity_date, start_time, end_time
  on public.activity_proposals
  for each row
  execute function public.enforce_venue_conflict();

-- ----------------------------------------------------------------------------
-- 4. v_venue_conflicts - every overlapping pair, for the OSA register.
--    security_invoker: officers/advisers only ever see pairs they could see
--    as proposals; OSA (which sees every proposal) sees every conflict.
-- ----------------------------------------------------------------------------
create or replace view public.v_venue_conflicts
with (security_invoker = true) as
select
  a.id                    as proposal_id,
  a.reference_number,
  a.title,
  a.organization_id,
  o.name                  as organization_name,
  b.id                    as conflicting_id,
  b.reference_number      as conflicting_reference,
  b.title                 as conflicting_title,
  b.organization_id       as conflicting_organization_id,
  o2.name                 as conflicting_organization_name,
  a.venue_id,
  v.name                  as venue_name,
  a.activity_date,
  greatest(coalesce(a.start_time, '00:00'::time),
           coalesce(b.start_time, '00:00'::time)) as overlap_start,
  least(coalesce(a.end_time, '24:00'::time),
        coalesce(b.end_time, '24:00'::time))     as overlap_end,
  a.status,
  b.status                as conflicting_status
from public.activity_proposals a
join public.activity_proposals b
  on b.venue_id      = a.venue_id
 and b.activity_date = a.activity_date
 and a.id < b.id
 and a.status in ('submitted', 'endorsed', 'under_review', 'approved')
 and b.status in ('submitted', 'endorsed', 'under_review', 'approved')
 and coalesce(a.start_time, '00:00'::time) < coalesce(b.end_time,   '24:00'::time)
 and coalesce(b.start_time, '00:00'::time) < coalesce(a.end_time,   '24:00'::time)
join public.venues v          on v.id  = a.venue_id
join public.organizations o   on o.id  = a.organization_id
join public.organizations o2  on o2.id = b.organization_id;

grant select on public.v_venue_conflicts to authenticated;

-- ----------------------------------------------------------------------------
-- 5. v_calendar_events - the calendar projection now carries the college and
--    venue so the screen can filter without a second query. Visibility rules
--    (OSA / own org / adviser / dean / approved-for-everyone) are unchanged.
--    Dropped first: the new columns are inserted mid-row, which
--    `create or replace view` would refuse.
-- ----------------------------------------------------------------------------
drop view if exists public.v_calendar_events;

create view public.v_calendar_events as
select
  p.id,
  p.reference_number,
  p.title,
  p.activity_date,
  p.start_time,
  p.end_time,
  p.venue,
  p.venue_id,
  p.status,
  p.organization_id,
  o.name as organization_name,
  o.college_id,
  c.name as college_name,
  p.school_year_id,
  p.created_at
from public.activity_proposals p
join public.organizations o on o.id = p.organization_id
join public.colleges c      on c.id = o.college_id
where public.is_osa()
   or p.organization_id = public.get_my_org_id()
   or public.is_adviser_of(p.organization_id)
   or public.is_dean_of_org(p.organization_id)
   or p.status = 'approved';

grant select on public.v_calendar_events to authenticated;

-- ----------------------------------------------------------------------------
-- 6. v_activity_proposal_list - recreated so the `p.*` expansion picks up
--    `venue_id` (Postgres freezes the column list at CREATE time) and so the
--    list/detail screens can show the canonical venue name without a second
--    query. Same joins and badges as 20261006000400_views.sql.
-- ----------------------------------------------------------------------------
drop view if exists public.v_activity_proposal_list;

create view public.v_activity_proposal_list
with (security_invoker = true) as
select
  p.*,
  o.name   as organization_name,
  o.code   as organization_code,
  c.name   as college_name,
  sy.name  as school_year_name,
  pr.full_name as created_by_name,
  v.name   as venue_name,
  v.location as venue_location,
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
left join public.venues v    on v.id  = p.venue_id
left join public.hardcopy_records h
       on h.record_type = 'activity_proposal' and h.record_id = p.id;

grant select on public.v_activity_proposal_list to authenticated;

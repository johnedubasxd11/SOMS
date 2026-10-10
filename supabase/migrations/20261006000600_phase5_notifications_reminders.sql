-- ============================================================================
-- SOMS - Phase 5: notification helpers, requirement reminders, scheduling.
--
-- The notifications / audit_logs / requirements tables, their RLS policies and
-- the notify_user() helper already exist (Phases 1-4). This migration adds:
--
--   1. two bookkeeping columns (reminder dedupe + e-mail dispatch tracking)
--   2. notify_org_officers()  - OSA announcement to one organization
--   3. sweep_requirements()   - overdue marking + due-soon reminders
--   4. a guarded pg_cron schedule (skipped where pg_cron is not installed -
--      local Supabase has no cron extension, so the app also exposes
--      POST /api/cron/reminders guarded by CRON_SECRET for external schedulers)
-- ============================================================================

-- 1. Bookkeeping columns ------------------------------------------------------
-- reminded_at: last time the sweep sent a reminder for this requirement
-- (one reminder per requirement per day, per user).
alter table public.requirements
  add column if not exists reminded_at timestamptz;

-- emailed_at: set once the e-mail copy of a notification was handed to the
-- provider. Notifications created before this phase stay NULL and are only
-- e-mailed when they are newer than the action that triggers the dispatch.
alter table public.notifications
  add column if not exists emailed_at timestamptz;

create index if not exists notifications_pending_email_idx
  on public.notifications (created_at)
  where emailed_at is null;

-- ----------------------------------------------------------------------------
-- 2. notify_org_officers() - one OSA announcement reaches every officer of an
--    organization plus its active advisers. SECURITY DEFINER so it can read
--    profiles/advisers, but the caller's role is re-checked first.
--    Returns the ids of the notifications it created (the caller e-mails them).
-- ----------------------------------------------------------------------------
create or replace function public.notify_org_officers(
  p_organization_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns setof uuid
language plpgsql security definer set search_path = public
as $$
begin
  -- service_role (cron / seed scripts) has no auth.uid() and passes;
  -- a signed-in caller must be OSA.
  if auth.uid() is not null and not public.is_osa() then
    raise exception 'Only OSA may send organization-wide notifications'
      using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'organization is required';
  end if;

  return query
  insert into public.notifications (user_id, type, title, body, link)
  select u.id, p_type, p_title, p_body, p_link
    from public.profiles u
   where u.is_active
     and (
           (u.role = 'officer' and u.organization_id = p_organization_id)
        or (u.role = 'adviser'
            and exists (select 1 from public.advisers a
                         where a.profile_id = u.id
                           and a.organization_id = p_organization_id
                           and a.is_active))
         )
  returning id;
end;
$$;

revoke all on function public.notify_org_officers(uuid, public.notification_type, text, text, text)
  from public, anon;
grant execute on function public.notify_org_officers(uuid, public.notification_type, text, text, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. sweep_requirements() - the deadline engine.
--
--    a) anything open whose due date has passed becomes 'overdue'
--    b) every open/overdue requirement due within p_reminder_days gets a
--       reminder notification for each officer of the organization + its
--       advisers, at most once per requirement per day (reminded_at)
--
--    Returns the number of reminder notifications created.
-- ----------------------------------------------------------------------------
create or replace function public.sweep_requirements(p_reminder_days integer default 3)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_due      uuid[];
  v_count    integer := 0;
begin
  if auth.uid() is not null and not public.is_osa() then
    raise exception 'Only OSA may run the requirement sweep'
      using errcode = '42501';
  end if;
  if p_reminder_days is null or p_reminder_days < 0 or p_reminder_days > 60 then
    raise exception 'p_reminder_days must be between 0 and 60';
  end if;

  -- a) overdue ---------------------------------------------------------------
  update public.requirements
     set status = 'overdue',
         updated_at = now()
   where status = 'open'
     and due_date is not null
     and due_date < current_date;

  -- b) reminders -------------------------------------------------------------
  -- Collect the due set first: one statement must not race the reminded_at
  -- update that follows it.
  select array_agg(r.id) into v_due
    from public.requirements r
   where r.status in ('open', 'overdue')
     and r.due_date is not null
     and r.due_date <= current_date + p_reminder_days
     and (r.reminded_at is null or r.reminded_at < now() - interval '1 day');

  if v_due is not null and array_length(v_due, 1) > 0 then
    with created as (
      insert into public.notifications (user_id, type, title, body, link, record_id)
      select u.id,
             'reminder',
             case
               when r.due_date < current_date
                 then 'Overdue requirement: ' || r.title
               else 'Due soon: ' || r.title
             end,
             case
               when r.due_date < current_date
                 then 'Was due ' || to_char(r.due_date, 'FMMM/FMDD/YYYY') ||
                      coalesce(' - ' || r.description, '')
               else 'Due ' || to_char(r.due_date, 'FMMM/FMDD/YYYY') ||
                    coalesce(' - ' || r.description, '')
             end,
             '/requirements',
             r.id
        from public.requirements r
        join public.profiles u
          on u.is_active
         and (
               (u.role = 'officer' and u.organization_id = r.organization_id)
            or (u.role = 'adviser'
                and exists (select 1 from public.advisers a
                             where a.profile_id = u.id
                               and a.organization_id = r.organization_id
                               and a.is_active))
              )
       where r.id = any (v_due)
      returning id
    )
    select count(*) into v_count from created;

    update public.requirements
       set reminded_at = now(),
           updated_at  = now()
     where id = any (v_due);
  end if;

  return v_count;
end;
$$;

revoke all on function public.sweep_requirements(integer) from public, anon;
grant execute on function public.sweep_requirements(integer)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Schedule - pg_cron exists on hosted Supabase but not in the local stack,
--    so the schedule is attempted and any failure is downgraded to a NOTICE.
--    Without pg_cron, hit POST /api/cron/reminders (Bearer CRON_SECRET) from
--    any external scheduler instead.
-- ----------------------------------------------------------------------------
do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'soms-requirement-reminders',   -- job name (idempotent: re-schedules)
      '0 6 * * *',                    -- daily 06:00 server time
      $job$select public.sweep_requirements(3)$job$
    );
    raise notice 'pg_cron: scheduled soms-requirement-reminders daily 06:00';
  else
    raise notice 'pg_cron not installed - use POST /api/cron/reminders with CRON_SECRET';
  end if;
exception
  when others then
    raise notice 'could not schedule requirement reminders: %', sqlerrm;
end;
$schedule$;

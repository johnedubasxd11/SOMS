-- Phase 7 - announce notifications.
--
-- notify_announcement_recipients(announcement_id) resolves the audience of an
-- announcement from its target_type + announcement_targets rows and inserts
-- one in-app notification per recipient. SECURITY DEFINER so it can read
-- profiles / advisers / announcement_targets in one pass; the caller's role is
-- re-checked first (OSA only, same contract as notify_org_officers).
--
-- Returns the number of notifications created (the server action reports it).

create or replace function public.notify_announcement_recipients(
  p_announcement_id uuid
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.is_osa() then
    raise exception 'Only OSA may broadcast announcements'
      using errcode = '42501';
  end if;

  if p_announcement_id is null then
    raise exception 'announcement id is required';
  end if;

  with announcement as (
    select a.id, a.title, a.body, a.target_type
      from public.announcements a
     where a.id = p_announcement_id
  ),
  recipients as (
    select u.id
      from public.profiles u
      cross join announcement a
     where u.is_active
       and (
         a.target_type = 'all'
         or (
           a.target_type = 'college'
           and (
             -- The dean of a targeted college.
             (u.role = 'dean' and u.college_id in (
                select t.college_id from public.announcement_targets t
                 where t.announcement_id = a.id and t.college_id is not null
              ))
             -- Officers of organizations in that college.
             or (
               u.role = 'officer'
               and u.organization_id in (
                 select o.id from public.organizations o
                  where o.college_id in (
                    select t.college_id from public.announcement_targets t
                     where t.announcement_id = a.id and t.college_id is not null
                  )
               )
             )
             -- Active advisers of organizations in that college.
             or (
               u.role = 'adviser'
               and exists (
                 select 1
                   from public.advisers ad
                   join public.organizations o on o.id = ad.organization_id
                  where ad.profile_id = u.id
                    and ad.is_active
                    and o.college_id in (
                      select t.college_id from public.announcement_targets t
                       where t.announcement_id = a.id and t.college_id is not null
                    )
               )
             )
           )
         )
         or (
           a.target_type = 'organization'
           and (
             (u.role = 'officer' and u.organization_id in (
                select t.organization_id from public.announcement_targets t
                 where t.announcement_id = a.id and t.organization_id is not null
              ))
             or (u.role = 'adviser' and exists (
                   select 1
                     from public.announcement_targets t
                     join public.advisers ad
                       on ad.organization_id = t.organization_id
                      and ad.profile_id = u.id
                      and ad.is_active
                    where t.announcement_id = a.id
                      and t.organization_id is not null
                 ))
           )
         )
       )
  )
  insert into public.notifications (user_id, type, title, body, link)
  select r.id,
         'system'::public.notification_type,
         a.title,
         a.body,
         '/announcements'
    from recipients r
    cross join announcement a;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_announcement_recipients(uuid)
  from public, anon;
grant execute on function public.notify_announcement_recipients(uuid)
  to authenticated, service_role;

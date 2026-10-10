-- ============================================================================
-- SOMS - Helper functions, triggers and RPCs
-- Phase 1 migration 2/5.
--
-- SECURITY MODEL
--  * Authorization helpers are SECURITY DEFINER so they can read `profiles`
--    without recursing into their own RLS policies.
--  * Business-critical state changes (status transitions, hardcopy receipt)
--    only exist as SECURITY DEFINER RPCs that re-check the caller's role.
--  * A BEFORE UPDATE guard refuses direct status writes, so even a leaked
--    UPDATE policy cannot approve a document by itself.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Authorization helpers
-- ----------------------------------------------------------------------------

create or replace function public.get_my_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

-- An officer's own organization (null for advisers / OSA / super admins).
create or replace function public.get_my_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_osa()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.get_my_role() in ('osa_admin', 'super_admin'), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.get_my_role() = 'super_admin', false);
$$;

-- Endorsement right: OSA always passes, advisers only for their own org.
create or replace function public.is_adviser_of(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_osa(), false)
      or exists (
           select 1
           from public.advisers a
           where a.organization_id = p_organization_id
             and a.profile_id = auth.uid()
             and a.is_active
         );
$$;

create or replace function public.get_my_advised_org_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select organization_id from public.advisers
  where profile_id = auth.uid() and is_active;
$$;

-- Used by storage policies: the first path segment is the organization id.
-- Anything that is not a uuid falls back to is_osa() only (so a malformed
-- path can never grant an officer access to another org's folder).
create or replace function public.can_access_org_path(p_org_segment text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_org_segment is null or p_org_segment = '' then
    return public.is_osa();
  end if;

  begin
    v_org := p_org_segment::uuid;
  exception
    when invalid_text_representation then
      return public.is_osa();
  end;

  return public.is_osa()
      or v_org = public.get_my_org_id()
      or public.is_adviser_of(v_org);
end;
$$;

revoke all on function public.can_access_org_path(text) from public;
grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.get_my_org_id() to authenticated, service_role;
grant execute on function public.is_osa() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_adviser_of(uuid) to authenticated, service_role;
grant execute on function public.get_my_advised_org_ids() to authenticated, service_role;
grant execute on function public.can_access_org_path(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Signup trigger: one profile per auth user.
--    Role and organization ALWAYS start at their safe defaults - metadata
--    posted by a public signup can never grant privileges. OSA (or
--    scripts/seed-users.ts using the service role key) assigns them later.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, organization_id, is_active)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@no-email.local'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(coalesce(new.email, 'user'), '@', 1)),
    'officer',
    null,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile e-mail / name in sync when the auth record changes.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
     set email     = coalesce(new.email, old.email),
         full_name = coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), full_name)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_profile_from_auth();

-- ----------------------------------------------------------------------------
-- 3. Guard triggers
-- ----------------------------------------------------------------------------

-- profiles: only OSA / Super Admin may change role, organization, e-mail or
-- the active flag (self-service edits of name/position stay possible).
create or replace function public.enforce_profile_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.role            is distinct from old.role)
  or (new.organization_id is distinct from old.organization_id)
  or (new.is_active       is distinct from old.is_active)
  or (new.email           is distinct from old.email) then
    -- auth.uid() IS NULL means the caller is the service role (or a direct
    -- postgres session): RLS has already removed every client-side UPDATE
    -- path that could reach here without a uid, so it is allowed through.
    if auth.uid() is not null and not public.is_osa() then
      raise exception 'Only OSA or a Super Admin can change role, organization, e-mail or active flag'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_guard on public.profiles;
create trigger enforce_profile_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_guard();

-- Submissions: status / organization / reference number only through RPCs.
create or replace function public.guard_submission_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A submission cannot be moved to another organization'
      using errcode = '42501';
  end if;

  if new.reference_number is distinct from old.reference_number then
    raise exception 'Reference numbers are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_guard_bypass', true), '') <> 'true'
     and auth.uid() is not null then
    raise exception 'Status changes must go through transition_submission()'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'activity_proposals', 'accomplishment_reports', 'audit_documents', 'other_documents'
  ] loop
    execute format(
      'drop trigger if exists guard_submission_change on public.%I;
       create trigger guard_submission_change
         before update on public.%I
         for each row execute function public.guard_submission_change()',
      t, t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. audit_logs writer (SECURITY DEFINER so it survives client RLS)
-- ----------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id  := v_new ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id  := v_new ->> 'id';
  else
    v_old := to_jsonb(old);
    v_id  := v_old ->> 'id';
  end if;

  insert into public.audit_logs (
    table_name, record_id, action, old_data, new_data, changed_by, changed_by_email
  )
  values (
    tg_table_name, v_id, tg_op, v_old, v_new,
    auth.uid(),
    (select email from public.profiles where id = auth.uid())
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'colleges', 'school_years', 'organizations', 'profiles', 'advisers',
    'organization_officers', 'activity_proposals', 'accomplishment_reports',
    'audit_documents', 'other_documents', 'documents', 'requirements',
    'hardcopy_records', 'system_settings'
  ] loop
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
-- 5. Internal helpers (never granted to clients)
-- ----------------------------------------------------------------------------

-- polymorphic record_type -> physical table name
create or replace function public.record_type_table(p_record_type public.record_type)
returns text
language sql immutable set search_path = public
as $$
  select case p_record_type
    when 'activity_proposal'     then 'activity_proposals'
    when 'accomplishment_report' then 'accomplishment_reports'
    when 'audit_document'        then 'audit_documents'
    when 'other_document'        then 'other_documents'
  end;
$$;

-- deep link used by notifications and QR codes
create or replace function public.submission_path(p_record_type public.record_type, p_record_id uuid)
returns text
language sql immutable set search_path = public
as $$
  select case p_record_type
    when 'activity_proposal'     then '/proposals/' || p_record_id
    when 'accomplishment_report' then '/reports/'    || p_record_id
    when 'audit_document'        then '/audit-documents/' || p_record_id
    when 'other_document'        then '/documents/'  || p_record_id
  end;
$$;

grant execute on function public.record_type_table(public.record_type) to authenticated, service_role;
grant execute on function public.submission_path(public.record_type, uuid) to authenticated, service_role;

create or replace function public.notify_user(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_record_type public.record_type default null,
  p_record_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, link, record_type, record_id)
  values (p_user_id, p_type, p_title, p_body, p_link, p_record_type, p_record_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.notify_user(uuid, public.notification_type, text, text, text, public.record_type, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_user(uuid, public.notification_type, text, text, text, public.record_type, uuid)
  to service_role, postgres;

-- ----------------------------------------------------------------------------
-- 6. transition_submission() - the ONLY way to change a submission status.
--
--    officer : own organization  draft|revision_requested -> submitted
--                                              submitted   -> draft (withdraw)
--    adviser : assigned org      submitted                -> endorsed
--    osa/it  :                   submitted|endorsed|under_review
--                                              -> under_review | approved |
--                                                 rejected | revision_requested
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
  v_ok           boolean := false;
  v_action       public.review_action;
  v_now          timestamptz := now();
  v_is_submitted boolean := p_to_status = 'submitted';
  v_is_endorsed  boolean := p_to_status = 'endorsed';
  v_is_review    boolean := p_to_status in ('under_review', 'approved', 'rejected', 'revision_requested');
  v_is_approved  boolean := p_to_status = 'approved';
  v_is_resubmit  boolean;
begin
  execute format('select status, organization_id from public.%I where id = $1', v_table)
    into v_from, v_org
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

  -- ---- role -> allowed transitions ----
  if v_profile.role in ('osa_admin', 'super_admin') then
    v_ok := v_from in ('submitted', 'endorsed', 'under_review')
        and p_to_status in ('under_review', 'approved', 'rejected', 'revision_requested');

  elsif v_profile.role = 'adviser' then
    v_ok := public.is_adviser_of(v_org)
        and v_from = 'submitted'
        and p_to_status = 'endorsed';

  elsif v_profile.role = 'officer' then
    v_ok := v_org = v_profile.organization_id
        and (
              (v_from in ('draft', 'revision_requested') and p_to_status = 'submitted')
           or (v_from = 'submitted' and p_to_status = 'draft')
            );
  end if;

  if not v_ok then
    raise exception 'Role % may not move % from % to %',
      v_profile.role, p_record_type, v_from, p_to_status
      using errcode = '42501';
  end if;

  -- A resubmission after "revision requested" counts as a new document version.
  v_is_resubmit := v_from = 'revision_requested' and p_to_status = 'submitted';

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
  $stmt$, v_table)
    using p_to_status, p_remarks,
          v_is_submitted, v_now, v_is_endorsed, v_is_review, v_is_approved,
          v_is_resubmit, p_record_id;

  v_action := case
    when p_to_status = 'submitted' then
      case when v_is_resubmit then 'resubmitted'::public.review_action
           else 'submitted'::public.review_action end
    when p_to_status = 'endorsed'           then 'endorsed'::public.review_action
    when p_to_status = 'under_review'       then 'started_review'::public.review_action
    when p_to_status = 'revision_requested' then 'revision_requested'::public.review_action
    when p_to_status = 'approved'           then 'approved'::public.review_action
    when p_to_status = 'rejected'           then 'rejected'::public.review_action
    else 'withdrawn'::public.review_action
  end;

  insert into public.review_logs (
    record_type, record_id, organization_id, from_status, to_status,
    action, remarks, actor_id, actor_role, actor_name
  ) values (
    p_record_type, p_record_id, v_org, v_from, p_to_status,
    v_action, p_remarks, v_profile.id, v_profile.role, v_profile.full_name
  );

  perform set_config('app.status_guard_bypass', 'false', true);

  -- ---- in-app notifications ----
  if v_profile.role = 'officer' then
    -- Officer acted -> OSA staff + the organization's adviser.
    perform public.notify_user(
      u.id, 'status_change',
      format('%s: %s -> %s', v_profile.full_name, v_from, p_to_status),
      p_remarks,
      public.submission_path(p_record_type, p_record_id),
      p_record_type, p_record_id
    )
    from public.profiles u
    where u.is_active
      and (
            u.role in ('osa_admin', 'super_admin')
         or (u.role = 'adviser'
             and exists (select 1 from public.advisers a
                          where a.profile_id = u.id
                            and a.organization_id = v_org
                            and a.is_active))
          );
  else
    -- Adviser / OSA acted -> the organization's officers.
    perform public.notify_user(
      u.id, 'status_change',
      format('Your submission is now %s', p_to_status),
      p_remarks,
      public.submission_path(p_record_type, p_record_id),
      p_record_type, p_record_id
    )
    from public.profiles u
    where u.is_active and u.role = 'officer' and u.organization_id = v_org;
  end if;

  return p_to_status;
end;
$$;

revoke all on function public.transition_submission(public.record_type, uuid, public.submission_status, text)
  from public, anon;
grant execute on function public.transition_submission(public.record_type, uuid, public.submission_status, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. add_review_comment() - adviser / OSA remark without a status change
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

  -- Advisers of this organization, plus OSA (is_adviser_of() grants OSA).
  if not public.is_adviser_of(v_org) then
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

-- ----------------------------------------------------------------------------
-- 8. mark_hardcopy_received() - OSA only
-- ----------------------------------------------------------------------------
create or replace function public.mark_hardcopy_received(
  p_record_type public.record_type,
  p_record_id uuid,
  p_receiver_name text,
  p_remarks text default null,
  p_received_at timestamptz default now()
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_table  text := public.record_type_table(p_record_type);
  v_org    uuid;
  v_status public.submission_status;
  v_ref    text;
  v_hc_id  uuid;
  v_actor  public.profiles;
begin
  if not public.is_osa() then
    raise exception 'Only OSA can record hardcopy receipt' using errcode = '42501';
  end if;

  if p_receiver_name is null or length(btrim(p_receiver_name)) = 0 then
    raise exception 'Receiver name is required';
  end if;

  execute format(
    'select organization_id, status, reference_number from public.%I where id = $1',
    v_table
  )
  into v_org, v_status, v_ref using p_record_id;

  if v_org is null then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();

  insert into public.hardcopy_records (
    record_type, record_id, organization_id, reference_number,
    received, received_at, received_by, receiver_name, remarks
  ) values (
    p_record_type, p_record_id, v_org, v_ref,
    true, coalesce(p_received_at, now()), v_actor.id, btrim(p_receiver_name), p_remarks
  )
  on conflict (record_type, record_id) do update
    set received     = true,
        received_at  = coalesce(excluded.received_at, now()),
        received_by  = excluded.received_by,
        receiver_name = excluded.receiver_name,
        remarks      = excluded.remarks
  returning id into v_hc_id;

  insert into public.review_logs (
    record_type, record_id, organization_id, from_status, to_status,
    action, remarks, actor_id, actor_role, actor_name
  ) values (
    p_record_type, p_record_id, v_org, v_status, v_status,
    'hardcopy_received', p_remarks, v_actor.id, v_actor.role, v_actor.full_name
  );

  perform public.notify_user(
    u.id, 'system',
    'Hardcopy received',
    format('Reference %s: hardcopy received by %s', v_ref, btrim(p_receiver_name)),
    public.submission_path(p_record_type, p_record_id),
    p_record_type, p_record_id
  )
  from public.profiles u
  where u.is_active and u.role = 'officer' and u.organization_id = v_org;

  return v_hc_id;
end;
$$;

-- OSA-only is enforced inside the function, so `authenticated` may call it.
revoke all on function public.mark_hardcopy_received(public.record_type, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.mark_hardcopy_received(public.record_type, uuid, text, text, timestamptz)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Rate limiting (fixed window) - used by the login server action
-- ----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 900,
  p_block_seconds integer default 900
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_row       public.rate_limits;
  v_attempts  integer;
  v_retry     integer := 0;
  v_allowed   boolean := true;
begin
  select * into v_row from public.rate_limits where key = p_key for update;

  if found and v_row.blocked_until is not null and v_row.blocked_until > now() then
    return jsonb_build_object(
      'allowed', false,
      'attempts', v_row.attempts,
      'retry_after_seconds', greatest(0, ceil(extract(epoch from v_row.blocked_until - now()))::int)
    );
  end if;

  if found and v_row.window_started > now() - make_interval(secs => p_window_seconds) then
    v_attempts := v_row.attempts + 1;
  else
    v_attempts := 1;                       -- new window
  end if;

  if v_attempts > p_max_attempts then
    v_allowed := false;
    v_retry   := p_block_seconds;
    insert into public.rate_limits (key, window_started, attempts, blocked_until, updated_at)
    values (p_key, coalesce(v_row.window_started, now()), v_attempts, now() + make_interval(secs => p_block_seconds), now())
    on conflict (key) do update
      set attempts = excluded.attempts,
          blocked_until = excluded.blocked_until,
          updated_at = now();
  else
    insert into public.rate_limits (key, window_started, attempts, blocked_until, updated_at)
    values (p_key, coalesce(v_row.window_started, now()), v_attempts, null, now())
    on conflict (key) do update
      set attempts = excluded.attempts,
          window_started = case
            when public.rate_limits.window_started <= now() - make_interval(secs => p_window_seconds)
            then now() else public.rate_limits.window_started end,
          blocked_until = null,
          updated_at = now();
  end if;

  return jsonb_build_object('allowed', v_allowed, 'attempts', v_attempts, 'retry_after_seconds', v_retry);
end;
$$;

-- Needed at login time (before a session exists), hence `anon` as well.
grant execute on function public.check_rate_limit(text, integer, integer, integer) to anon, authenticated, service_role;

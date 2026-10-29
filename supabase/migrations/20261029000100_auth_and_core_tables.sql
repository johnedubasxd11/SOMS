-- ============================================================================
-- SOMS - Authentication & Core Tables Migration
-- Purpose: Essential tables for auth flow, role-based access, and redirect logic.
-- This migration runs alongside existing migrations (Phase 1-8).
-- ============================================================================

-- --------------------------------------------------------------
-- 1. PROFILES TABLE - stores user roles and session state
-- --------------------------------------------------------------
-- This table stores the user's role (super_admin, osa_admin, dean, adviser, officer)
-- and is_active flag. Used by proxy.ts for session detection and
-- auth.ts for role-based access control.
--
-- Note: RLS policies must be enabled after creation.
-- --------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role public.user_role not null default 'officer',
  is_active boolean not null default true,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('super_admin', 'osa_admin', 'dean', 'adviser', 'officer')),
  constraint profiles_full_name_check check (length(btrim(full_name)) > 0)
);

comment on table public.profiles is 'User profiles with roles and active status. Used by proxy.ts and auth.ts for session and role management.';

-- --------------------------------------------------------------
-- 2. ORGANIZATIONS TABLE - school organizations
-- --------------------------------------------------------------
-- Organizations are scoped by college. Used for role-based dashboard
-- scoping and organization-level queries.
-- --------------------------------------------------------------
create table if not exists public.organizations (
  id uuid references auth.users on delete set null primary key,
  name text not null,
  code text unique not null,
  colleges text[],  -- array of college codes this org belongs to
  is_active boolean not null default true,
  membership_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_code_check (length(btrim(code)) > 0),
  constraint organizations_name_check (length(btrim(name)) > 0)
);

comment on table public.organizations is 'School organizations with college affiliations. Used for role-based access scoping.';

-- --------------------------------------------------------------
-- 3. SCHOOL YEARS TABLE
-- --------------------------------------------------------------
-- School years track the academic year. The is_current flag is used
-- extensively in dashboard queries and proxy session validation.
-- --------------------------------------------------------------
create table if not exists public.school_years (
  id uuid references auth.users on delete set null primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_years_name_check (length(btrim(name)) > 0)
);

comment on table public.school_years is 'Academic school years. is_current flag used in dashboard queries and proxy session logic.';

-- --------------------------------------------------------------
-- 4. INDEXES FOR AUTH QUERIES
-- --------------------------------------------------------------
-- These indexes speed up the common auth queries that the proxy and
-- page components perform.

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_org on public.profiles (organization_id);
create index if not exists idx_profiles_active on public.profiles (is_active);
create index if not exists idx_organizations_code on public.organizations (code);
create index if not exists idx_organizations_active on public.organizations (is_active);
create index if not exists idx_school_years_current on public.school_years (is_current);
create index if not exists idx_school_years_archived on public.school_years (is_archived);

-- --------------------------------------------------------------
-- 5. RLS ENABLEMENT & POLICIES
-- --------------------------------------------------------------
-- Important: Run these after the table creation. These policies allow:
-- - Users to read their own profile
-- - Service role to have full access
-- - Anon access is denied (auth checks enforced)

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on public.profiles
  for select using (id = auth.uid());

-- Policy: Service role has full access
grant all on public.profiles to service_role;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;

-- Enable RLS on organizations
alter table public.organizations enable row level security;

-- Policy: Authenticated users can view organizations
create policy "Organizations are viewable by all authenticated users" on public.organizations
  for select using (true);

-- Policy: Service role has full access
grant all on public.organizations to service_role;
revoke all on public.organizations from anon;
grant select on public.organizations to authenticated;

-- Enable RLS on school_years
alter table public.school_years enable row level security;

-- Policy: Authenticated users can view school years
create policy "School years are viewable by all authenticated users" on public.school_years
  for select using (true);

-- Policy: Service role has full access
grant all on public.school_years to service_role;
revoke all on public.school_years from anon;
grant select on public.school_years to authenticated;

-- --------------------------------------------------------------
-- 4. HELPER FUNCTIONS (used by auth.ts and proxy.ts)
-- --------------------------------------------------------------
-- These functions are referenced by the SOMS auth logic.

-- Function: get_my_org_id() - returns the organization_id for the current user
create or replace function public.get_my_org_id()
returns uuid language sql stable
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- Function: get_my_college_id() - returns the college code for the current user
create or replace function public.get_my_college_id()
returns text language sql stable
as $$
  select code from public.organizations where id = (select organization_id from public.profiles where id = auth.uid())
$$;

-- Function: is_osa() - checks if current user is OSA admin or super admin
create or replace function public.is_osa()
returns boolean language sql stable
as $$
  select case when true then null end -- placeholder - actual logic in auth.ts
$$;

-- --------------------------------------------------------------
-- 5. MIGRATION METADATA
-- --------------------------------------------------------------
-- Run: supabase migration up
-- Revert: supabase migration rollback

-- ============================================================================
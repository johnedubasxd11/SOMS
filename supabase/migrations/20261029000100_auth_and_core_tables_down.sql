-- ============================================================================
-- Down migration: auth_and_core_tables
-- Reverts the auth_and_core_tables migration (20261029000100)
-- ============================================================================

-- Drop policies and revoke access on profiles
drop policy if exists "Users can view own profile" on public.profiles;
revoke all on public.profiles from authenticated, service_role;
grant all on public.profiles to anon;

-- Drop indexes on profiles
drop index if exists idx_profiles_role on public.profiles;
drop index if exists idx_profiles_org on public.profiles;
drop index if exists idx_profiles_active on public.profiles;

-- Disable RLS and drop profiles table
alter table public.profiles disable row level security;
drop table if exists public.profiles;

-- Drop organizations policies and table
drop policy if exists "Organizations are viewable by all authenticated users" on public.organizations;
revoke all on public.organizations from authenticated, service_role;
grant all on public.organizations to anon;

drop index if exists idx_organizations_code on public.organizations;
drop index if exists idx_organizations_active on public.organizations;
drop table if exists public.organizations;

-- Drop school years policies and table
drop policy if exists "School years are viewable by all authenticated users" on public.school_years;
revoke all on public.school_years from authenticated, service_role;
grant all on public.school_years to anon;

drop index if exists idx_school_years_current on public.school_years;
drop index if exists idx_school_years_archived on public.school_years;
drop table if exists public.school_years;

-- Drop helper functions
drop function if exists public.get_my_org_id() cascade;
drop function if exists public.get_my_college_id() cascade;
drop function if exists public.is_osa() cascade;

-- ============================================================================
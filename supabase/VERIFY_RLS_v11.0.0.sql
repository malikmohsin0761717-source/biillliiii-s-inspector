-- Biillliiii Inspector v11.0.0
-- READ-ONLY checks for the existing projects table and its RLS policies.
-- Run in the intended Supabase project's SQL Editor after the v0.6.0 projects migration.
-- This checks configuration metadata only; the separate two-account API test is still required.

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'projects';

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public' and tablename = 'projects'
order by policyname;

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'projects'
order by grantee, privilege_type;

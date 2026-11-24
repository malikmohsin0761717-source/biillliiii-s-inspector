-- Read-only verification for Cloud Phase 2 workspace document storage.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'workspace_documents';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'workspace_documents'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'workspace_documents'
order by grantee, privilege_type;

-- Confirm the database rejects local-only AI history document types.
select
  conname,
  pg_get_constraintdef(oid) as constraint_definition,
  convalidated
from pg_constraint
where conrelid = 'public.workspace_documents'::regclass
  and conname = 'workspace_documents_document_type_check';

-- Biillliiii Inspector Cloud Phase 2
-- Creates owner-scoped storage for explicitly selected workspace documents.
-- This migration does not read, import, or modify any local files.
-- AI histories remain local unless a future, explicit user action syncs them.

create table if not exists public.workspace_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  document_type text not null
    check (document_type in (
      'workspace',
      'reminders',
      'important',
      'alerts',
      'settings',
      'chatbot_history',
      'teacher_history'
    )),
  document_key text not null
    check (char_length(document_key) between 1 and 120),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object')
    check (pg_column_size(payload) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_documents_owner_type_key_unique
    unique (owner_id, document_type, document_key)
);

create or replace function public.set_workspace_documents_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_documents_set_updated_at
  on public.workspace_documents;
create trigger workspace_documents_set_updated_at
before update on public.workspace_documents
for each row execute function public.set_workspace_documents_updated_at();

alter table public.workspace_documents enable row level security;
revoke all on table public.workspace_documents from anon, authenticated;
grant select, insert, update, delete
  on table public.workspace_documents to authenticated;

drop policy if exists workspace_documents_select_own
  on public.workspace_documents;
create policy workspace_documents_select_own
on public.workspace_documents
for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists workspace_documents_insert_own
  on public.workspace_documents;
create policy workspace_documents_insert_own
on public.workspace_documents
for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists workspace_documents_update_own
  on public.workspace_documents;
create policy workspace_documents_update_own
on public.workspace_documents
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists workspace_documents_delete_own
  on public.workspace_documents;
create policy workspace_documents_delete_own
on public.workspace_documents
for delete to authenticated
using ((select auth.uid()) = owner_id);

create index if not exists workspace_documents_owner_type_idx
  on public.workspace_documents (owner_id, document_type);

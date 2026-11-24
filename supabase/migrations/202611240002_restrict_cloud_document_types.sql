begin;

-- Cloud hardening: prevent direct API writes of local-only AI histories.
-- Existing history rows are never deleted. If any exist, this migration stops safely for review.
alter table public.workspace_documents
  drop constraint if exists workspace_documents_document_type_check;

do $$
begin
  if exists (
    select 1
    from public.workspace_documents
    where document_type not in ('workspace', 'reminders', 'important', 'alerts', 'settings')
  ) then
    raise exception 'Local-only document types already exist. No rows were deleted; review them before applying this constraint.';
  end if;

  alter table public.workspace_documents
    add constraint workspace_documents_document_type_check
    check (document_type in ('workspace', 'reminders', 'important', 'alerts', 'settings'));
end
$$;

commit;

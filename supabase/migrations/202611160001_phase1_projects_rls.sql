-- Biillliiii Inspector v0.6.0
-- Run manually in the intended Supabase project's SQL editor only after reviewing it.
-- This migration creates cloud storage; it does not import or modify local JSON data.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_code text not null check (char_length(project_code) between 1 and 64),
  name text not null check (char_length(name) <= 120),
  status text not null default 'Planning' check (char_length(status) <= 24),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_project_code_unique unique (owner_id, project_code)
);

create or replace function public.set_projects_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_projects_updated_at();

alter table public.projects enable row level security;
revoke all on table public.projects from anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
for update to authenticated using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
for delete to authenticated using ((select auth.uid()) = owner_id);

-- Biillliiii Inspector cloud AI history, separate from local AI history.
-- Apply manually in the intended Supabase project after review.
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode text not null check (mode in ('chatbot','teacher')),
  conversation_id text not null check (char_length(conversation_id) between 20 and 40),
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_owner_mode_id_unique unique (owner_id, mode, conversation_id)
);
alter table public.ai_conversations enable row level security;
revoke all on table public.ai_conversations from anon, authenticated;
grant select, insert, update, delete on table public.ai_conversations to authenticated;
drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists ai_conversations_insert_own on public.ai_conversations;
create policy ai_conversations_insert_own on public.ai_conversations for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists ai_conversations_update_own on public.ai_conversations;
create policy ai_conversations_update_own on public.ai_conversations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists ai_conversations_delete_own on public.ai_conversations;
create policy ai_conversations_delete_own on public.ai_conversations for delete to authenticated using ((select auth.uid()) = owner_id);

create table if not exists public.ai_teacher_progress (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  goals jsonb not null default '[]'::jsonb check (jsonb_typeof(goals) = 'array'),
  completed_lessons jsonb not null default '[]'::jsonb check (jsonb_typeof(completed_lessons) = 'array'),
  notes text not null default '' check (char_length(notes) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.ai_teacher_progress enable row level security;
revoke all on table public.ai_teacher_progress from anon, authenticated;
grant select, insert, update, delete on table public.ai_teacher_progress to authenticated;
drop policy if exists ai_teacher_progress_select_own on public.ai_teacher_progress;
create policy ai_teacher_progress_select_own on public.ai_teacher_progress for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists ai_teacher_progress_insert_own on public.ai_teacher_progress;
create policy ai_teacher_progress_insert_own on public.ai_teacher_progress for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists ai_teacher_progress_update_own on public.ai_teacher_progress;
create policy ai_teacher_progress_update_own on public.ai_teacher_progress for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

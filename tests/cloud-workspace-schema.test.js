'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611240001_cloud_workspace_documents.sql'), 'utf8');
const hardening = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611240002_restrict_cloud_document_types.sql'), 'utf8');

test('cloud workspace documents are owner-scoped and protected by RLS', () => {
  assert.match(migration, /create table if not exists public\.workspace_documents/i);
  assert.match(migration, /owner_id uuid not null default auth\.uid\(\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.workspace_documents from anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*to authenticated/i);
  for (const action of ['select', 'insert', 'update', 'delete']) assert.match(migration, new RegExp('for ' + action + ' to authenticated', 'i'));
  assert.equal((migration.match(/auth\.uid\(\)/g) || []).length >= 5, true);
});

test('cloud workspace documents allow only approved non-history types, keys and payload sizes', () => {
  assert.match(migration, /document_type in \([\s\S]*'workspace'[\s\S]*'settings'/);
  assert.doesNotMatch(migration, /chatbot_history|teacher_history/);
  assert.match(migration, /char_length\(document_key\) between 1 and 120/i);
  assert.match(migration, /jsonb_typeof\(payload\) = 'object'/i);
  assert.match(migration, /pg_column_size\(payload\) <= 1048576/i);
  assert.match(migration, /unique \(owner_id, document_type, document_key\)/i);
  assert.match(hardening, /begin;[\s\S]*drop constraint if exists workspace_documents_document_type_check[\s\S]*raise exception[\s\S]*commit;/i);
  assert.match(hardening, /No rows were deleted/i);
  assert.doesNotMatch(hardening, /delete\s+from/i);
});

test('cloud workspace migration does not import or alter local project/auth files', () => {
  assert.doesNotMatch(migration, /data\/projects\.json|data\/auth\.json|copyFile|readFile/i);
  assert.match(migration, /does not read, import, or modify any local files/i);
});

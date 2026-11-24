'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611240001_cloud_workspace_documents.sql'), 'utf8');

test('cloud workspace documents are owner-scoped and protected by RLS', () => {
  assert.match(migration, /create table if not exists public\\.workspace_documents/i);
  assert.match(migration, /owner_id uuid not null default auth\\.uid\\(\\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\\.workspace_documents from anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete[\\s\\S]*to authenticated/i);
  for (const action of ['select', 'insert', 'update', 'delete']) assert.match(migration, new RegExp('for ' + action + ' to authenticated', 'i'));
  assert.equal((migration.match(/auth\\.uid\\(\\)/g) || []).length >= 5, true);
});

test('cloud workspace documents limit types, keys and payload size', () => {
  assert.match(migration, /document_type in \\([\\s\\S]*'workspace'[\\s\\S]*'teacher_history'/);
  assert.match(migration, /char_length\\(document_key\\) between 1 and 120/i);
  assert.match(migration, /jsonb_typeof\\(payload\\) = 'object'/i);
  assert.match(migration, /pg_column_size\\(payload\\) <= 1048576/i);
  assert.match(migration, /unique \\(owner_id, document_type, document_key\\)/i);
});

test('cloud workspace migration does not import or alter local project/auth files', () => {
  assert.doesNotMatch(migration, /data\\/projects\\.json|data\\/auth\\.json|copyFile|readFile/i);
  assert.match(migration, /does not read, import, or modify any local files/i);
});

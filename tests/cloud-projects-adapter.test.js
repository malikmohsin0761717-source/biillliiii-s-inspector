'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'api', 'cloud-projects.js'), 'utf8');

test('cloud projects adapter exposes owner-session CRUD through Supabase RLS', () => {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) assert.ok(source.includes(`method === '${method}'`));
  assert.match(source, /assertSameOrigin\(req\)/);
  assert.match(source, /requireSession\(await getSession\(req, res\)\)/);
  assert.match(source, /Authorization: `Bearer \${session\.accessToken}`/);
  assert.match(source, /on_conflict=owner_id,project_code/);
  assert.match(source, /project_code=eq\./);
  assert.match(source, /1 MiB/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('cloud project payload is stored separately from local project files', () => {
  assert.match(source, /payload/);
  assert.doesNotMatch(source, /data\/projects\.json|data\/auth\.json|writeFileSync|copyFileSync/);
});

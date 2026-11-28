'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cloud = fs.readFileSync(path.join(root, 'cloud-auth.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '202611160001_phase1_projects_rls.sql'), 'utf8');

test('cloud authentication uses Supabase publishable key and server-side PKCE/session handling', () => {
  assert.match(cloud, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(cloud, /code_challenge_method=s256/);
  assert.match(cloud, /grant_type=pkce/);
  assert.match(cloud, /HttpOnly/);
  assert.match(cloud, /sameSite = 'Strict'/);
  assert.doesNotMatch(cloud, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(server, /cloudAuth\.getFreshSession/);
});

test('cloud signup, email login, Google OAuth, password recovery and manual sync endpoints exist', () => {
  for (const route of ['/api/cloud-auth/signup', '/api/cloud-auth/login', '/api/cloud-auth/google', '/api/cloud-auth/callback', '/api/cloud-auth/recover', '/api/cloud-auth/recovery-session', '/api/cloud-auth/session-exchange', '/api/cloud-auth/resend-confirmation', '/api/cloud-auth/update-password', '/api/cloud-auth/sync']) {
    assert.ok(cloud.includes(route), `Missing ${route}`);
  }
  assert.match(app, /data-auth-action="google-login"/);
  assert.match(app, /cloudSyncButton/);
  assert.match(app, /Existing matching cloud project codes will be updated/);
});

test('local cloud signup detects repeated accounts and can resend signup confirmation', () => {
  assert.match(cloud, /existingAccount/);
  assert.match(cloud, /result\.user\?\.identities/);
  assert.match(cloud, /\/api\/cloud-auth\/resend-confirmation/);
  assert.match(cloud, /\/auth\/v1\/resend/);
  assert.match(cloud, /type: 'signup'/);
  assert.match(app, /result\.existingAccount \|\| result\.confirmationRequired/);
  assert.match(app, /data-auth-action="cloud-resend"/);
  assert.match(app, /\/api\/cloud-auth\/resend-confirmation/);
});

test('local signup verification and recovery callbacks exchange token hashes and use the actual browser host', () => {
  assert.match(cloud, /req\.headers\.host/);
  assert.match(cloud, /const origin = req\.headers\.host/);
  assert.match(cloud, /\/auth\/v1\/verify/);
  assert.match(cloud, /token_hash/);
  assert.match(app, /authQuery\.get\('token_hash'\)/);
  assert.match(app, /cloud-auth\/session-exchange/);
  assert.match(app, /\['recovery','signup','invite','magiclink','email'\]/);
});

test('local cloud and owner password fields include accessible show/hide controls', () => {
  assert.match(app, /data-password-toggle/);
  assert.match(app, /input\.type=reveal\?'text':'password'/);
  assert.match(app, /setAttribute\('aria-label'/);
  assert.match(app, /auth-password-wrap/);
});

test('Supabase projects migration enables owner-scoped RLS for all CRUD operations', () => {
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.projects from anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.projects to authenticated/i);
  for (const action of ['select', 'insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`for ${action} to authenticated`, 'i'));
  }
  assert.equal((sql.match(/auth\.uid\(\)/g) || []).length >= 4, true);
  assert.match(sql, /unique \(owner_id, project_code\)/i);
  assert.match(sql, /payload jsonb/i);
});

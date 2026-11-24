'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const session = require(path.join(root, 'api', '_lib', 'cloud-session'));
const sessionSource = fs.readFileSync(path.join(root, 'api', '_lib', 'cloud-session.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'api', 'cloud-auth', '[action].js'), 'utf8');
const documents = fs.readFileSync(path.join(root, 'api', 'cloud-documents.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'cloud', 'index.html'), 'utf8');
const client = fs.readFileSync(path.join(root, 'cloud', 'app.js'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('Vercel static output is isolated from the local-first UI', () => {
  assert.equal(vercel.outputDirectory, 'cloud');
  assert.ok(fs.existsSync(path.join(root, 'ui', 'index.html')));
  assert.ok(fs.existsSync(path.join(root, 'server.js')));
});

test('cloud session cookie encrypts tokens and rejects tampering', () => {
  const prior = process.env.BI_CLOUD_SESSION_SECRET;
  process.env.BI_CLOUD_SESSION_SECRET = 'test-only-cloud-session-secret-32-bytes-minimum';
  try {
    const value = { accessToken: 'access-test', refreshToken: 'refresh-test', expiresAt: Date.now() + 60000 };
    const sealed = session.seal(value);
    assert.notEqual(sealed, JSON.stringify(value));
    assert.deepEqual(session.unseal(sealed), value);
    const changed = (sealed[0] === 'A' ? 'B' : 'A') + sealed.slice(1);
    assert.equal(session.unseal(changed), null);
  } finally {
    if (prior === undefined) delete process.env.BI_CLOUD_SESSION_SECRET;
    else process.env.BI_CLOUD_SESSION_SECRET = prior;
  }
});

test('cloud adapter uses encrypted secure cookies and never requires a service-role key', () => {
  assert.match(sessionSource, /aes-256-gcm/);
  assert.match(sessionSource, /HttpOnly; Secure; SameSite=/);
  assert.match(sessionSource, /BI_CLOUD_SESSION_SECRET/);
  assert.match(sessionSource, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(auth + documents, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  assert.match(sessionSource, /grant_type=refresh_token/);
  assert.match(auth, /grant_type=pkce/);
  assert.match(auth, /Supabase Auth creates and validates its own OAuth state/);
  assert.doesNotMatch(auth, /searchParams\.get\('state'\)|&state=\$\{encodeURIComponent\(state\)\}/);
});

test('document API enforces allowlisted types, JSON objects and 1 MiB payloads', () => {
  assert.match(documents, /workspace_documents/);
  assert.match(documents, /ALLOWED_TYPES/);
  assert.match(documents, /1024 \* 1024/);
  assert.match(documents, /session\.accessToken/);
  assert.match(documents, /on_conflict=owner_id,document_type,document_key/);
  assert.doesNotMatch(documents, /chatbot_history|teacher_history/);
});

test('cloud page offers explicit document saves and does not auto-sync private histories', () => {
  assert.match(page, /Workspace documents/);
  assert.match(page, /AI chat histories.*automatic/i);
  assert.match(client, /\/api\/cloud-documents/);
  assert.doesNotMatch(client, /chatbot_history|teacher_history/);
});

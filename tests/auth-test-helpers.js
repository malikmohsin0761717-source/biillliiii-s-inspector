'use strict';

const TEST_USERNAME = 'OwnerTest';
const TEST_PASSWORD = 'Test-Only-Strong-Passphrase-2026';

async function request(base, pathname, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-Requested-With'] = 'BiillliiiiInspector';
  if (options.cookie) headers.Cookie = options.cookie;
  return fetch(`${base}${pathname}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
  });
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie');
  assertCookie(value);
  return value.split(';')[0];
}

function assertCookie(value) {
  if (!value || !value.startsWith('biillliiii_session=')) throw new Error('Login response did not set the owner session cookie.');
}

async function setupOwner(base, username = TEST_USERNAME, password = TEST_PASSWORD) {
  const response = await request(base, '/api/auth/setup', {
    method: 'POST', body: { username, password, confirmPassword: password }
  });
  if (response.status !== 201) throw new Error(`Owner setup failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  return { recoveryCode: payload.recoveryCode, username, password };
}

async function loginOwner(base, username = TEST_USERNAME, password = TEST_PASSWORD) {
  const response = await request(base, '/api/auth/login', {
    method: 'POST', body: { username, password }
  });
  if (response.status !== 200) throw new Error(`Owner login failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  return { cookie: cookieFrom(response), username: payload.username };
}

async function setupAndLogin(base) {
  await setupOwner(base);
  return loginOwner(base);
}


function createTestData(sourceRoot, projectDir) {
  const dataDir = require('node:path').join(projectDir, 'data');
  require('node:fs').mkdirSync(dataDir, { recursive: true });
  const seedSource = require('node:path').join(sourceRoot, 'data', 'projects.seed.json');
  require('node:fs').copyFileSync(seedSource, require('node:path').join(dataDir, 'projects.seed.json'));
  require('node:fs').writeFileSync(require('node:path').join(dataDir, 'projects.json'), JSON.stringify({ schemaVersion: 1, projects: [], activeMonitor: null, lastMonitorSummary: null }, null, 2));
}

module.exports = { request, cookieFrom, setupOwner, loginOwner, setupAndLogin, createTestData, TEST_USERNAME, TEST_PASSWORD };

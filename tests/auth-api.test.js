'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { request, setupOwner, loginOwner, TEST_USERNAME, TEST_PASSWORD, createTestData } = require('./auth-test-helpers');

const sourceRoot = path.resolve(__dirname, '..');

function copyApp(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const name of ['server.js', 'auth.js', 'cloud-auth.js', 'ai-provider.js', 'workspace-core.js']) fs.cpSync(path.join(sourceRoot, name), path.join(projectDir, name));
  fs.cpSync(path.join(sourceRoot, 'ui'), path.join(projectDir, 'ui'), { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'monitoring'), path.join(projectDir, 'monitoring'), { recursive: true });
  createTestData(sourceRoot, projectDir);
  // The source development workspace may already have an owner; test fixtures must start unconfigured.
  fs.rmSync(path.join(projectDir, 'data', 'auth.json'), { force: true });
}

function startServer(projectDir, port, extraEnv = {}) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port), BI_DATA_DIR: 'data', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start in time.')), 7000);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('is available at')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited early with code ${code}.`)); });
  });
}

function stop(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500).unref();
  });
}

test('owner setup, login, protected APIs, logout and recovery work without changing project data', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-auth-test-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataFile = path.join(projectDir, 'data', 'projects.json');
  fs.copyFileSync(path.join(projectDir, 'data', 'projects.seed.json'), dataFile);
  const initialProjectData = fs.readFileSync(dataFile, 'utf8');
  const port = 5200 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await startServer(projectDir, port);

    let response = await request(base, '/api/auth/status');
    assert.equal(response.status, 200);
    let payload = await response.json();
    assert.equal(payload.configured, false);
    assert.equal(payload.authenticated, false);

    response = await request(base, '/api/projects');
    assert.equal(response.status, 401);
    response = await request(base, '/api/health');
    assert.equal(response.status, 200);

    response = await fetch(base, { headers: { 'Host': `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    const html = await response.text();
    // Public Welcome page is the initial screen; authentication and dashboard stay hidden.
    assert.match(html, /id="landing" class="landing-view"/);
    assert.match(html, /id="welcomePrimaryAction"[^>]*data-auth="signup"/);
    assert.match(html, /id="authView" class="auth-view hidden"/);
    assert.match(html, /id="backToWelcome"/);
    assert.match(html, /id="dashboard" class="dashboard-view hidden"/);

    response = await request(base, '/api/auth/setup', {
      method: 'POST', body: { username: TEST_USERNAME, password: 'short', confirmPassword: 'short' }
    });
    assert.equal(response.status, 400);
    assert.equal(fs.existsSync(path.join(projectDir, 'data', 'auth.json')), false);

    const owner = await setupOwner(base);
    assert.equal(typeof owner.recoveryCode, 'string');
    assert.equal(owner.recoveryCode.length, 40);
    const authFile = fs.readFileSync(path.join(projectDir, 'data', 'auth.json'), 'utf8');
    assert.doesNotMatch(authFile, new RegExp(TEST_PASSWORD));
    assert.doesNotMatch(authFile, new RegExp(owner.recoveryCode));
    assert.match(authFile, /"algorithm": "scrypt"/);

    response = await request(base, '/api/auth/setup', {
      method: 'POST', body: { username: 'OtherOwner', password: TEST_PASSWORD, confirmPassword: TEST_PASSWORD }
    });
    assert.equal(response.status, 409);

    response = await request(base, '/api/auth/login', {
      method: 'POST', body: { username: TEST_USERNAME, password: 'wrong password value' }
    });
    assert.equal(response.status, 401);

    // Capture cookie attributes from the successful login response.
    response = await request(base, '/api/auth/login', {
      method: 'POST', body: { username: TEST_USERNAME, password: TEST_PASSWORD }
    });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Path=\//);
    const login = { cookie: setCookie.split(';')[0] };

    response = await request(base, '/api/projects', { cookie: login.cookie });
    assert.equal(response.status, 200);

    response = await request(base, '/api/projects', {
      cookie: login.cookie, headers: { Origin: 'http://untrusted.example' }
    });
    assert.equal(response.status, 403);

    response = await fetch(`${base}/api/projects/BI-0001/decisions`, {
      method: 'POST', headers: { Cookie: login.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'This request has no same-origin marker.' })
    });
    assert.equal(response.status, 403);

    response = await request(base, '/api/auth/activity', { method: 'POST', cookie: login.cookie, body: {} });
    assert.equal(response.status, 200);

    response = await request(base, '/api/auth/logout', { method: 'POST', cookie: login.cookie, body: {} });
    assert.equal(response.status, 200);
    response = await request(base, '/api/projects', { cookie: login.cookie });
    assert.equal(response.status, 401);

    const recoverResponse = await request(base, '/api/auth/recover', {
      method: 'POST', body: {
        username: TEST_USERNAME,
        recoveryCode: owner.recoveryCode,
        newPassword: 'New-Owner-Strong-Passphrase-2026',
        confirmPassword: 'New-Owner-Strong-Passphrase-2026'
      }
    });
    assert.equal(recoverResponse.status, 200);
    const recovery = await recoverResponse.json();
    assert.equal(recovery.recovered, true);
    assert.equal(recovery.recoveryCode.length, 40);
    assert.notEqual(recovery.recoveryCode, owner.recoveryCode);

    response = await request(base, '/api/auth/login', {
      method: 'POST', body: { username: TEST_USERNAME, password: TEST_PASSWORD }
    });
    assert.equal(response.status, 401);
    const relogin = await loginOwner(base, TEST_USERNAME, 'New-Owner-Strong-Passphrase-2026');
    response = await request(base, '/api/projects', { cookie: relogin.cookie });
    assert.equal(response.status, 200);

    assert.equal(fs.readFileSync(dataFile, 'utf8'), initialProjectData, 'Auth setup must not rewrite projects.json.');
  } finally {
    await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('server-side idle expiry locks the owner session and pauses active monitoring', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-auth-idle-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataFile = path.join(projectDir, 'data', 'projects.json');
  fs.copyFileSync(path.join(projectDir, 'data', 'projects.seed.json'), dataFile);
  const port = 5600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await startServer(projectDir, port, { BI_AUTH_IDLE_TIMEOUT_MS: '180' });
    await setupOwner(base);
    const login = await loginOwner(base);
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    data.activeMonitor = {
      sessionId: 'idle-lock-monitor-test', projectId: 'BI-0001', activity: 'Idle lock monitor safety test',
      state: 'running', startedAt: new Date(Date.now() - 5000).toISOString(), pausedAt: null,
      pausedTotalMs: 0, samples: [], warnings: []
    };
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    await new Promise(resolve => setTimeout(resolve, 250));
    const response = await request(base, '/api/projects/BI-0001', { cookie: login.cookie });
    assert.equal(response.status, 401);
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(saved.activeMonitor.state, 'paused');
    assert.ok(saved.activeMonitor.pausedAt);
  } finally {
    await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

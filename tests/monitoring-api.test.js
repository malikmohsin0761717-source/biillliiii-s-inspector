'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { request, setupAndLogin, loginOwner, createTestData } = require('./auth-test-helpers');

const sourceRoot = path.resolve(__dirname, '..');

function waitForServer(child, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start in time.')), timeoutMs);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('is available at')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited early with code ${code}.`)); });
  });
}

async function startServer(projectDir, port) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port), BI_DATA_DIR: 'data' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer(child);
  return child;
}

function stop(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 2000).unref();
  });
}

function copyApp(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const name of ['server.js', 'auth.js', 'cloud-auth.js', 'ai-provider.js', 'workspace-core.js']) fs.cpSync(path.join(sourceRoot, name), path.join(projectDir, name));
  fs.cpSync(path.join(sourceRoot, 'ui'), path.join(projectDir, 'ui'), { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'monitoring'), path.join(projectDir, 'monitoring'), { recursive: true });
  createTestData(sourceRoot, projectDir);
  // Do not copy the developer's real owner credentials into a temporary test app.
  fs.rmSync(path.join(projectDir, 'data', 'auth.json'), { force: true });
}

test('monitor start is blocked for an empty workspace without creating a session or backup', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-empty-monitor-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataDir = path.join(projectDir, 'data');
  const dataFile = path.join(dataDir, 'projects.json');
  const emptyStore = { schemaVersion: 1, projects: [], activeMonitor: null, lastMonitorSummary: null };
  fs.writeFileSync(dataFile, JSON.stringify(emptyStore, null, 2));
  const port = 4550 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await startServer(projectDir, port);
    const { cookie } = await setupAndLogin(base);
    const before = fs.readFileSync(dataFile);
    const existingMonitorBackups = fs.readdirSync(dataDir).filter(name => name.startsWith('projects.json.backup-monitor-')).length;
    const response = await request(base, '/api/monitor/start', {
      method: 'POST', cookie,
      body: { projectId: 'BI-0001', activity: 'Must not start without a project' }
    });
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.match(payload.error, /No projects available/);
    assert.deepEqual(fs.readFileSync(dataFile), before);
    assert.equal(fs.readdirSync(dataDir).filter(name => name.startsWith('projects.json.backup-monitor-')).length, existingMonitorBackups);
    const status = await request(base, '/api/monitor/status', { cookie });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).state, 'idle');
  } finally {
    if (child) await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('monitor start rejects a project ID that is not in the saved workspace', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-invalid-monitor-project-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataDir = path.join(projectDir, 'data');
  const dataFile = path.join(dataDir, 'projects.json');
  const seed = JSON.parse(fs.readFileSync(path.join(dataDir, 'projects.seed.json'), 'utf8'));
  seed.activeMonitor = null;
  seed.projects = [{ id: 'BI-0001', name: 'Test project', goal: 'Test', type: 'Other', status: 'Planning', checklist: [], sessions: [], decisions: [], memoryHistory: [] }];
  fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2));
  const port = 4850 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await startServer(projectDir, port);
    const { cookie } = await setupAndLogin(base);
    const before = fs.readFileSync(dataFile);
    const existingMonitorBackups = fs.readdirSync(dataDir).filter(name => name.startsWith('projects.json.backup-monitor-')).length;
    const response = await request(base, '/api/monitor/start', {
      method: 'POST', cookie,
      body: { projectId: 'BI-9999', activity: 'Must reject unknown project' }
    });
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.match(payload.error, /Selected project was not found/);
    assert.deepEqual(fs.readFileSync(dataFile), before);
    assert.equal(fs.readdirSync(dataDir).filter(name => name.startsWith('projects.json.backup-monitor-')).length, existingMonitorBackups);
  } finally {
    if (child) await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('monitor status is protected; non-Windows start is safely rejected after owner login', async t => {
  if (process.platform === 'win32') return t.skip('The non-Windows guard is tested only on non-Windows hosts.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-monitor-api-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataFile = path.join(projectDir, 'data', 'projects.json');
  fs.writeFileSync(dataFile, JSON.stringify({ schemaVersion: 1, projects: [{ id: 'BI-0001', name: 'Test project', goal: 'Test', type: 'Other', status: 'Planning', checklist: [], sessions: [], decisions: [], memoryHistory: [] }], activeMonitor: null }, null, 2));
  const port = 4600 + Math.floor(Math.random() * 300);
  const child = await startServer(projectDir, port);
  try {
    const base = `http://127.0.0.1:${port}`;
    let response = await request(base, '/api/monitor/status');
    assert.equal(response.status, 401);

    const { cookie } = await setupAndLogin(base);
    response = await request(base, '/api/monitor/status', { cookie });
    assert.equal(response.status, 200);
    let payload = await response.json();
    assert.equal(payload.state, 'idle');

    response = await request(base, '/api/monitor/start', {
      method: 'POST', cookie,
      body: { projectId: 'BI-0001', activity: 'Should not start on non-Windows' }
    });
    assert.equal(response.status, 501);
    payload = await response.json();
    assert.match(payload.error, /only on Windows/);

    response = await request(base, '/api/projects/BI-0001', { cookie });
    payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.project.sessions.length, 0);
  } finally {
    await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('startup converts a persisted active session to one interrupted history record for an authenticated owner', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-interrupted-recovery-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataFile = path.join(projectDir, 'data', 'projects.json');
  const seed = JSON.parse(fs.readFileSync(path.join(projectDir, 'data', 'projects.seed.json'), 'utf8'));
  seed.projects = [{ id: 'BI-0001', name: 'Recovery project', goal: 'Test recovery', type: 'Other', status: 'Active', checklist: [], sessions: [], decisions: [], memoryHistory: [] }];
  seed.activeMonitor = {
    sessionId: 'crash-recovery-session', projectId: 'BI-0001', activity: 'Crash recovery verification',
    state: 'running', startedAt: new Date(Date.now() - 25_000).toISOString(), pausedAt: null,
    pausedTotalMs: 0, samples: [{ activeApp: 'chrome', cpuPercent: 12, ramUsedPercent: 72 }], warnings: []
  };
  fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2));
  const port = 4900 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await startServer(projectDir, port);
    let response = await request(base, '/api/projects/BI-0001');
    assert.equal(response.status, 401);
    let { cookie } = await setupAndLogin(base);
    response = await request(base, '/api/projects/BI-0001', { cookie });
    assert.equal(response.status, 200);
    let payload = await response.json();
    const recovered = payload.project.sessions.filter(item => item.id === 'crash-recovery-session');
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].status, 'interrupted');
    assert.equal(recovered[0].sampleCount, 1);
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(saved.activeMonitor, null);

    await stop(child);
    child = null;
    child = await startServer(projectDir, port);
    ({ cookie } = await loginOwner(base));
    response = await request(base, '/api/projects/BI-0001', { cookie });
    payload = await response.json();
    assert.equal(payload.project.sessions.filter(item => item.id === 'crash-recovery-session').length, 1);
  } finally {
    if (child) await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

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
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}.`));
    });
  });
}

function stop(child) {
  return new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500).unref();
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

test('project memory, checklist, decisions and sessions persist after authenticated server restart', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-memory-test-'));
  const projectDir = path.join(temp, 'app');
  fs.mkdirSync(projectDir, { recursive: true });
  for (const name of ['server.js', 'auth.js', 'cloud-auth.js', 'ai-provider.js', 'workspace-core.js']) fs.cpSync(path.join(sourceRoot, name), path.join(projectDir, name));
  fs.cpSync(path.join(sourceRoot, 'ui'), path.join(projectDir, 'ui'), { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'monitoring'), path.join(projectDir, 'monitoring'), { recursive: true });
  createTestData(sourceRoot, projectDir);
  // Each temporary test app starts with a fresh owner setup, not the developer's local auth file.
  fs.rmSync(path.join(projectDir, 'data', 'auth.json'), { force: true });
  const port = 4187 + Math.floor(Math.random() * 400);
  const base = `http://127.0.0.1:${port}`;
  let child;

  try {
    child = await startServer(projectDir, port);
    let { cookie } = await setupAndLogin(base);
    let response = await request(base, '/api/projects', { cookie });
    assert.equal(response.status, 200);
    let payload = await response.json();
    assert.equal(payload.projects.length, 0);
    response = await request(base, '/api/projects', { method: 'POST', cookie, body: { name: 'Persistence project', goal: 'Test persistence', type: 'Other', status: 'Active' } });
    assert.equal(response.status, 201);
    const projectId = (await response.json()).project.id;

    response = await request(base, `/api/projects/${projectId}/memory`, {
      method: 'PUT', cookie,
      body: {
        goal: 'Test goal saved locally',
        lastCompletedTask: 'Saved a test memory',
        nextStep: 'Restart the server and verify',
        memoryNotes: 'Persistence test note'
      }
    });
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.saved, true);
    assert.equal(payload.project.goal, 'Test goal saved locally');

    response = await request(base, `/api/projects/${projectId}/checklist`, { method: 'POST', cookie, body: { title: 'Persistence test task' } });
    assert.equal(response.status, 201);
    payload = await response.json();
    const taskId = payload.task.id;
    assert.ok(taskId);

    response = await request(base, `/api/projects/${projectId}/checklist/${encodeURIComponent(taskId)}`, {
      method: 'PATCH', cookie, body: { done: true }
    });
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.task.done, true);

    response = await request(base, `/api/projects/${projectId}/decisions`, { method: 'POST', cookie, body: { text: 'Keep test data local' } });
    assert.equal(response.status, 201);

    response = await request(base, `/api/projects/${projectId}/sessions`, {
      method: 'POST', cookie, body: { activity: 'Memory persistence test', durationMinutes: 3, notes: 'Local test' }
    });
    assert.equal(response.status, 201);

    await stop(child);
    child = null;
    child = await startServer(projectDir, port);
    ({ cookie } = await loginOwner(base)); // Server restart invalidates in-memory sessions.

    response = await request(base, `/api/projects/${projectId}`, { cookie });
    assert.equal(response.status, 200);
    payload = await response.json();
    assert.equal(payload.project.goal, 'Test goal saved locally');
    assert.equal(payload.project.lastCompletedTask, 'Saved a test memory');
    assert.equal(payload.project.checklist.find(item => item.id === taskId).done, true);
    assert.ok(payload.project.decisions.some(item => item.text === 'Keep test data local'));
    assert.ok(payload.project.sessions.some(item => item.activity === 'Memory persistence test'));
    assert.equal(payload.project.progress, 100);

    response = await request(base, `/api/projects/${projectId}/export`, { cookie });
    assert.equal(response.status, 200);
    const markdown = await response.text();
    assert.match(markdown, /Test goal saved locally/);
    assert.match(markdown, /Keep test data local/);
  } finally {
    if (child) await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { request, setupAndLogin, createTestData } = require('./auth-test-helpers');

const sourceRoot = path.resolve(__dirname, '..');

function copyApp(projectDir) {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const name of ['server.js', 'auth.js', 'cloud-auth.js', 'ai-provider.js', 'workspace-core.js']) {
    fs.cpSync(path.join(sourceRoot, name), path.join(projectDir, name));
  }
  fs.cpSync(path.join(sourceRoot, 'ui'), path.join(projectDir, 'ui'), { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'monitoring'), path.join(projectDir, 'monitoring'), { recursive: true });
  createTestData(sourceRoot, projectDir);
  fs.rmSync(path.join(projectDir, 'data', 'auth.json'), { force: true });
  fs.writeFileSync(path.join(projectDir, 'data', 'projects.json'), JSON.stringify({
    schemaVersion: 1,
    projects: [],
    activeMonitor: null,
    lastMonitorSummary: null
  }, null, 2));
}

function startServer(projectDir, port) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port), BI_DATA_DIR: 'data' },
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
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1800).unref();
  });
}

test('authenticated owner can create projects with server-generated IDs and empty records', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-project-create-'));
  const projectDir = path.join(temp, 'app');
  copyApp(projectDir);
  const dataFile = path.join(projectDir, 'data', 'projects.json');
  const port = 5200 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  let child;

  try {
    child = await startServer(projectDir, port);

    let response = await request(base, '/api/projects', {
      method: 'POST', body: { name: 'Must be blocked', type: 'Learning', goal: 'Test auth' }
    });
    assert.equal(response.status, 401);

    const { cookie } = await setupAndLogin(base);
    response = await request(base, '/api/projects', { cookie });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).projects, []);

    const beforeInvalid = fs.readFileSync(dataFile);
    response = await request(base, '/api/projects', {
      method: 'POST', cookie, body: { name: '   ', type: 'Learning', goal: 'A valid goal' }
    });
    assert.equal(response.status, 400);
    assert.deepEqual(fs.readFileSync(dataFile), beforeInvalid);

    response = await request(base, '/api/projects', {
      method: 'POST', cookie, body: { name: 'Bad type', type: 'Unknown', goal: 'A valid goal' }
    });
    assert.equal(response.status, 400);
    assert.deepEqual(fs.readFileSync(dataFile), beforeInvalid);

    response = await request(base, '/api/projects', {
      method: 'POST', cookie, body: { name: 'Bad status', type: 'Learning', goal: 'A valid goal', status: 'Archived' }
    });
    assert.equal(response.status, 400);
    assert.deepEqual(fs.readFileSync(dataFile), beforeInvalid);

    response = await request(base, '/api/projects', {
      method: 'POST', cookie,
      body: {
        id: 'BI-9999',
        name: 'Website Learning',
        type: 'Learning',
        goal: 'Learn to build a small website using beginner-friendly tools.',
        nextStep: 'Choose the first practice page.',
        status: 'Planning'
      }
    });
    assert.equal(response.status, 201);
    let payload = await response.json();
    assert.equal(payload.saved, true);
    assert.equal(payload.projectCount, 1);
    assert.equal(payload.project.id, 'BI-0001');
    assert.equal(payload.project.name, 'Website Learning');
    assert.equal(payload.project.symbol, '◈');
    assert.equal(payload.project.status, 'Planning');
    assert.equal(payload.project.goal, 'Learn to build a small website using beginner-friendly tools.');
    assert.equal(payload.project.nextStep, 'Choose the first practice page.');
    assert.deepEqual(payload.project.checklist, []);
    assert.deepEqual(payload.project.decisions, []);
    assert.deepEqual(payload.project.sessions, []);
    assert.deepEqual(payload.project.memoryHistory, []);
    assert.equal(payload.project.progress, 0);

    response = await request(base, '/api/projects', {
      method: 'POST', cookie,
      body: { name: 'Small Business', type: 'Business', goal: 'Organize the business idea.', status: 'Active' }
    });
    assert.equal(response.status, 201);
    payload = await response.json();
    assert.equal(payload.project.id, 'BI-0002');
    assert.equal(payload.project.status, 'Active');

    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(saved.projects.length, 2);
    assert.equal(saved.projects[0].id, 'BI-0001');
    assert.equal(saved.projects[1].id, 'BI-0002');
    assert.equal(saved.activeMonitor, null);
  } finally {
    if (child) await stop(child);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { request, setupAndLogin, createTestData } = require('./auth-test-helpers');
const sourceRoot = path.resolve(__dirname, '..');
function copyApp(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ['server.js', 'auth.js', 'cloud-auth.js', 'ai-provider.js', 'workspace-core.js']) fs.cpSync(path.join(sourceRoot, name), path.join(dir, name));
  for (const name of ['ui', 'monitoring']) fs.cpSync(path.join(sourceRoot, name), path.join(dir, name), { recursive: true });
  createTestData(sourceRoot, dir);
fs.rmSync(path.join(dir, 'data', 'ai'), { recursive: true, force: true });
  fs.copyFileSync(path.join(dir, 'data', 'projects.seed.json'), path.join(dir, 'data', 'projects.json'));
  fs.rmSync(path.join(dir, 'data', 'auth.json'), { force: true });
}
function start(dir, port) {
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port), BI_DATA_DIR: 'data' }, stdio: ['ignore','pipe','pipe'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start.')), 7000);
    child.stdout.on('data', chunk => { if (String(chunk).includes('is available at')) { clearTimeout(timer); resolve(child); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
}
function stop(child) { return new Promise(resolve => { if (!child || child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill('SIGTERM'); setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1500).unref(); }); }
test('AI chatbot and teacher histories are owner-protected and stored separately on disk', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-ai-local-'));
  const dir = path.join(temp, 'app'); copyApp(dir);
  const port = 6000 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await start(dir, port);
    let response = await request(base, '/api/ai/chatbot/conversations');
    assert.equal(response.status, 401);
    const { cookie } = await setupAndLogin(base);
    response = await request(base, '/api/ai/chatbot/conversations', { cookie });
    if (response.status !== 200) throw new Error(`AI GET failed ${response.status}: ${await response.text()}`); assert.deepEqual((await response.json()).conversations, []);
    response = await request(base, '/api/ai/chatbot/conversations', { method: 'POST', cookie, body: { title: 'Hello', messages: [{ role: 'user', content: 'Test local note' }] } });
    assert.equal(response.status, 200); const saved = (await response.json()).conversation;
    assert.equal(saved.messages[0].content, 'Test local note');
    response = await request(base, '/api/ai/teacher/conversations', { method: 'POST', cookie, body: { title: 'Lesson', messages: [{ role: 'user', content: 'Learn JavaScript' }] } });
    assert.equal(response.status, 200);
    response = await request(base, '/api/ai/chatbot/conversations', { cookie });
    assert.equal((await response.json()).conversations.length, 1);
    response = await request(base, '/api/ai/teacher/progress', { method: 'PUT', cookie, body: { goals: ['Learn basics'], completedLessons: ['Variables'], notes: 'Practice daily' } });
    assert.equal(response.status, 200);
    const baseDir = path.join(dir, 'data', 'ai');
    assert.equal(fs.existsSync(path.join(baseDir, 'chatbot', 'conversations.json')), true);
    assert.equal(fs.existsSync(path.join(baseDir, 'teacher', 'conversations.json')), true);
    assert.equal(fs.existsSync(path.join(baseDir, 'teacher', 'learning-progress.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'data', 'projects.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'data', 'auth.json')), true);
  } finally { await stop(child); fs.rmSync(temp, { recursive: true, force: true }); }
});

test('OpenAI response endpoint is owner-protected and disabled by default without sending requests', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'biillliiii-ai-disabled-'));
  const dir = path.join(temp, 'app'); copyApp(dir);
  const port = 6300 + Math.floor(Math.random() * 200), base = `http://127.0.0.1:${port}`;
  let child;
  try {
    child = await start(dir, port);
    let response = await request(base, '/api/ai/chatbot/respond', { method: 'POST', body: { messages: [{ role: 'user', content: 'Hello' }] } });
    assert.equal(response.status, 401);
    const { cookie } = await setupAndLogin(base);
    response = await request(base, '/api/ai/status', { cookie });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, false);
    response = await request(base, '/api/ai/chatbot/respond', { method: 'POST', cookie, body: { messages: [{ role: 'user', content: 'Hello' }] } });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'AI_DISABLED');
  } finally { await stop(child); fs.rmSync(temp, { recursive: true, force: true }); }
});

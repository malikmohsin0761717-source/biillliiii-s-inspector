'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'cloud', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'cloud', 'app.js'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'api', 'cloud-ai.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'api', 'cloud-projects.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'api', 'cloud-documents.js'), 'utf8');

test('cloud UI exposes every requested workspace section', () => {
  for (const view of ['home','projects','inspector','chatbot','teacher','records','chats','monitoring','important','stopped','reminders','alerts','reports','settings']) {
    assert.match(html, new RegExp('data-view="' + view + '"'));
    assert.match(html, new RegExp('data-panel="' + view + '"'));
  }
});

test('projects UI is connected to authenticated cloud CRUD adapter', () => {
  assert.match(app, /api\('\/api\/cloud-projects'/);
  assert.match(app, /api\('\/api\/cloud-projects\?id=/);
  assert.match(projects, /requireSession/);
  assert.match(projects, /assertSameOrigin/);
});

test('Chatbot and Teacher keep separate cloud histories and teacher progress', () => {
  assert.match(app, /chats = \{\s*chatbot:/);
  assert.match(app, /histories = \{ chatbot: \[\], teacher: \[\] \}/);
  assert.match(app, /resource=progress/);
  assert.match(ai, /ai_teacher_progress/);
  assert.match(ai, /mode=eq\.\$\{mode\}/);
});

test('cloud Inspector uses read-only analyst mode and selected project context', () => {
  assert.match(app, /api\('\/api\/cloud-ai\?mode=analyst&resource=respond'/);
  assert.match(ai, /'analyst'/);
  assert.match(ai, /AI Inspector mode only supports read-only response requests/);
});

test('workspace tools use the owner-authenticated document API and bounded typed documents', () => {
  assert.match(app, /api\('\/api\/cloud-documents'/);
  assert.match(app, /const edit=el\('button','secondary','Edit'\)/);
  assert.match(app, /async function deleteConversation\(mode\)/);
  assert.match(html, /id="deleteChatbot"/);
  assert.match(html, /id="deleteTeacher"/);
  assert.match(docs, /assertSameOrigin/);
  assert.match(docs, /requireSession/);
  assert.match(docs, /ALLOWED_TYPES/);
  assert.match(docs, /1024 \* 1024/);
});

test('reminders and alerts have human-friendly forms and permission-gated notifications', () => {
  assert.match(html, /id="enableNotifications"/);
  assert.match(app, /function enableNotifications\(\)/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /async function scheduleReminderNotifications\(\)/);
  assert.match(app, /dueAt/);
  assert.match(app, /DocDetails/);
  assert.match(app, /DocDue/);
  assert.match(app, /new Notification\('Biillliiii Inspector reminder'/);
});

test('AI tools show whether the server-side provider is configured without exposing secrets', () => {
  assert.match(html, /chatbotProviderStatus/);
  assert.match(html, /teacherProviderStatus/);
  assert.match(html, /inspectorProviderStatus/);
  assert.match(app, /resource=provider-status/);
  assert.match(ai, /OPENAI_API_ENABLED==='true'/);
  assert.match(ai, /Boolean\(process\.env\.OPENAI_API_KEY\)/);
});

test('cloud page does not pretend to remotely activate Windows monitoring', () => {
  assert.match(html, /Cloud connection: not paired/);
  assert.match(html, /local app se chalti hai/);
  assert.doesNotMatch(app, /process\.env|SUPABASE_SERVICE_ROLE_KEY/);
});

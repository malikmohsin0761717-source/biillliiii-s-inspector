'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');

test('AI UI exposes local-only mode by default and supports explicit server-enabled send action', () => {
  assert.match(app, /OpenAI requests are disabled by default/);
  assert.match(app, /data-ai-submit>Save locally/);
  assert.match(app, /root\.dataset\.aiEnabled === 'true'/);
  assert.match(app, /\/api\/ai\/\$\{mode\}\/respond/);
  assert.match(app, /Message local history mein save ho gaya/);
});

test('AI UI registers only one AI submit handler and one history loader', () => {
  assert.equal((app.match(/async function loadAiLocalView\(mode\)/g) || []).length, 1);
  assert.equal((app.match(/const form = event\.target\.closest\('\[data-ai-form\]'\)/g) || []).length, 1);
});

test('local owner session survives browser refresh while manual logout remains explicit', () => {
  const branch = app.slice(app.indexOf('if (status.localAuthenticated)'), app.indexOf('showLanding();', app.indexOf('if (status.localAuthenticated)')));
  assert.match(branch, /authenticated = true/);
  assert.match(branch, /showDashboard\('home'\)/);
  assert.doesNotMatch(branch, /api\/auth\/logout/);
  assert.match(app, /api\('\/api\/auth\/logout'/);
});

test('AI Teacher UI exposes editable learning goals, completed lessons, and local progress save', () => {
  assert.match(app, /data-ai-add-goal/);
  assert.match(app, /data-ai-add-lesson/);
  assert.match(app, /data-ai-remove-goal/);
  assert.match(app, /data-ai-remove-lesson/);
  assert.match(app, /completedLessons: JSON\.parse\(root\.dataset\.aiLessons/);
  assert.match(app, /Save progress/);
});

test('AI history supports confirmed local conversation deletion in each separate mode', () => {
  assert.match(app, /data-ai-delete=/);
  assert.match(app, /method: 'DELETE'/);
  assert.match(app, /local history se delete karna hai/);
});

test('Project context sharing is explicit, opt-in, and limited to selected project summary fields', () => {
  assert.match(app, /data-ai-attach-project/);
  assert.match(app, /data-ai-project-select/);
  assert.match(app, /getAiProjectContext\(projectId\)/);
  assert.match(app, /root\.dataset\.aiEnabled === 'true' && form\.querySelector\('\[data-ai-attach-project\]'\)\?\.checked/);
  assert.match(app, /Last completed task:/);
  assert.match(app, /Checklist:/);
});

test('Project context is request-scoped and excluded from persisted conversation messages', () => {
  assert.match(app, /Project context saved chat mein store nahi hota/);
  assert.match(app, /let projectContext = ''/);
  assert.match(app, /projectContext \? \{ projectContext \} : \{\}/);
  assert.doesNotMatch(app, /messages\.push\(\{ role: 'user', content: context/);
  assert.match(app, /contextCheckbox\.checked = false/);
});

test('AI submit shows a sending state and restores the submit control after completion', () => {
  assert.match(app, /submitButton\.textContent = 'Sending…'/);
  assert.match(app, /submitButton\.textContent = originalSubmitLabel/);
});

test('Long local chat history is bounded to 200 messages before saving', () => {
  assert.match(app, /function boundedAiMessages\(messages\)/);
  assert.match(app, /messages: boundedAiMessages\(messages\)/);
  assert.match(app, /messages: boundedAiMessages\(savedConversation\.messages\)/);
});

test('AI response failure offers a retry without silently re-sharing project context', () => {
  assert.match(app, /data-ai-retry=/);
  assert.match(app, /Retry AI \(project context dobara share nahi hoga\)/);
  assert.match(app, /retryButton = event\.target\.closest\('\[data-ai-retry\]'\)/);
});

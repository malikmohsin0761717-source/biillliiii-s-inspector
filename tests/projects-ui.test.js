'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');

test('Projects page opens a real creation form with the agreed fields', () => {
  assert.ok(app.includes('data-project-action="new"'));
  assert.ok(app.includes('id="createProjectForm"'));
  assert.ok(app.includes('name="name"'));
  assert.ok(app.includes('name="goal"'));
  assert.ok(app.includes('name="type"'));
  assert.ok(app.includes('name="nextStep"'));
  assert.ok(app.includes('name="status"'));
  assert.ok(app.includes("api('/api/projects'"));
  assert.ok(!app.includes('New project creation is planned for a later'));
});

test('project cards escape owner-entered fields before rendering', () => {
  assert.ok(app.includes('escapeHtml(project.name)'));
  assert.ok(app.includes('escapeHtml(project.id)'));
  assert.ok(app.includes("escapeHtml(project.symbol || '◈')"));
  assert.ok(app.includes("escapeHtml(project.status || 'Planning')"));
  assert.ok(app.includes("if (status === 'On hold') return 'project-tag on-hold'"));
  assert.ok(app.includes("if (status === 'Completed') return 'project-tag completed'"));
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'ui', 'styles.css'), 'utf8');

test('Decisions API supports reason, edit and delete while retaining project-scoped routes', () => {
  assert.match(server, /const decisionMatch = url\.pathname\.match\(\/\^\\\/api\\\/projects/);
  assert.match(server, /const reason = cleanText\(body\.reason \?\? '', 2000, 'Decision reason'\)/);
  assert.match(server, /req\.method === 'PATCH' && decisionMatch/);
  assert.match(server, /req\.method === 'DELETE' && decisionMatch/);
  assert.match(server, /decision\.updatedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(server, /Reason: \$\{item\.reason\}/);
});

test('Decisions UI allows adding a reason, editing, and confirmation before deletion', () => {
  assert.match(app, /name="reason" maxlength="2000"/);
  assert.match(app, /id="editDecisionForm"/);
  assert.match(app, /data-decision-delete=/);
  assert.match(app, /window\.confirm\('Kya is decision ko is project se delete karna hai\?'\)/);
  assert.match(app, /method: 'PATCH'/);
  assert.match(app, /method: 'DELETE'/);
});

test('Decision controls have responsive-compatible layout styling hooks', () => {
  assert.match(styles, /\.decision-item\s*\{/);
  assert.match(styles, /\.decision-content\s*\{/);
  assert.match(styles, /\.decision-edit-details/);
});

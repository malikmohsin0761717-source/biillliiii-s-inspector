'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'ui', 'styles.css'), 'utf8');
const start = app.indexOf('function renderImportant() {');
const end = app.indexOf('\nfunction renderStopped()', start);
const renderer = start >= 0 && end > start ? app.slice(start, end) : '';

test('Important page separates built-in workspace principles from personal saved items', () => {
  assert.ok(renderer, 'renderImportant function must exist');
  assert.match(renderer, /Built-in Workspace Principles/);
  assert.match(renderer, /Permission rule/);
  assert.match(renderer, /Free-first approach/);
  assert.match(renderer, /Teaching style/);
  assert.equal((renderer.match(/Built-in principle/g) || []).length, 3);
  assert.match(renderer, /personal saved items se alag/);
  assert.doesNotMatch(renderer, /Saved example/);
});

test('fresh workspace shows zero personal Important items with an honest empty state', () => {
  assert.match(renderer, /My Important Items/);
  assert.match(renderer, /importantCount/);
  assert.match(renderer, /importantItemsList/);
  assert.match(renderer, /importantForm/);
  assert.match(app, /function loadImportantView/);
  assert.match(app, /data-important-delete/);
});

test('Important page has responsive minimal-professional styles', () => {
  assert.match(styles, /\.important-principles-grid\s*\{/);
  assert.match(styles, /\.important-principle-card\s*\{/);
  assert.match(styles, /\.important-empty-state\s*\{/);
  assert.match(styles, /@media\(max-width:760px\).*important-principles-grid/s);
});


test('Important items expose an edit action and submit a protected PATCH request', () => {
  assert.match(app, /data-important-edit/);
  assert.match(app, /method: 'PATCH', body: JSON\.stringify\(\{ title, content \}\)/);
  assert.match(app, /Important item update ho gaya/);
});

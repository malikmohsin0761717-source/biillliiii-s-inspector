'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');
const start = app.indexOf('function renderChats() {');
const end = app.indexOf('\nfunction renderImportant()', start);
const chatsRenderer = start >= 0 && end > start ? app.slice(start, end) : '';

test('Chats page shows a truthful empty state instead of illustrative conversations', () => {
  assert.ok(chatsRenderer, 'renderChats function must exist');
  assert.match(chatsRenderer, /No conversations yet/);
  assert.match(chatsRenderer, /0 conversations/);
  assert.match(chatsRenderer, /empty-state/);
  assert.match(chatsRenderer, /ChatGPT and email conversations are not read or imported automatically/);
  assert.match(chatsRenderer, /Chat history syncing is not connected/);
  assert.doesNotMatch(chatsRenderer, /Work Companion design review/);
  assert.doesNotMatch(chatsRenderer, /Free online skills research/);
  assert.doesNotMatch(chatsRenderer, /Business ideas and customer problems/);
  assert.doesNotMatch(chatsRenderer, /Example chat index|Demo data|Illustrative entries/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'browser-extension', 'manifest.json'), 'utf8'));
const popup = fs.readFileSync(path.join(root, 'browser-extension', 'popup.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'browser-extension', 'popup.html'), 'utf8');
const guardsSource = fs.readFileSync(path.join(root, 'browser-extension', 'guards.js'), 'utf8');

function loadGuards() {
  const context = { URL, globalThis: {} };
  vm.runInNewContext(guardsSource, context);
  return context.globalThis.BIPrivacyGuards;
}

test('extension manifest stays aligned with v11.0.1 and has no background worker', () => {
  assert.equal(manifest.version, '11.0.1');
  assert.equal(manifest.manifest_version, 3);
  assert.equal(Object.hasOwn(manifest, 'background'), false);
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
});

test('every capture requires fresh confirmation regardless of saved approval or host permission', () => {
  assert.match(popup, /Fresh, explicit consent is required for EVERY capture/);
  assert.match(popup, /const confirmed = window\.confirm/);
  assert.ok(popup.indexOf('const confirmed = window.confirm') < popup.indexOf('chrome.scripting.executeScript'));
  assert.doesNotMatch(popup, /if\s*\(!approved\.includes\(origin\)\s*\|\|\s*!hasPermission\)\s*\{\s*const confirmed/);
});

test('page capture blocks forms, sensitive controls, contenteditable and textbox controls', () => {
  assert.match(popup, /document\.querySelector\('form'\)/);
  assert.match(popup, /\[contenteditable="true"\]/);
  assert.match(popup, /\[role="textbox"\]/);
  assert.match(popup, /password\|passcode\|otp/);
});

test('page capture blocks likely secrets and caps visible text', () => {
  assert.match(popup, /api\[_ -\]\?key/);
  assert.match(popup, /verification code/);
  assert.match(popup, /slice\(0, 12000\)/);
});

test('capture remains manual preview only and does not auto-send evidence', () => {
  assert.match(popup, /app ya AI ko auto-send nahi hui/);
  assert.doesNotMatch(popup, /fetch\s*\(|XMLHttpRequest|sendMessage\s*\(/);
  assert.match(html, /review before pasting into app/);
  assert.match(html, /Har capture se pehle fresh confirmation/);
});

test('privacy guard rejects sensitive hosts, paths, and non-web/local URLs', () => {
  const guards = loadGuards();
  assert.equal(guards.urlIsBlocked('https://mail.google.com/inbox'), true);
  assert.equal(guards.urlIsBlocked('https://example.com/login'), true);
  assert.equal(guards.urlIsBlocked('http://localhost:3000'), true);
  assert.equal(guards.urlIsBlocked('https://example.com/docs'), false);
});

test('privacy guard detects common secret patterns', () => {
  const guards = loadGuards();
  assert.equal(guards.textLooksSensitive('API_KEY=abcdefghijklmnop'), true);
  assert.equal(guards.textLooksSensitive('OTP: 123456'), true);
  assert.equal(guards.textLooksSensitive('CVV 123'), true);
  assert.equal(guards.textLooksSensitive('Public project documentation'), false);
});

test('domain removal revokes permission and removes stored approval', () => {
  assert.match(popup, /chrome\.permissions\.remove\(\{ origins: \[pattern\] \}\)/);
  assert.match(popup, /approvedDomains: next/);
});

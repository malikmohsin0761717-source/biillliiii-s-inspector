'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'api', 'cloud-auth', '[action].js'), 'utf8');
const local = fs.readFileSync(path.join(root, 'cloud-auth.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'cloud', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'cloud', 'app.js'), 'utf8');

test('hosted signup sends a verified same-site email confirmation redirect', () => {
  assert.match(route, /options:\s*\{\s*emailRedirectTo:\s*\x60\$\{origin\}\/\x60\s*\}/);
  assert.match(route, /Secure HTTPS origin required for email confirmation/);
});

test('password recovery sends a same-site redirect and retains the recovery session flow', () => {
  assert.match(route, /auth\/v1\/recover\?redirect_to=/);
  assert.match(route, /recovery-session/);
  assert.match(route, /update-password/);
  assert.match(local, /auth\/v1\/recover\?redirect_to=/);
});

test('cloud login and signup provide accessible password visibility controls', () => {
  assert.match(html, /data-password-toggle="password"/);
  assert.match(html, /data-password-toggle="confirmPassword"/);
  assert.match(app, /input\.type = reveal \? 'text' : 'password'/);
  assert.match(app, /setAttribute\('aria-label'/);
});

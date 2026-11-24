'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'scripts', 'openai-key.ps1'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const ui = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

test('OpenAI key is protected with Windows DPAPI CurrentUser SecureString storage', () => {
  assert.match(helper, /Read-Host .* -AsSecureString/);
  assert.match(helper, /ConvertFrom-SecureString -SecureString/);
  assert.match(helper, /ConvertTo-SecureString -String/);
  assert.match(helper, /LOCALAPPDATA/);
  assert.match(helper, /BiillliiiiInspector\\secrets/);
  assert.match(helper, /openai-key\.dpapi/);
  assert.match(helper, /CurrentUser/);
});

test('key setup removes plaintext .env API key and records explicit AI enablement', () => {
  assert.match(helper, /OPENAI_API_KEY/);
  assert.match(helper, /Set-LocalAiSetting \$true/);
  assert.match(helper, /Set-LocalAiSetting \$false/);
  assert.match(helper, /openai-disabled\.flag/);
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^Secret API Key\.txt$/m);
});

test('server decrypts local key before listening and fails closed if unavailable', () => {
  assert.match(server, /async function loadPersistedOpenAIConfig/);
  assert.match(server, /await loadPersistedOpenAIConfig\(\)/);
  assert.match(server, /execFileAsync\('powershell\.exe'/);
  assert.match(server, /Encrypted OpenAI key could not be loaded/);
  assert.match(server, /AI requests remain disabled/);
});

test('AI key controls are available without embedding a key in package scripts', () => {
  for (const name of ['ai:key:set', 'ai:key:enable', 'ai:key:disable', 'ai:key:remove']) {
    assert.ok(pkg.scripts[name], `missing npm script ${name}`);
    assert.match(pkg.scripts[name], /scripts\/openai-key\.ps1/);
    assert.doesNotMatch(pkg.scripts[name], /sk-[A-Za-z0-9]{10,}/);
  }
});

test('DPAPI self-test uses only a disposable test string and does not call OpenAI', () => {
  assert.match(helper, /BI-DPAPI-ROUNDTRIP-TEST-ONLY/);
  assert.doesNotMatch(helper, /api\.openai\.com|sk-[A-Za-z0-9]{10,}/);
});


test('AI UI shows a neutral loading label until the server reports actual availability', () => {
  assert.match(ui, /data-ai-status>Checking AI status…/);
  assert.match(ui, /OpenAI ready · \$\{aiStatus\.model/);
  assert.match(ui, /Local history · OpenAI disabled/);
});

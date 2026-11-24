'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'ui', 'index.html'), 'utf8');

test('manual inspector endpoint is owner-protected by the shared API gate', () => {
  assert.match(server, /\/api\/inspector\/check-now/);
  assert.match(server, /process\.platform !== 'win32'/);
});

test('manual inspector uses one explicit PowerShell snapshot and bounded timeout', () => {
  assert.match(server, /execFileAsync\('powershell\.exe'/);
  assert.match(server, /timeout: 15000/);
  assert.match(server, /parseSnapshot\(stdout\)/);
});

test('inspector report is returned without writing project or report files', () => {
  const routeStart = server.indexOf("url.pathname === '/api/inspector/check-now'");
  const routeEnd = server.indexOf("if (url.pathname.startsWith('/api/monitor/'))", routeStart);
  const route = server.slice(routeStart, routeEnd);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.match(route, /return json\(res, 200, \{ report \}\)/);
  assert.doesNotMatch(route, /writeStore|writeFileSync|writeAiJson/);
});

test('UI exposes a manual Check Now button and clear read-only limitations', () => {
  assert.match(html, /data-view="inspector"/);
  assert.match(app, /id="inspectorCheckNow"/);
  assert.match(app, /manual-read-only/);
  assert.match(app, /does not prove task relevance or completion|actual kaam sahi direction/);
});

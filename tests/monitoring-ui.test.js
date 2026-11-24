'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'ui', 'app.js'), 'utf8');

test('monitoring Start controls are disabled and explained when workspace has no projects', () => {
  assert.match(app, /const hasProjects = demoProjects\.length > 0/);
  assert.match(app, /id="monitorStartButton"[^`]*\$\{hasProjects \? '' : 'disabled'\}/);
  assert.match(app, /id="monitorEmptyGuidance"/);
  assert.match(app, /Monitoring start nahi ho sakti\. Pehle ek project create ya add karo\./);
  assert.match(app, /const canStartMonitoring = demoProjects\.length > 0/);
});

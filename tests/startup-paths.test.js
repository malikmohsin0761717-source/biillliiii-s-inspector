'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('startup log reports the selected workspace, project, and owner-auth paths', () => {
  assert.match(serverSource, /Workspace data directory: \$\{DATA_DIR\}/);
  assert.match(serverSource, /Project data file: \$\{DATA_FILE\}/);
  assert.match(serverSource, /Owner authentication file: \$\{AUTH_FILE\}/);
  assert.doesNotMatch(serverSource, /Project data remains in data\/projects\.json/);
});

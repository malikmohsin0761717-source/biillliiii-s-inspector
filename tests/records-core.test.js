'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collectRecords, countByType, filterRecords } = require('../ui/records-core');

const sourceRoot = path.resolve(__dirname, '..');

test('fresh workspace shows zero saved records and zero category counts', () => {
  const records = collectRecords([]);
  assert.deepEqual(records, []);
  assert.deepEqual(countByType(records), {
    sessions: 0, decisions: 0, tasks: 0, tasksDone: 0, tasksVerified: 0, memory: 0
  });
  assert.deepEqual(filterRecords(records, 'all'), []);
});

test('records are built only from saved project sessions, decisions, tasks and memory history', () => {
  const projects = [{
    id: 'BI-0007',
    name: 'Records test project',
    sessions: [
      { id: 'S1', activity: 'Short work session', createdAt: '2026-11-09T09:00:00.000Z', source: 'automatic-monitoring', status: 'completed', durationSeconds: 94 },
      { id: 'S2', activity: 'Interrupted work session', createdAt: '2026-11-09T08:00:00.000Z', source: 'automatic-monitoring', status: 'interrupted', durationMinutes: 2 }
    ],
    decisions: [
      { id: 'D1', text: 'Keep records local', createdAt: '2026-11-09T10:00:00.000Z' }
    ],
    checklist: [
      { id: 'T1', title: 'Owner-marked task', done: true, verified: false, updatedAt: '2026-11-09T11:00:00.000Z' },
      { id: 'T2', title: 'Pending task', done: false, verified: false, createdAt: '2026-11-09T07:00:00.000Z' },
      { id: 'T3', title: 'Explicitly verified task', done: true, verified: true, createdAt: '2026-11-09T06:00:00.000Z' }
    ],
    memoryHistory: [
      { id: 'M1', summary: 'Updated the next step', createdAt: '2026-11-09T12:00:00.000Z' }
    ]
  }];

  const records = collectRecords(projects);
  assert.equal(records.length, 7);
  assert.equal(records[0].type, 'memory');
  assert.equal(records[0].activity, 'Updated the next step');
  assert.equal(records.find(item => item.activity === 'Short work session').duration, '1 min 34 sec');
  assert.equal(records.find(item => item.activity === 'Interrupted work session').status, 'Interrupted');
  assert.equal(records.find(item => item.activity === 'Owner-marked task').status, 'Marked done');
  assert.equal(records.find(item => item.activity === 'Pending task').status, 'Pending');
  assert.equal(records.find(item => item.activity === 'Explicitly verified task').status, 'Verified');

  assert.deepEqual(countByType(records), {
    sessions: 2, decisions: 1, tasks: 3, tasksDone: 2, tasksVerified: 1, memory: 1
  });
  assert.equal(filterRecords(records, 'session').length, 2);
  assert.equal(filterRecords(records, 'decision').length, 1);
  assert.equal(filterRecords(records, 'task').length, 3);
  assert.equal(filterRecords(records, 'memory').length, 1);
});

test('Records UI loads the real-data helper and does not contain fixed illustrative rows', () => {
  const html = fs.readFileSync(path.join(sourceRoot, 'ui', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(sourceRoot, 'ui', 'app.js'), 'utf8');
  assert.match(html, /records-core\.js[\s\S]*app\.js/);
  assert.match(app, /BiRecordsCore\.collectRecords\(demoProjects\)/);
  assert.match(app, /data-record-filter/);
  assert.doesNotMatch(app, /Nov 06, 2026 · 10:20 AM|Illustrative entries only|Example records/);
  assert.doesNotMatch(app, /Verified sample tasks|Pending review/);
});

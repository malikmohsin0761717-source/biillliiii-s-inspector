'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWorkspaceStore, makeReminder, buildAlerts, buildReportSummary, csvCell } = require('../workspace-core');

test('legacy workspace stores gain safe empty reminders and settings defaults', () => {
  const store = normalizeWorkspaceStore({ schemaVersion: 1, projects: [] });
  assert.deepEqual(store.reminders, []);
  assert.deepEqual(store.importantItems, []);
  assert.equal(store.settings.browserNotificationsEnabled, false);
  assert.deepEqual(store.settings.approvedApps, []);
});

test('reminders validate fields and produce stable lifecycle timestamps', () => {
  const reminder = makeReminder({ title: 'Review project', dueAt: '2026-11-19T10:00:00Z', notes: 'Check next step' });
  assert.match(reminder.id, /^[a-f0-9-]{36}$/i);
  assert.equal(reminder.completedAt, null);
  assert.equal(reminder.dismissedAt, null);
  assert.equal(reminder.notifiedAt, null);
  assert.throws(() => makeReminder({ title: '', dueAt: 'not-a-date' }), /title/);
  assert.throws(() => makeReminder({ title: 'Valid', dueAt: 'not-a-date' }), /date\/time/);
});

test('alerts include only due or next-24-hour uncompleted, undismissed reminders', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const store = { schemaVersion: 1, projects: [], reminders: [
    { id: '1', title: 'Overdue', dueAt: '2026-11-18T11:00:00Z' },
    { id: '2', title: 'Soon', dueAt: '2026-11-19T11:00:00Z' },
    { id: '3', title: 'Later', dueAt: '2026-11-20T12:00:00Z' },
    { id: '4', title: 'Done', dueAt: '2026-11-18T11:00:00Z', completedAt: now },
    { id: '5', title: 'Dismissed', dueAt: '2026-11-18T11:00:00Z', dismissedAt: now }
  ] };
  assert.deepEqual(buildAlerts(store, now).map(item => item.sourceId), ['1', '2']);
});

test('report summary uses saved records and does not include private notes', () => {
  const report = buildReportSummary({ schemaVersion: 1, reminders: [], projects: [{
    id: 'BI-0001', name: 'Demo', status: 'Active', goal: 'secret goal', checklist: [{ done: true }, { done: false }],
    sessions: [{ durationMinutes: 30 }], decisions: [{ text: 'decision', reason: 'private' }]
  }] });
  assert.equal(report.totals.projects, 1);
  assert.equal(report.projects[0].progress, 50);
  assert.equal(report.projects[0].totalDurationMinutes, 30);
  assert.equal(JSON.stringify(report).includes('secret goal'), false);
  assert.equal(JSON.stringify(report).includes('private'), false);
});

test('CSV cells quote values and neutralize spreadsheet formulas', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('A "quote"'), '"A ""quote"""');
});

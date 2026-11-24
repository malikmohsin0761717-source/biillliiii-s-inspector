'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  activeDurationMs,
  summarizeApps,
  makeAutomaticSession,
  recoverInterruptedSession,
  parseSnapshot
} = require('../monitoring/monitoring-core');

test('active duration excludes a completed pause interval', () => {
  const active = {
    startedAt: '2026-11-06T10:00:00.000Z',
    state: 'running',
    pausedAt: null,
    pausedTotalMs: 20_000
  };
  assert.equal(activeDurationMs(active, Date.parse('2026-11-06T10:01:00.000Z')), 40_000);
});

test('active duration freezes at pausedAt while paused', () => {
  const active = {
    startedAt: '2026-11-06T10:00:00.000Z',
    state: 'paused',
    pausedAt: '2026-11-06T10:00:30.000Z',
    pausedTotalMs: 0
  };
  assert.equal(activeDurationMs(active, Date.parse('2026-11-06T10:10:00.000Z')), 30_000);
});

test('app usage is approximate and never exceeds active session time', () => {
  const samples = [
    { activeApp: 'chrome' }, { activeApp: 'chrome' }, { activeApp: 'notepad' }, { activeApp: 'notepad' }
  ];
  const result = summarizeApps(samples, 25_000);
  assert.equal(result.reduce((sum, item) => sum + item.seconds, 0), 25);
  assert.equal(result.find(item => item.name === 'chrome').seconds, 12);
  assert.equal(result.find(item => item.name === 'notepad').seconds, 13);
  assert.ok(result.every(item => item.approximate === true));
});

test('automatic session includes source, sample count, averages, and privacy notes', () => {
  const active = {
    sessionId: 'session-test-1', projectId: 'BI-0001', activity: 'First monitoring test',
    startedAt: '2026-11-06T10:00:00.000Z', state: 'running', pausedTotalMs: 0,
    samples: [
      { activeApp: 'chrome', cpuPercent: 10, ramUsedPercent: 70 },
      { activeApp: 'notepad', cpuPercent: 20, ramUsedPercent: 80 }
    ], warnings: []
  };
  const session = makeAutomaticSession(active, '2026-11-06T10:00:20.000Z');
  assert.equal(session.id, 'session-test-1');
  assert.equal(session.source, 'automatic-monitoring');
  assert.equal(session.status, 'completed');
  assert.equal(session.sampleCount, 2);
  assert.equal(session.avgCpuPercent, 15);
  assert.equal(session.avgRamUsedPercent, 75);
  assert.match(session.notes, /no window titles, URLs, page text/);
});

test('server restart recovery writes one interrupted session and clears active monitor', () => {
  const store = {
    projects: [{ id: 'BI-0001', sessions: [] }],
    activeMonitor: {
      sessionId: 'session-interrupted-1', projectId: 'BI-0001', activity: 'Interrupted work',
      state: 'running', startedAt: '2026-11-06T10:00:00.000Z', pausedAt: null,
      pausedTotalMs: 0, samples: [{ activeApp: 'chrome', cpuPercent: 5, ramUsedPercent: 60 }], warnings: []
    }
  };
  const session = recoverInterruptedSession(store, '2026-11-06T10:00:20.000Z');
  assert.equal(session.status, 'interrupted');
  assert.equal(store.activeMonitor, null);
  assert.equal(store.projects[0].sessions.length, 1);
  assert.equal(store.projects[0].sessions[0].id, 'session-interrupted-1');
  assert.equal(store.lastMonitorSummary.status, 'interrupted');
  assert.equal(recoverInterruptedSession(store, '2026-11-06T10:01:00.000Z'), null);
  assert.equal(store.projects[0].sessions.length, 1);
});

test('snapshot parser validates JSON and bounds system metrics', () => {
  const parsed = parseSnapshot(JSON.stringify({
    timestamp: '2026-11-06T10:00:00.000Z', activeApp: 'chrome', cpuPercent: 101,
    ramUsedPercent: 67.8, ramTotalMb: 8000, ramAvailableMb: 2500, systemDrive: 'C:', driveFreeGb: 120
  }));
  assert.equal(parsed.activeApp, 'chrome');
  assert.equal(parsed.cpuPercent, null);
  assert.equal(parsed.ramUsedPercent, 67.8);
  assert.equal(parsed.systemDrive, 'C:');
  assert.throws(() => parseSnapshot('not-json'), /invalid JSON/);
});

test('Windows snapshot script is metadata-only and contains sensitive process exclusions', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const script = fs.readFileSync(path.join(__dirname, '..', 'monitoring', 'windows-snapshot.ps1'), 'utf8');
  assert.match(script, /GetForegroundWindow/);
  assert.match(script, /OUTLOOK/);
  assert.match(script, /Bitwarden/);
  assert.match(script, /PayPal/);
  assert.doesNotMatch(script, /GetWindowText|Get-Clipboard|SendKeys|GetAsyncKeyState|Get-Content|Invoke-WebRequest/);
});

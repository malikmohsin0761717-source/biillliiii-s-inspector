'use strict';

const crypto = require('node:crypto');

const SAMPLE_INTERVAL_MS = 10_000;

function activeDurationMs(active, nowMs = Date.now()) {
  if (!active || !active.startedAt) return 0;
  const startedAt = Date.parse(active.startedAt);
  if (!Number.isFinite(startedAt)) return 0;
  const effectiveEnd = active.state === 'paused' && active.pausedAt
    ? Date.parse(active.pausedAt)
    : nowMs;
  const end = Number.isFinite(effectiveEnd) ? effectiveEnd : nowMs;
  const pausedTotal = Math.max(0, Number(active.pausedTotalMs) || 0);
  return Math.max(0, end - startedAt - pausedTotal);
}

function averageOf(samples, key) {
  const values = samples.map(sample => sample[key]).filter(value => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
}

function summarizeApps(samples, activeMs) {
  const counts = new Map();
  for (const sample of samples) {
    const name = typeof sample.activeApp === 'string' && sample.activeApp.trim()
      ? sample.activeApp.trim().slice(0, 80)
      : 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const estimatedTotalSeconds = Math.min(
    Math.round(activeMs / 1000),
    samples.length * Math.round(SAMPLE_INTERVAL_MS / 1000)
  );
  const totalSamples = samples.length || 1;
  let assigned = 0;
  const rows = [...counts.entries()].map(([name, count], index, all) => {
    let seconds = Math.floor(estimatedTotalSeconds * count / totalSamples);
    if (index === all.length - 1) seconds = Math.max(0, estimatedTotalSeconds - assigned);
    assigned += seconds;
    return { name, seconds, approximate: true };
  });
  return rows.sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
}

function makeAutomaticSession(active, endedAt = new Date().toISOString(), status = 'completed') {
  const endMs = Date.parse(endedAt);
  const activeMs = activeDurationMs(active, Number.isFinite(endMs) ? endMs : Date.now());
  const samples = Array.isArray(active.samples) ? active.samples : [];
  const warnings = Array.isArray(active.warnings) ? active.warnings.slice(-100) : [];
  const appUsage = summarizeApps(samples, activeMs);
  const avgCpuPercent = averageOf(samples, 'cpuPercent');
  const avgRamUsedPercent = averageOf(samples, 'ramUsedPercent');
  const startLabel = active.startedAt || endedAt;
  const warningText = warnings.length ? ` Snapshot warnings: ${warnings.length}.` : '';
  const appText = appUsage.length
    ? ` Approximate applications: ${appUsage.map(item => `${item.name} ${item.seconds}s`).join(', ')}.`
    : ' No successful application samples were collected.';
  const metricsText = ` Samples: ${samples.length}. Average CPU: ${avgCpuPercent === null ? 'unavailable' : `${avgCpuPercent}%`}. Average RAM used: ${avgRamUsedPercent === null ? 'unavailable' : `${avgRamUsedPercent}%`}.`;
  return {
    id: active.sessionId || crypto.randomUUID(),
    activity: active.activity,
    durationMinutes: Math.round(activeMs / 60_000),
    durationSeconds: Math.round(activeMs / 1000),
    notes: `Automatic local monitoring session.${metricsText}${appText}${warningText} Only foreground process names and basic system metrics were sampled; no window titles, URLs, page text, files, keystrokes, clipboard, camera, or microphone were captured.`,
    createdAt: endedAt,
    source: 'automatic-monitoring',
    status,
    startedAt: startLabel,
    endedAt,
    sampleCount: samples.length,
    avgCpuPercent,
    avgRamUsedPercent,
    appUsage,
    warnings
  };
}

function recoverInterruptedSession(store, endedAt = new Date().toISOString()) {
  const active = store && store.activeMonitor;
  if (!active) return null;
  const project = store.projects.find(item => item.id === active.projectId);
  const session = makeAutomaticSession(active, endedAt, 'interrupted');
  session.notes = `Session was interrupted because the local app/server stopped before the user pressed Stop. ${session.notes}`;
  if (project) {
    project.sessions ||= [];
    if (!project.sessions.some(item => item.id === session.id)) project.sessions.push(session);
  }
  store.lastMonitorSummary = {
    sessionId: session.id,
    projectId: active.projectId,
    activity: active.activity,
    status: 'interrupted',
    durationSeconds: session.durationSeconds,
    sampleCount: session.sampleCount,
    endedAt
  };
  store.activeMonitor = null;
  return session;
}

function parseSnapshot(stdout) {
  let value;
  try { value = JSON.parse(String(stdout).trim()); }
  catch { throw new Error('Windows snapshot returned invalid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Windows snapshot returned an invalid object.');
  }
  const rawName = typeof value.activeApp === 'string' ? value.activeApp.trim() : 'Unknown';
  const activeApp = /^[\w .()\-]{1,80}$/u.test(rawName) ? rawName : 'Unknown';
  const boundedNumber = (input, min, max) => input !== null && input !== undefined && input !== '' && Number.isFinite(Number(input)) && Number(input) >= min && Number(input) <= max
    ? Math.round(Number(input) * 10) / 10
    : null;
  return {
    capturedAt: typeof value.timestamp === 'string' && !Number.isNaN(Date.parse(value.timestamp))
      ? value.timestamp : new Date().toISOString(),
    activeApp,
    cpuPercent: boundedNumber(value.cpuPercent, 0, 100),
    ramUsedPercent: boundedNumber(value.ramUsedPercent, 0, 100),
    ramTotalMb: boundedNumber(value.ramTotalMb, 0, 2_000_000),
    ramAvailableMb: boundedNumber(value.ramAvailableMb, 0, 2_000_000),
    systemDrive: typeof value.systemDrive === 'string' && /^[A-Z]:$/i.test(value.systemDrive) ? value.systemDrive : null,
    driveFreeGb: boundedNumber(value.driveFreeGb, 0, 10_000_000)
  };
}

module.exports = {
  SAMPLE_INTERVAL_MS,
  activeDurationMs,
  summarizeApps,
  makeAutomaticSession,
  recoverInterruptedSession,
  parseSnapshot
};

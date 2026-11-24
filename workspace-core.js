'use strict';

const crypto = require('node:crypto');

function normalizeWorkspaceStore(store) {
  if (!store || typeof store !== 'object' || !Array.isArray(store.projects)) {
    throw new TypeError('Workspace store format is invalid.');
  }
  if (!Array.isArray(store.reminders)) store.reminders = [];
  if (!Array.isArray(store.importantItems)) store.importantItems = [];
  if (!store.settings || typeof store.settings !== 'object' || Array.isArray(store.settings)) store.settings = {};
  if (typeof store.settings.browserNotificationsEnabled !== 'boolean') store.settings.browserNotificationsEnabled = false;
  if (!Array.isArray(store.settings.approvedApps)) store.settings.approvedApps = [];
  return store;
}

function makeReminder({ title, dueAt, projectId = null, notes = '' }) {
  const cleanTitle = String(title || '').trim();
  const parsedDueAt = new Date(dueAt);
  if (!cleanTitle || cleanTitle.length > 200) throw Object.assign(new Error('Reminder title must contain 1 to 200 characters.'), { status: 400 });
  if (!Number.isFinite(parsedDueAt.getTime())) throw Object.assign(new Error('Reminder date/time is invalid.'), { status: 400 });
  const cleanDueAt = parsedDueAt.toISOString();
  if (String(notes || '').length > 1000) throw Object.assign(new Error('Reminder notes cannot exceed 1,000 characters.'), { status: 400 });
  return {
    id: crypto.randomUUID(), title: cleanTitle, dueAt: cleanDueAt,
    projectId: projectId ? String(projectId) : null,
    notes: String(notes || '').trim(), completedAt: null, dismissedAt: null,
    notifiedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
}

function buildAlerts(store, now = Date.now()) {
  normalizeWorkspaceStore(store);
  return store.reminders
    .filter(item => !item.completedAt && !item.dismissedAt && Number.isFinite(Date.parse(item.dueAt)) && Date.parse(item.dueAt) <= now + 24 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map(item => ({
      id: `reminder:${item.id}`, sourceId: item.id, type: 'reminder',
      title: item.title,
      message: Date.parse(item.dueAt) < now ? 'Reminder overdue hai.' : 'Reminder aglay 24 ghanton mein due hai.',
      severity: Date.parse(item.dueAt) < now ? 'warning' : 'info',
      dueAt: item.dueAt, projectId: item.projectId,
      notifiedAt: item.notifiedAt || null
    }));
}

function buildReportSummary(store, now = new Date().toISOString()) {
  normalizeWorkspaceStore(store);
  const projects = store.projects.map(project => {
    const tasks = Array.isArray(project.checklist) ? project.checklist : [];
    const sessions = Array.isArray(project.sessions) ? project.sessions : [];
    const decisions = Array.isArray(project.decisions) ? project.decisions : [];
    const completedTasks = tasks.filter(task => task && task.done === true).length;
    const totalDurationMinutes = sessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationMinutes) || 0), 0);
    return {
      id: String(project.id || ''), name: String(project.name || ''), status: String(project.status || 'Planning'),
      totalTasks: tasks.length, completedTasks, progress: tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0,
      sessionCount: sessions.length, totalDurationMinutes, decisionCount: decisions.length,
      reminderCount: store.reminders.filter(reminder => reminder.projectId === project.id && !reminder.completedAt).length
    };
  });
  return {
    generatedAt: now,
    totals: {
      projects: projects.length,
      tasks: projects.reduce((n, p) => n + p.totalTasks, 0),
      completedTasks: projects.reduce((n, p) => n + p.completedTasks, 0),
      sessions: projects.reduce((n, p) => n + p.sessionCount, 0),
      durationMinutes: projects.reduce((n, p) => n + p.totalDurationMinutes, 0),
      decisions: projects.reduce((n, p) => n + p.decisionCount, 0),
      openReminders: store.reminders.filter(item => !item.completedAt).length
    },
    projects
  };
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = { normalizeWorkspaceStore, makeReminder, buildAlerts, buildReportSummary, csvCell };

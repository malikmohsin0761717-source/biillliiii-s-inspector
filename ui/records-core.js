"use strict";

(function attachRecordsCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BiRecordsCore = api;
})(typeof window !== 'undefined' ? window : null, function createRecordsCore() {
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatDuration(item) {
    if (item && item.durationSeconds !== undefined && item.durationSeconds !== null && Number.isFinite(Number(item.durationSeconds))) {
      const seconds = Math.max(0, Math.floor(Number(item.durationSeconds)));
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return minutes ? `${minutes} min ${remainder} sec` : `${remainder} sec`;
    }
    if (item && item.durationMinutes !== undefined && item.durationMinutes !== null && Number.isFinite(Number(item.durationMinutes))) {
      return `${Math.max(0, Number(item.durationMinutes))} min`;
    }
    return '—';
  }

  function addRecord(records, project, type, fields) {
    const createdAt = fields.createdAt || null;
    const parsed = createdAt ? Date.parse(createdAt) : NaN;
    records.push({
      type,
      createdAt,
      sortTimestamp: Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY,
      projectId: String(project.id || 'Unknown project'),
      projectName: String(project.name || 'Unnamed project'),
      activity: String(fields.activity || 'Saved workspace update'),
      detail: String(fields.detail || ''),
      status: String(fields.status || 'Saved'),
      duration: fields.duration || '—'
    });
  }

  function collectRecords(projects) {
    const records = [];
    for (const project of asArray(projects)) {
      if (!project || typeof project !== 'object') continue;

      for (const session of asArray(project.sessions)) {
        if (!session || typeof session !== 'object') continue;
        const rawStatus = String(session.status || (session.source === 'automatic-monitoring' ? 'Completed' : 'Saved'));
        const status = rawStatus.toLowerCase() === 'interrupted'
          ? 'Interrupted'
          : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        addRecord(records, project, 'session', {
          createdAt: session.createdAt || session.startedAt || session.endedAt,
          activity: session.activity,
          detail: session.source === 'automatic-monitoring' ? 'Automatic monitoring session' : 'Manually saved session',
          status,
          duration: formatDuration(session)
        });
      }

      for (const decision of asArray(project.decisions)) {
        if (!decision || typeof decision !== 'object') continue;
        addRecord(records, project, 'decision', {
          createdAt: decision.createdAt,
          activity: decision.text,
          detail: 'Project decision',
          status: 'Saved'
        });
      }

      for (const task of asArray(project.checklist)) {
        if (!task || typeof task !== 'object') continue;
        const verified = task.verified === true;
        const done = task.done === true;
        addRecord(records, project, 'task', {
          createdAt: task.updatedAt || task.createdAt,
          activity: task.title,
          detail: verified ? 'Checklist task · explicitly verified' : done ? 'Checklist task · marked complete by owner' : 'Checklist task · pending',
          status: verified ? 'Verified' : done ? 'Marked done' : 'Pending'
        });
      }

      for (const memory of asArray(project.memoryHistory)) {
        if (!memory || typeof memory !== 'object') continue;
        addRecord(records, project, 'memory', {
          createdAt: memory.createdAt,
          activity: memory.summary,
          detail: 'Project memory update',
          status: 'Saved'
        });
      }
    }

    return records.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  }

  function countByType(records) {
    const items = asArray(records);
    const counts = { sessions: 0, decisions: 0, tasks: 0, tasksDone: 0, tasksVerified: 0, memory: 0 };
    for (const record of items) {
      if (record.type === 'session') counts.sessions += 1;
      else if (record.type === 'decision') counts.decisions += 1;
      else if (record.type === 'task') {
        counts.tasks += 1;
        if (record.status === 'Marked done' || record.status === 'Verified') counts.tasksDone += 1;
        if (record.status === 'Verified') counts.tasksVerified += 1;
      } else if (record.type === 'memory') counts.memory += 1;
    }
    return counts;
  }

  function filterRecords(records, filter = 'all') {
    const items = asArray(records);
    return filter === 'all' ? items.slice() : items.filter(record => record.type === filter);
  }

  return { collectRecords, countByType, filterRecords };
});

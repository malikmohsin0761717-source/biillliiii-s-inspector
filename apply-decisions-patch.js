'use strict';

// Safe, targeted patcher for the Biillliiii Inspector v0.5.x development folder.
// It changes only server.js, ui/app.js and ui/styles.css. It never opens data files.
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const serverPath = path.join(root, 'server.js');
const appPath = path.join(root, 'ui', 'app.js');
const stylesPath = path.join(root, 'ui', 'styles.css');
const required = [serverPath, appPath, stylesPath];
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`STOP: Required file not found: ${path.relative(root, file)}`);
    process.exit(1);
  }
}

let server = fs.readFileSync(serverPath, 'utf8');
let app = fs.readFileSync(appPath, 'utf8');
let styles = fs.readFileSync(stylesPath, 'utf8');
const original = { server, app, styles };

function replaceOnce(source, pattern, replacement, label) {
  const firstMatch = source.match(pattern);
  const remaining = firstMatch ? source.replace(pattern, '').match(pattern) : null;
  if (!firstMatch || remaining) {
    throw new Error(`${label}: expected exactly one matching code section; found ${firstMatch ? (remaining ? 'more than one' : 'one') : 'zero'}. No files have been changed.`);
  }
  return source.replace(pattern, replacement);
}

// server.js: include a project-scoped decision ID route.
if (!server.includes('const decisionMatch = url.pathname.match(')) {
  server = replaceOnce(
    server,
    /(  const decisionsMatch = url\.pathname\.match\([^\n]+\);\n)/,
    `$1  const decisionMatch = url.pathname.match(/^\\/api\\/projects\\/([A-Z]{2}-\\d{4})\\/decisions\\/([a-f0-9-]{36})$/i);\n`,
    'Decision route matcher'
  );
}
if (!server.includes('decisionsMatch || decisionMatch')) {
  server = replaceOnce(
    server,
    /const anyMatch = projectMatch \|\| memoryMatch \|\| checklistMatch \|\| taskMatch \|\| decisionsMatch \|\| sessionsMatch;/,
    'const anyMatch = projectMatch || memoryMatch || checklistMatch || taskMatch || decisionsMatch || decisionMatch || sessionsMatch;',
    'Project route allow-list'
  );
}

if (!server.includes("req.method === 'PATCH' && decisionMatch")) {
  const decisionPost = /  if \(req\.method === 'POST' && decisionsMatch\) \{[\s\S]*?\n  \}\n\n  if \(req\.method === 'POST' && sessionsMatch\)/;
  const replacement = `  if (req.method === 'POST' && decisionsMatch) {
    const body = await readBody(req);
    const text = cleanText(body.text, 1000, 'Decision');
    const reason = cleanText(body.reason ?? '', 2000, 'Decision reason');
    if (!text) return json(res, 400, { error: 'Decision cannot be empty.' });
    project.decisions ||= [];
    if (project.decisions.length >= 100) return json(res, 400, { error: 'This project has reached the 100-decision limit.' });
    const decision = { id: crypto.randomUUID(), text, reason, createdAt: new Date().toISOString(), updatedAt: null };
    project.decisions.push(decision);
    writeStore(store);
    return json(res, 201, { project: publicProject(project), decision });
  }

  if (req.method === 'PATCH' && decisionMatch) {
    const body = await readBody(req);
    const decision = (project.decisions || []).find(item => item.id === decisionMatch[2]);
    if (!decision) return json(res, 404, { error: 'Decision not found.' });
    const text = cleanText(body.text, 1000, 'Decision');
    const reason = cleanText(body.reason ?? '', 2000, 'Decision reason');
    if (!text) return json(res, 400, { error: 'Decision cannot be empty.' });
    decision.text = text;
    decision.reason = reason;
    decision.updatedAt = new Date().toISOString();
    writeStore(store);
    return json(res, 200, { project: publicProject(project), decision });
  }

  if (req.method === 'DELETE' && decisionMatch) {
    const index = (project.decisions || []).findIndex(item => item.id === decisionMatch[2]);
    if (index < 0) return json(res, 404, { error: 'Decision not found.' });
    const [decision] = project.decisions.splice(index, 1);
    writeStore(store);
    return json(res, 200, { project: publicProject(project), decision, deleted: true });
  }

  if (req.method === 'POST' && sessionsMatch)`;
  server = replaceOnce(server, decisionPost, replacement, 'Decision API block');
}

// Include decision reasons in the existing Markdown export without changing old records.
if (!server.includes('Reason: ${item.reason}')) {
  server = replaceOnce(
    server,
    /\.\.\.\(project\.decisions \|\| \[\]\)\.map\(item => `- \$\{item\.text\} \(\$\{item\.createdAt\}\)`\), ''\,/,
    "...(project.decisions || []).map(item => `- ${item.text} (${item.createdAt})${item.reason ? `\\n  - Reason: ${item.reason}` : ''}`), '',",
    'Decision Markdown export'
  );
}

// ui/app.js: replace only the Decisions tab renderer.
if (!app.includes('data-decision-delete=')) {
  const start = app.indexOf("  if (tab === 'decisions') {");
  const end = app.indexOf("\n  return `<div class=\"project-detail-grid\">", start);
  if (start < 0 || end < 0) throw new Error('Decisions UI renderer anchor not found. No files have been changed.');
  const replacement = `  if (tab === 'decisions') {
    const decisions = (project.decisions || []).slice().reverse();
    return \`<section class="panel project-detail-panel"><div class="panel-head"><div><h3>Project decisions</h3><p>Har faislay ke saath wajah save karo; baad mein edit ya delete bhi kar sakte ho.</p></div><span class="status active">\${decisions.length} saved</span></div>
      <form id="addDecisionForm" class="local-data-form compact-form"><label>Decision<input name="text" maxlength="1000" placeholder="Kya faisla kiya?" required></label><label>Reason / wajah<textarea name="reason" maxlength="2000" rows="2" placeholder="Yeh faisla kyun kiya? (optional)"></textarea></label><button class="btn btn-primary" type="submit">＋ Save decision</button></form>
      <div class="decision-list">\${decisions.map(item => \`<article class="detail-list-item decision-item"><span class="detail-check">✦</span><div class="decision-content"><b>\${escapeHtml(item.text)}</b>\${item.reason ? \`<p>\${escapeHtml(item.reason)}</p>\` : '<p class="empty-note">Reason add nahi ki gayi.</p>'}<small class="history-time">Created: \${escapeHtml(formatDate(item.createdAt))}\${item.updatedAt ? \` · Updated: \${escapeHtml(formatDate(item.updatedAt))}\` : ''}</small><details class="decision-edit-details"><summary>Edit decision</summary><form id="editDecisionForm" class="local-data-form compact-form"><input type="hidden" name="decisionId" value="\${escapeHtml(item.id)}"><label>Decision<input name="text" maxlength="1000" value="\${escapeHtml(item.text)}" required></label><label>Reason / wajah<textarea name="reason" maxlength="2000" rows="2">\${escapeHtml(item.reason || '')}</textarea></label><button class="btn btn-outline" type="submit">Save changes</button></form></details><button class="btn btn-danger decision-delete" type="button" data-decision-delete="\${escapeHtml(item.id)}">Delete decision</button></div></article>\`).join('') || '<p class="empty-note">Abhi koi decision save nahi hua.</p>'}</div>
    </section>\`;
  }`;
  app = app.slice(0, start) + replacement + app.slice(end);
}

// The delegated click listener must be async for the delete request.
if (!app.includes("const deleteDecisionButton = event.target.closest('[data-decision-delete]')")) {
  app = app.replace("document.addEventListener('click', (event) => {\n  if (authenticated) pingActivity();", "document.addEventListener('click', async (event) => {\n  if (authenticated) pingActivity();");
  if (!app.includes("document.addEventListener('click', async (event) => {\n  if (authenticated) pingActivity();")) {
    throw new Error('Delegated UI click handler anchor not found or has an unsupported structure. No files have been changed.');
  }
  const deleteHandler = `  const deleteDecisionButton = event.target.closest('[data-decision-delete]');
  if (deleteDecisionButton) {
    if (!authenticated) return lockWorkspaceLocally('Login required.');
    if (!selectedProjectId) return notify('Pehle project kholo.');
    const decisionId = deleteDecisionButton.dataset.decisionDelete;
    if (!window.confirm('Kya is decision ko is project se delete karna hai?')) return;
    deleteDecisionButton.disabled = true;
    try {
      const result = await api(\`/api/projects/\${selectedProjectId}/decisions/\${encodeURIComponent(decisionId)}\`, { method: 'DELETE' });
      updateProjectCache(result.project);
      notify('Decision delete ho gaya.');
      renderProjectDetail(selectedProjectId, 'decisions');
    } catch (error) {
      deleteDecisionButton.disabled = false;
      notify(\`Decision delete nahi hua: \${error.message}\`);
    }
    return;
  }
`;
  app = replaceOnce(app, /  const viewButton = event\.target\.closest\('\[data-view\]'\);/, `${deleteHandler}  const viewButton = event.target.closest('[data-view]');`, 'Decision delete UI handler');
}

// Allow the edit form in the existing delegated submit handler.
if (!app.includes("'editDecisionForm'")) {
  app = replaceOnce(
    app,
    /\['memoryForm', 'addTaskForm', 'addDecisionForm', 'addSessionForm'\]/,
    "['memoryForm', 'addTaskForm', 'addDecisionForm', 'editDecisionForm', 'addSessionForm']",
    'Decision form allow-list'
  );
}
if (!app.includes("if (form.id === 'editDecisionForm')")) {
  const addDecisionHandler = /    if \(form\.id === 'addDecisionForm'\) \{[\s\S]*?\n    \}\n    if \(form\.id === 'addSessionForm'\)/;
  const replacement = `    if (form.id === 'addDecisionForm') {
      result = await api(\`/api/projects/\${selectedProjectId}/decisions\`, { method: 'POST', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Decision save ho gaya.');
      return renderProjectDetail(selectedProjectId, 'decisions');
    }
    if (form.id === 'editDecisionForm') {
      const decisionId = values.decisionId;
      delete values.decisionId;
      result = await api(\`/api/projects/\${selectedProjectId}/decisions/\${encodeURIComponent(decisionId)}\`, { method: 'PATCH', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Decision update ho gaya.');
      return renderProjectDetail(selectedProjectId, 'decisions');
    }
    if (form.id === 'addSessionForm')`;
  app = replaceOnce(app, addDecisionHandler, replacement, 'Decision edit submit handler');
}

const cssMarker = '/* Project decisions: reason, edit and confirmed delete controls. */';
if (!styles.includes(cssMarker)) {
  styles += `\n\n${cssMarker}
.decision-item { align-items: flex-start; }
.decision-content { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 8px; }
.decision-content > p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.decision-edit-details { margin-top: 2px; }
.decision-edit-details summary { cursor: pointer; color: var(--accent, #5264d8); font-weight: 600; }
.decision-edit-details form { margin-top: 10px; }
.decision-delete { align-self: flex-start; }
`;
}

// Syntax-check the prepared source in memory before touching files.
try {
  new Function(server);
  new Function(app);
} catch (error) {
  console.error(`STOP: Prepared source did not pass syntax validation: ${error.message}`);
  process.exit(1);
}

// Idempotency: if all decision capabilities are already present, leave files alone.
if (server === original.server && app === original.app && styles === original.styles) {
  console.log('Decisions feature already appears to be implemented. No files changed.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(root, `decisions-patch-backup-${stamp}`);
fs.mkdirSync(backupDir, { recursive: false });
fs.copyFileSync(serverPath, path.join(backupDir, 'server.js'));
fs.copyFileSync(appPath, path.join(backupDir, 'app.js'));
fs.copyFileSync(stylesPath, path.join(backupDir, 'styles.css'));
fs.writeFileSync(serverPath, server, 'utf8');
fs.writeFileSync(appPath, app, 'utf8');
fs.writeFileSync(stylesPath, styles, 'utf8');
console.log('Decisions implementation applied.');
console.log(`Backup created at: ${path.basename(backupDir)}`);
console.log('Only server.js, ui/app.js and ui/styles.css were changed. No data, auth, archive or project files were accessed.');

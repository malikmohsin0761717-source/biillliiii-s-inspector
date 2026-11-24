'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const landing = $('#landing');
const authView = $('#authView');
const dashboard = $('#dashboard');
const viewContent = $('#viewContent');
const breadcrumbCurrent = $('#breadcrumbCurrent');
const toast = $('#toast');
let toastTimer;
let currentAuthMode = 'signin';
let authConfigured = false;
let authenticated = false;
let cloudAuthenticated = false;
let cloudAccountEmail = '';
let cloudConfigured = false;
let authBusy = false;
let idleLockTimer = null;
let lastActivityPing = 0;
let currentOwnerName = 'Owner';
const IDLE_LOCK_MS = 10 * 60 * 1000;
let currentView = 'home';
let selectedProjectId = null;
let selectedProjectTab = 'overview';
let monitorPollTimer = null;
let monitorPollBusy = false;
let globalMonitorPollTimer = null;
let globalMonitorPollBusy = false;
let alertPollTimer = null;
let alertPollBusy = false;

let demoProjects = [];

let currentRecordsFilter = 'all';
let projectFormOpen = false;

const iconMap = {
  home: '⌂', projects: '▦', monitoring: '◉', inspector: '⌕', records: '▤', chats: '▱', 'ai-chatbot': '✦', 'ai-teacher': '🎓', important: '☆', stopped: 'Ⅱ', reminders: '◷', alerts: '♧', reports: '⇩', settings: '⚙'
};
const titles = {
  home: 'Home', projects: 'Projects', monitoring: 'Live monitoring', inspector: 'AI Project Inspector', records: 'Records', chats: 'Chats', 'ai-chatbot': 'AI Chatbot', 'ai-teacher': 'AI Teacher', important: 'Important', stopped: 'Stopped', reminders: 'Reminders', alerts: 'Alerts', reports: 'Reports', settings: 'Settings'
};

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-Requested-With'] = 'BiillliiiiInspector';
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  const publicAuthPaths = ['/api/auth/status', '/api/auth/login', '/api/auth/setup', '/api/auth/recover', '/api/auth/logout'];
  if (response.status === 401 && !publicAuthPaths.includes(path) && !path.startsWith('/api/cloud-auth/')) {
    lockWorkspaceLocally('Your local Owner session expired. Please log in again.');
  }
  if (!response.ok) {
    const error = new Error(payload && payload.error ? payload.error : `Local request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function updateProjectCount() {
  const count = $('#mainNav .nav-item[data-view="projects"] .nav-count');
  if (count) count.textContent = String(demoProjects.length);
}

async function loadProjects() {
  const result = await api('/api/projects');
  demoProjects = result.projects;
  updateProjectCount();
}

function updateProjectCache(project) {
  const index = demoProjects.findIndex(item => item.id === project.id);
  if (index >= 0) demoProjects[index] = project;
  else demoProjects.push(project);
  updateProjectCount();
}

function formatDate(value) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}


function updateWelcomeActions() {
  const primary = $('#welcomePrimaryAction');
  const headerAction = $('#welcomeHeaderAction');
  if (primary) primary.textContent = authConfigured ? 'Log in to your workspace' : 'Create owner account';
  if (headerAction) headerAction.textContent = authConfigured ? 'Open workspace' : 'Get started';
  const status = $('#welcomeStatus');
  if (status && !status.dataset.customMessage) {
    status.textContent = authConfigured
      ? 'Your private workspace is ready. Log in to continue.'
      : 'First time here? Create your local owner account to get started.';
  }
}

function showLanding(message = '') {
  authView.classList.add('hidden');
  dashboard.classList.add('hidden');
  landing.classList.remove('hidden');
  updateWelcomeActions();
  const status = $('#welcomeStatus');
  if (status && message) {
    status.textContent = message;
    status.dataset.customMessage = 'true';
  } else if (status) {
    delete status.dataset.customMessage;
    updateWelcomeActions();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setAuthError(message = '') {
  const error = $('#authError');
  if (error) error.textContent = message;
}

function showAuth(mode, message = '') {
  currentAuthMode = mode;
  landing.classList.add('hidden');
  dashboard.classList.add('hidden');
  authView.classList.remove('hidden');
  const heading = $('#authHeading');
  const description = $('#authDescription');
  const fields = $('#authFields');
  const submit = $('#authSubmit');
  const note = $('#authSecurityNote');
  const secondary = $('#authSecondaryActions');
  const backLink = $('#backToWelcome');
  if (backLink) backLink.classList.toggle('hidden', mode === 'loading' || mode === 'recovery-confirm');
  setAuthError(message);
  if (!fields || !submit || !secondary) return;

  if (mode === 'loading') {
    heading.textContent = 'Checking owner account…';
    description.textContent = 'Your dashboard stays locked until authentication is verified.';
    note.textContent = 'Checking the local owner account. Project data is not loaded at this stage.';
    fields.innerHTML = '';
    submit.textContent = 'Please wait…';
    submit.disabled = true;
    secondary.innerHTML = '';
    return;
  }

  submit.disabled = false;
  if (mode === 'cloud-signin') {
    heading.textContent = 'Cloud account login';
    description.textContent = 'Supabase email account se private workspace open karein.';
    note.textContent = 'Cloud login Supabase Auth use karta hai. Local owner login fallback ke taur par available rahega.';
    fields.innerHTML = `
      <label class="input-label">Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
      <label class="input-label">Password<input name="password" type="password" minlength="12" autocomplete="current-password" required placeholder="Your cloud password"></label>`;
    submit.textContent = 'Log in with email';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="cloud-signup">Create cloud account</button><button class="auth-link" type="button" data-auth-action="cloud-recover">Forgot cloud password?</button><button class="auth-link" type="button" data-auth-action="google-login">Continue with Google</button><button class="auth-link" type="button" data-auth-action="signin">Use local owner login</button>';
  } else if (mode === 'cloud-signup') {
    heading.textContent = 'Create cloud account';
    description.textContent = 'Email aur strong password se Supabase account banayein.';
    note.textContent = 'Email confirmation enabled ho to inbox mein verification link aayega.';
    fields.innerHTML = `<label class="input-label">Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label class="input-label">Password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="At least 12 characters"></label>`;
    submit.textContent = 'Create cloud account';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="cloud-signin">Back to cloud login</button><button class="auth-link" type="button" data-auth-action="signin">Use local owner login</button>';
  } else if (mode === 'cloud-recovery') {
    heading.textContent = 'Choose a new cloud password';
    description.textContent = 'Email reset link verify ho gaya. Ab naya password set karein.';
    note.textContent = 'Kam az kam 12 characters ka unique password use karein.';
    fields.innerHTML = '<label class="input-label">New password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label class="input-label">Confirm new password<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label>';
    submit.textContent = 'Update cloud password';
    secondary.innerHTML = '';
  } else if (mode === 'cloud-recover') {
    heading.textContent = 'Reset cloud password';
    description.textContent = 'Reset link aapke email par bheja jayega.';
    note.textContent = 'Agar email account registered hai to Supabase reset link bhejega.';
    fields.innerHTML = '<label class="input-label">Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>';
    submit.textContent = 'Send reset email';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="cloud-signin">Back to cloud login</button>';
  } else if (mode === 'setup') {
    heading.textContent = 'Create owner account';
    description.textContent = 'First-time setup. This local account controls your private workspace.';
    note.textContent = 'Use a unique passphrase of at least 12 characters. A one-time recovery code will be shown after setup.';
    fields.innerHTML = `
      <label class="input-label">Owner username<input name="username" type="text" minlength="3" maxlength="32" autocomplete="username" required placeholder="e.g. MyOwner"></label>
      <label class="input-label">Password<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="At least 12 characters"></label>
      <label class="input-label">Confirm password<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="Enter the same password"></label>`;
    submit.textContent = 'Create Owner Account';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="cloud-signin">Use Supabase cloud account</button>';
  } else if (mode === 'signin') {
    heading.textContent = 'Welcome back';
    description.textContent = 'Log in to unlock your local owner workspace.';
    note.textContent = 'Dashboard, project records, exports and monitoring controls remain locked until login succeeds.';
    fields.innerHTML = `
      <label class="input-label">Owner username<input name="username" type="text" autocomplete="username" required placeholder="Your owner username"></label>
      <label class="input-label">Password<input name="password" type="password" autocomplete="current-password" required placeholder="Your owner password"></label>`;
    submit.textContent = 'Log in securely';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="recover">Forgot password? Use recovery code</button><button class="auth-link" type="button" data-auth-action="cloud-signin">Use Supabase cloud account</button>';
  } else if (mode === 'recover') {
    heading.textContent = 'Recover owner account';
    description.textContent = 'Use the recovery code saved during owner setup.';
    note.textContent = 'For safety, a successful recovery creates a new recovery code. Save the new code before logging in.';
    fields.innerHTML = `
      <label class="input-label">Owner username<input name="username" type="text" autocomplete="username" required placeholder="Your owner username"></label>
      <label class="input-label">Recovery code<input name="recoveryCode" type="text" autocomplete="off" required placeholder="40-character recovery code"></label>
      <label class="input-label">New password<input name="newPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="At least 12 characters"></label>
      <label class="input-label">Confirm new password<input name="confirmPassword" type="password" minlength="12" maxlength="128" autocomplete="new-password" required placeholder="Enter the same password"></label>`;
    submit.textContent = 'Verify code and reset password';
    secondary.innerHTML = '<button class="auth-link" type="button" data-auth-action="signin">Back to login</button>';
  } else if (mode === 'recovery-confirm') {
    heading.textContent = 'Save your recovery code';
    description.textContent = 'This code is shown once. It cannot be retrieved from the app later.';
    note.textContent = 'Write it down or store it in a trusted password manager. Keep it private and separate from your computer.';
    const code = window.currentRecoveryCode || '';
    fields.innerHTML = `<div class="recovery-code-panel"><code id="recoveryCodeText">${escapeHtml(code)}</code><button type="button" class="auth-link" id="copyRecoveryCode">Copy recovery code</button><label class="recovery-confirm"><input id="recoverySavedCheck" type="checkbox"> I have saved this recovery code in a safe place.</label></div>`;
    submit.textContent = 'Continue to login';
    submit.disabled = true;
    secondary.innerHTML = '';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showRecoveryCode(code) {
  window.currentRecoveryCode = code;
  showAuth('recovery-confirm');
  const checkbox = $('#recoverySavedCheck');
  const submit = $('#authSubmit');
  if (checkbox && submit) checkbox.addEventListener('change', () => { submit.disabled = !checkbox.checked; });
  const copy = $('#copyRecoveryCode');
  if (copy) copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      notify('Recovery code copied. Keep it private.');
    } catch {
      const node = $('#recoveryCodeText');
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      notify('Code select ho gaya. Ctrl+C se copy kar lo.');
    }
  });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (authBusy || currentAuthMode === 'loading') return;
  const form = $('#authForm');
  const values = Object.fromEntries(new FormData(form).entries());
  authBusy = true;
  const submit = $('#authSubmit');
  const oldText = submit.textContent;
  submit.disabled = true;
  setAuthError('');
  try {
    if (currentAuthMode === 'cloud-signin') {
      const result = await api('/api/cloud-auth/login', { method: 'POST', body: JSON.stringify(values) });
      cloudAuthenticated = true; cloudAccountEmail = result.user.email || '';
      if (!authenticated) {
        showAuth(authConfigured ? 'signin' : 'setup', `Cloud account ${result.user.email || ''} connect ho gaya. Local projects kholne ke liye Local Owner account setup/login karein.`);
        return;
      }
      showDashboard('settings'); notify(`Cloud account ${result.user.email || ''} connect ho gaya. Local data Local Owner session se protected hai.`); return;
    }
    if (currentAuthMode === 'cloud-signup') {
      const result = await api('/api/cloud-auth/signup', { method: 'POST', body: JSON.stringify(values) });
      if (result.authenticated) {
        cloudAuthenticated = true; cloudAccountEmail = values.email || '';
        if (authenticated) { showDashboard('settings'); notify('Cloud account create aur connect ho gaya.'); }
        else showAuth(authConfigured ? 'signin' : 'setup', 'Cloud account create ho gaya. Local workspace ke liye Local Owner account setup/login karein.');
      } else { showAuth('cloud-signin', 'Account ban gaya. Email confirmation ke baad login karein.'); }
      return;
    }
    if (currentAuthMode === 'cloud-recover') {
      await api('/api/cloud-auth/recover', { method: 'POST', body: JSON.stringify(values) });
      showAuth('cloud-signin', 'Agar account registered hai to reset email bhej di gayi hai.'); return;
    }
    if (currentAuthMode === 'cloud-recovery') {
      if (values.password !== values.confirmPassword) throw new Error('Dono passwords match nahi karte.');
      await api('/api/cloud-auth/update-password', { method: 'POST', body: JSON.stringify({ password: values.password }) });
      await api('/api/cloud-auth/logout', { method: 'POST', body: '{}' });
      cloudAuthenticated = false; cloudAccountEmail = ''; showAuth('cloud-signin', 'Password update ho gaya. Ab naye password se login karein.'); return;
    }
    if (currentAuthMode === 'setup') {
      const result = await api('/api/auth/setup', { method: 'POST', body: JSON.stringify(values) });
      authConfigured = true;
      showRecoveryCode(result.recoveryCode);
      return;
    }
    if (currentAuthMode === 'signin') {
      cloudAuthenticated = false; cloudAccountEmail = '';
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
      currentOwnerName = result.username;
      const authStatus = await api('/api/auth/status');
      cloudAuthenticated = authStatus.cloudAuthenticated === true; cloudAccountEmail = authStatus.cloudUser?.email || '';
      await loadProjects();
      authenticated = true;
      const profile = $('#profileUsername');
      if (profile) profile.textContent = currentOwnerName;
      const avatar = $('#topAvatar');
      if (avatar) avatar.textContent = currentOwnerName.slice(0, 1).toUpperCase();
      showDashboard('home');
      startGlobalMonitorIndicator();
      startIdleLock();
      notify('Login successful. Owner workspace unlocked.');
      return;
    }
    if (currentAuthMode === 'recover') {
      const result = await api('/api/auth/recover', { method: 'POST', body: JSON.stringify(values) });
      authenticated = false;
      showRecoveryCode(result.recoveryCode);
      return;
    }
    if (currentAuthMode === 'recovery-confirm') {
      if (!$('#recoverySavedCheck')?.checked) throw new Error('Pehle confirm karein ke recovery code save kar liya hai.');
      window.currentRecoveryCode = '';
      showAuth('signin');
      notify('Recovery code save confirmation received. Ab apne password se login karein.');
      return;
    }
  } catch (error) {
    setAuthError(error.message);
  } finally {
    authBusy = false;
    if (submit && submit.isConnected && currentAuthMode !== 'recovery-confirm') {
      submit.disabled = false;
      if (currentAuthMode !== 'setup' && currentAuthMode !== 'signin' && currentAuthMode !== 'recover') submit.textContent = oldText;
    }
  }
}

function stopClientPolling() {
  if (monitorPollTimer) clearInterval(monitorPollTimer);
  if (globalMonitorPollTimer) clearInterval(globalMonitorPollTimer);
  if (alertPollTimer) clearInterval(alertPollTimer);
  alertPollTimer = null;
  monitorPollTimer = null;
  globalMonitorPollTimer = null;
  monitorPollBusy = false;
  globalMonitorPollBusy = false;
}

function lockWorkspaceLocally(message = 'Workspace locked. Please log in again.') {
  authenticated = false; cloudAuthenticated = false; cloudAccountEmail = '';
  if (idleLockTimer) clearTimeout(idleLockTimer);
  idleLockTimer = null;
  stopClientPolling();
  demoProjects = [];
  selectedProjectId = null;
  landing.classList.add('hidden');
  dashboard.classList.add('hidden');
  showAuth(authConfigured ? 'signin' : 'setup', message);
}

async function lockWorkspace(message = 'Workspace locked.') {
  let monitoringPaused = false;
  try {
    const result = await api('/api/auth/logout', { method: 'POST', body: '{}' });
    monitoringPaused = result.monitoringPaused === true;
  } catch { /* server may already have expired the session; local lock still applies */ }
  lockWorkspaceLocally(monitoringPaused ? `${message} Active monitoring was paused for safety.` : message);
}

function pingActivity() {
  if (!authenticated) return;
  if (idleLockTimer) clearTimeout(idleLockTimer);
  idleLockTimer = setTimeout(() => { void lockWorkspace('Workspace auto-locked after 10 minutes of inactivity.'); }, IDLE_LOCK_MS);
  const now = Date.now();
  if (now - lastActivityPing > 5_000) {
    lastActivityPing = now;
    void api('/api/auth/activity', { method: 'POST', body: '{}' }).catch(() => {});
  }
}

function startIdleLock() {
  if (idleLockTimer) clearTimeout(idleLockTimer);
  lastActivityPing = Date.now();
  pingActivity();
}

function showDashboard(view = 'home') {
  if (!authenticated) return showAuth(authConfigured ? 'signin' : 'setup', 'Login ke baghair dashboard access nahi ho sakta.');
  landing.classList.add('hidden');
  authView.classList.add('hidden');
  dashboard.classList.remove('hidden');
  renderView(view);
  void startAlertPolling();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function projectStatusClass(status) {
  if (status === 'Planning') return 'project-tag planning';
  if (status === 'On hold') return 'project-tag on-hold';
  if (status === 'Completed') return 'project-tag completed';
  return 'project-tag';
}

function projectMarkup(project) {
  const tagClass = projectStatusClass(project.status);
  const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
  return `<article class="project-card project-card-interactive" data-project-id="${escapeHtml(project.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(project.name)} project">
    <div class="project-color">${escapeHtml(project.symbol || '◈')}</div>
    <div class="eyebrow">${escapeHtml(project.id)} · ${escapeHtml(String(project.type || 'Other').toUpperCase())}</div>
    <h3>${escapeHtml(project.name)}</h3>
    <p>Next step: ${escapeHtml(project.nextStep || 'Not set')}</p>
    <div class="card-meta"><span class="${tagClass}">${escapeHtml(project.status || 'Planning')}</span><b>${progress}% <span class="sample-label">saved</span></b></div>
    <div class="progress-track"><i class="progress-p${progress}"></i></div>
    <div class="project-open-hint">Open project <span aria-hidden="true">↗</span></div>
  </article>`;
}

function projectCreateFormMarkup() {
  return `<section class="panel project-create-panel" aria-labelledby="projectCreateHeading">
    <div class="panel-head"><div><h3 id="projectCreateHeading">Create a new project</h3><p>Yeh project tumhare local workspace mein save hoga. Project ID automatically banegi.</p></div></div>
    <form id="createProjectForm" class="local-data-form project-create-form">
      <label>Project name<input id="projectName" name="name" type="text" maxlength="120" required placeholder="Misal: Website Learning"></label>
      <label>Project type<select name="type" required><option value="">Select project type</option><option>Learning</option><option>Business</option><option>Personal</option><option>Work</option><option>Other</option></select></label>
      <label class="project-create-wide">Project goal<textarea name="goal" maxlength="1200" rows="3" required placeholder="Is project se tum kya achieve karna chahte ho?"></textarea><small>Required · maximum 1,200 characters.</small></label>
      <label class="project-create-wide">Next step <span class="optional-label">Optional</span><textarea name="nextStep" maxlength="600" rows="2" placeholder="Agla practical kaam kya hoga?"></textarea><small>Maximum 600 characters.</small></label>
      <label>Project status<select name="status"><option selected>Planning</option><option>Active</option><option>On hold</option><option>Completed</option></select></label>
      <div class="form-actions project-create-actions"><button class="btn btn-primary" type="submit">Save project</button><button class="btn btn-outline" type="button" data-project-action="cancel">Cancel</button></div>
    </form>
  </section>`;
}

function projectTabContent(project, tab) {
  const id = escapeHtml(project.id);
  if (tab === 'memory') {
    const history = (project.memoryHistory || []).slice().reverse();
    return `<section class="panel project-detail-panel">
      <div class="panel-head"><div><h3>Project Memory</h3><p>Yahan save ki hui baat is project ke local record mein rahegi.</p></div><span class="status active">Saved locally</span></div>
      <form id="memoryForm" class="local-data-form">
        <label>Project goal<textarea name="goal" maxlength="1200" required>${escapeHtml(project.goal)}</textarea><small>Maximum 1,200 characters.</small></label>
        <label>Last completed task<textarea name="lastCompletedTask" maxlength="600">${escapeHtml(project.lastCompletedTask || '')}</textarea><small>Sirf woh kaam likho jo waqai complete hua.</small></label>
        <label>Next step<textarea name="nextStep" maxlength="600">${escapeHtml(project.nextStep || '')}</textarea></label>
        <label>Memory notes<textarea name="memoryNotes" maxlength="4000" rows="4">${escapeHtml(project.memoryNotes || '')}</textarea></label>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save project memory</button><a class="btn btn-outline" href="/api/projects/${id}/export">Download memory.md</a></div>
      </form>
      <div class="detail-note">Last saved: ${escapeHtml(formatDate(project.memoryUpdatedAt))}. Data is saved in this extracted project's data/projects.json file on this computer only; cloud sync is optional and manual; no automatic upload runs.</div>
      <div class="memory-history"><h4 class="detail-subtitle">Memory update history</h4>${history.length ? history.map(item => `<div class="detail-list-item"><span class="detail-check">●</span><span>${escapeHtml(item.summary)}<small class="history-time">${escapeHtml(formatDate(item.createdAt))}</small></span></div>`).join('') : '<p class="empty-note">Abhi koi memory update save nahi hui.</p>'}</div>
    </section>`;
  }
  if (tab === 'checklist') {
    const tasks = project.checklist || [];
    const done = tasks.filter(item => item.done).length;
    return `<section class="panel project-detail-panel"><div class="panel-head"><div><h3>Progress checklist</h3><p>Tick karne se task is project file mein save hoga.</p></div><span class="status active">${done}/${tasks.length} marked</span></div>
      <div class="checklist-progress"><b>${project.progress}%</b><span>Tasks marked complete</span><div class="progress-track"><i class="progress-p${project.progress}"></i></div></div>
      <div class="checklist-items">${tasks.map(item => `<label class="task-row"><input type="checkbox" data-task-id="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}><span class="task-title ${item.done ? 'task-done' : ''}">${escapeHtml(item.title)}</span><small>${item.done ? 'Marked complete by user' : 'Pending'}</small></label>`).join('') || '<p class="empty-note">Abhi koi task nahi. Neeche pehla task add karo.</p>'}</div>
      <form id="addTaskForm" class="inline-add-form"><input name="title" maxlength="240" placeholder="Naya task likho..." required><button class="btn btn-primary" type="submit">＋ Add task</button></form>
      <p class="detail-note">Progress checklist ke total tasks ke muqablay mein user-marked completed tasks se calculate hoti hai. Yeh independent verification ka saboot nahi.</p>
    </section>`;
  }
  if (tab === 'history') {
    const sessions = (project.sessions || []).slice().reverse();
    return `<section class="panel project-detail-panel"><div class="panel-head"><div><h3>Session history</h3><p>Manual aur automatic records alag pehchane jayenge. Automatic records monitoring STOP par save hote hain.</p></div><span class="status active">${sessions.length} records</span></div>
      <div class="table-wrap"><table><thead><tr><th>DATE & TIME</th><th>TYPE</th><th>ACTIVITY & DETAILS</th><th>DURATION</th><th>STATUS</th></tr></thead><tbody>${sessions.map(item => `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td><span class="status ${item.source === 'automatic-monitoring' ? 'active' : 'planned'}">${item.source === 'automatic-monitoring' ? 'Automatic' : 'Manual'}</span></td><td><b>${escapeHtml(item.activity)}</b><small class="history-time">${escapeHtml(item.notes || '')}</small>${item.source === 'automatic-monitoring' ? `<details class="session-detail"><summary>${Number(item.sampleCount || 0)} samples · App usage & metrics</summary><small>Average CPU: ${item.avgCpuPercent === null || item.avgCpuPercent === undefined ? 'Unavailable' : `${Number(item.avgCpuPercent)}%`} · Average RAM: ${item.avgRamUsedPercent === null || item.avgRamUsedPercent === undefined ? 'Unavailable' : `${Number(item.avgRamUsedPercent)}%`}</small>${(item.appUsage || []).map(app => `<small class="history-time">${escapeHtml(app.name)} — ${formatElapsed(app.seconds)} (approx.)</small>`).join('')}${(item.warnings || []).map(warning => `<small class="session-warning">${escapeHtml(warning)}</small>`).join('')}</details>` : ''}</td><td>${Number(item.durationMinutes)} min${Number.isFinite(item.durationSeconds) ? ` / ${Number(item.durationSeconds)} sec` : ''}</td><td><span class="status ${item.status === 'interrupted' ? 'paused' : 'active'}">${escapeHtml(item.status || 'saved')}</span></td></tr>`).join('') || '<tr><td colspan="5">No session records yet.</td></tr>'}</tbody></table></div>
      <details class="manual-session-details"><summary>Add a manual session record</summary>
      <form id="addSessionForm" class="local-data-form compact-form"><label>Kaam / activity<input name="activity" maxlength="240" required placeholder="Aaj kya kaam kiya?"></label><label>Duration (minutes)<input name="durationMinutes" type="number" min="0" max="1440" value="0" required></label><label>Notes<textarea name="notes" maxlength="1000" rows="2" placeholder="Kya complete hua ya kya baqi hai?"></textarea></label><button class="btn btn-outline" type="submit">Save manual record</button></form></details>
    </section>`;
  }
  if (tab === 'decisions') {
    const decisions = (project.decisions || []).slice().reverse();
    return `<section class="panel project-detail-panel"><div class="panel-head"><div><h3>Project decisions</h3><p>Har faislay ke saath wajah save karo; baad mein edit ya delete bhi kar sakte ho.</p></div><span class="status active">${decisions.length} saved</span></div>
      <form id="addDecisionForm" class="local-data-form compact-form"><label>Decision<input name="text" maxlength="1000" placeholder="Kya faisla kiya?" required></label><label>Reason / wajah<textarea name="reason" maxlength="2000" rows="2" placeholder="Yeh faisla kyun kiya? (optional)"></textarea></label><button class="btn btn-primary" type="submit">＋ Save decision</button></form>
      <div class="decision-list">${decisions.map(item => `<article class="detail-list-item decision-item"><span class="detail-check">✦</span><div class="decision-content"><b>${escapeHtml(item.text)}</b>${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : '<p class="empty-note">Reason add nahi ki gayi.</p>'}<small class="history-time">Created: ${escapeHtml(formatDate(item.createdAt))}${item.updatedAt ? ` · Updated: ${escapeHtml(formatDate(item.updatedAt))}` : ''}</small><details class="decision-edit-details"><summary>Edit decision</summary><form id="editDecisionForm" class="local-data-form compact-form"><input type="hidden" name="decisionId" value="${escapeHtml(item.id)}"><label>Decision<input name="text" maxlength="1000" value="${escapeHtml(item.text)}" required></label><label>Reason / wajah<textarea name="reason" maxlength="2000" rows="2">${escapeHtml(item.reason || '')}</textarea></label><button class="btn btn-outline" type="submit">Save changes</button></form></details><button class="btn btn-danger decision-delete" type="button" data-decision-delete="${escapeHtml(item.id)}">Delete decision</button></div></article>`).join('') || '<p class="empty-note">Abhi koi decision save nahi hua.</p>'}</div>
    </section>`;
  }
  return `<div class="project-detail-grid">
      <section class="panel project-detail-panel"><div class="panel-head"><div><h3>Project goal</h3><p>What this project is trying to achieve</p></div><span class="status active">Local record</span></div><p class="detail-copy">${escapeHtml(project.goal)}</p><div class="detail-note">Starter example. Memory tab se apne project ke mutabiq update kar sakte ho.</div></section>
      <section class="panel project-detail-panel"><div class="panel-head"><div><h3>Next best step</h3><p>Saved project continuation</p></div><span class="feature-icon purple">✦</span></div><p class="detail-copy">${escapeHtml(project.nextStep || 'Not set')}</p><div class="detail-note">Yeh saved memory field hai; AI se automatically generate nahi hua.</div></section>
    </div>
    <section class="panel project-detail-panel"><div class="panel-head"><div><h3>Project records</h3><p>Har record is project ke local data file mein save hota hai.</p></div></div>
      <div class="record-shortcuts"><button class="record-shortcut" data-project-tab="memory"><b>Project Memory</b><small>Goal, last task, next step, notes</small><span>Open ↗</span></button>
      <button class="record-shortcut" data-project-tab="checklist"><b>Progress Checklist</b><small>Tasks add karo aur completion mark karo</small><span>Open ↗</span></button>
      <button class="record-shortcut" data-project-tab="history"><b>Session History</b><small>Manual work-session records</small><span>Open ↗</span></button>
      <button class="record-shortcut" data-project-tab="decisions"><b>Important Decisions</b><small>Project ke faislay save karo</small><span>Open ↗</span></button></div>
    </section>`;
}

async function renderProjectDetail(projectId, tab = 'overview') {
  try {
    const response = await api(`/api/projects/${encodeURIComponent(projectId)}`);
    const project = response.project;
    updateProjectCache(project);
    selectedProjectId = project.id;
    selectedProjectTab = tab;
    const tagClass = projectStatusClass(project.status);
    const tabs = [
      ['overview', 'Overview'], ['memory', 'Memory'], ['checklist', 'Checklist'], ['history', 'Session history'], ['decisions', 'Decisions']
    ];
    currentView = 'project-detail';
    breadcrumbCurrent.textContent = `Projects / ${project.name}`;
    $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'projects'));
    viewContent.innerHTML = `${pageHeading(`PROJECT WORKSPACE · ${project.id}`, escapeHtml(project.name), 'Har project ki apni saved memory, checklist aur history hai.', '<button class="btn btn-outline" data-view="projects">← Back to projects</button>')}
      <div class="preview-notice"><span>✦</span><div><b>Local memory is active.</b><small>Changes are saved to this project's local data/projects.json file. Owner login is active; cloud sync is optional and manual; no automatic upload runs.</small></div></div>
      <section class="project-detail-hero"><div><div class="eyebrow">${escapeHtml(project.id)} · ${escapeHtml(project.type.toUpperCase())}</div><div class="project-detail-title-row"><h2>${escapeHtml(project.name)}</h2><span class="${tagClass}">${escapeHtml(project.status)}</span></div><p>${escapeHtml(project.goal)}</p></div><div class="project-detail-progress"><strong>${project.progress}%</strong><small>${project.completedCount}/${project.totalTasks} tasks marked done</small><div class="progress-track"><i class="progress-p${project.progress}"></i></div></div></section>
      <nav class="project-tabs" aria-label="Project detail sections">${tabs.map(([id,label]) => `<button class="project-tab ${tab === id ? 'active' : ''}" data-project-tab="${id}" aria-current="${tab === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>
      <div class="project-tab-content">${projectTabContent(project, tab)}</div>
      <div class="detail-footer-note">v11.0.1 local-first workspace · Cloud sync is manual; browser content is not captured.</div>`;
    $('#sidebar').classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    notify(`Project load nahi hua: ${error.message}`);
  }
}

function pageHeading(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function renderHome() {
  const activeCount = demoProjects.filter(project => project.status === 'Active').length;
  const sessionCount = demoProjects.reduce((total, project) => total + (project.sessions || []).length, 0);
  const recentSessions = demoProjects.flatMap(project => (project.sessions || []).map(session => ({
    projectName: project.name,
    projectId: project.id,
    activity: session.activity,
    createdAt: session.createdAt,
    status: session.status || 'Saved',
    duration: Number.isFinite(session.durationSeconds) ? `${Math.round(session.durationSeconds / 60)} min` : `${session.durationMinutes || 0} min`
  }))).sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')).slice(0, 4);
  const recentMarkup = recentSessions.length
    ? recentSessions.map(item => `<div class="activity-item"><i class="activity-dot"></i><div><b>${escapeHtml(item.activity)}</b><small>${escapeHtml(item.projectId)} · ${escapeHtml(item.projectName)} · ${escapeHtml(item.status)}</small></div><span class="activity-time">${escapeHtml(formatDate(item.createdAt))}</span></div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">◷</div><h3>No session records yet</h3><p>When you save a manual or automatic session, it will appear here.</p></div>';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' });
  return `${pageHeading('YOUR WORKSPACE AT A GLANCE', `Welcome, ${escapeHtml(currentOwnerName)}`, 'Your local projects, saved sessions, and next steps.', `<span class="date-pill">${escapeHtml(today)}</span>`)}
    <section class="welcome-panel"><small>✦ &nbsp; YOUR PRIVATE LOCAL WORKSPACE</small><h2>Make progress, one clear step at a time.</h2><p>Keep your goals visible, organize every project separately, and review recommendations before you act.</p><div class="welcome-actions"><button class="btn btn-primary" data-view="projects">Explore projects <span>↗</span></button><button class="btn btn-outline" data-view="monitoring">View monitoring</button></div></section>
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-top"><span>Total projects</span><span class="stat-icon">▦</span></div><strong>${demoProjects.length}</strong><div class="stat-foot">Loaded from your local project file</div></article>
      <article class="stat-card"><div class="stat-top"><span>Active projects</span><span class="stat-icon">◉</span></div><strong>${activeCount}</strong><div class="stat-foot">Based on saved project status</div></article>
      <article class="stat-card"><div class="stat-top"><span>Reminders</span><span class="stat-icon">◷</span></div><strong id="homeReminderCount">Loading…</strong><div class="stat-foot" id="homeReminderFoot">Saved open reminders · <button class="text-link" data-view="reminders">Manage ↗</button></div></article>
      <article class="stat-card"><div class="stat-top"><span>Session records</span><span class="stat-icon">⇩</span></div><strong>${sessionCount}</strong><div class="stat-foot">Manual and automatic saved sessions</div></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><div><h3>Your projects</h3><p>Separate spaces for separate goals.</p></div><button class="text-link" data-view="projects">View all ↗</button></div>
        ${demoProjects.slice(0, 3).map(p => `<div class="project-row"><div class="project-color">${escapeHtml(p.symbol || '◈')}</div><div class="project-info"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.id)} · ${escapeHtml(p.type)}</small></div><div class="project-progress"><div class="progress-top"><span>Progress</span><b>${Number(p.progress) || 0}%</b></div><div class="progress-track"><i class="progress-p${Number(p.progress) || 0}"></i></div></div></div>`).join('')}
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Teacher's insight</h3><p>Illustrative guidance, not an AI analysis of live activity</p></div><span class="feature-icon purple">✦</span></div><div class="insight-card"><div class="insight-label">SAMPLE NEXT STEP</div><h4>Choose one practical task to practise.</h4><p>Before comparing many courses, pick one beginner task and try it. Practical evidence helps you decide what to learn next.</p><button class="insight-action" data-view="important">Open Important page ↗</button></div></section>
    </div>
    <div class="bottom-grid">
      <section class="panel"><div class="panel-head"><div><h3>Recent sessions</h3><p>From your saved project histories</p></div><button class="text-link" data-view="projects">View projects ↗</button></div><div class="activity-list">${recentMarkup}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Quick access</h3><p>Jump to a workspace area</p></div></div><div class="quick-actions"><button class="quick-action" data-view="projects"><span>▦</span><b>Projects</b><small>Open workspaces</small></button><button class="quick-action" data-view="reminders"><span>◷</span><b>Reminders</b><small>Create and manage reminders</small></button><button class="quick-action" data-view="reports"><span>⇩</span><b>Reports</b><small>See report options</small></button></div></section>
    </div>`;
}

function renderProjects() {
  const projectList = demoProjects.length
    ? `<div class="placeholder-grid">${demoProjects.map(projectMarkup).join('')}</div>`
    : `<section class="empty-state project-empty-state"><div class="empty-icon">▦</div><h3>No projects yet</h3><p>Apna pehla project create karo. Save hone ke baad yahan show hoga aur monitoring ke liye select kiya ja sakega.</p><button class="btn btn-primary" type="button" data-project-action="new">＋ Create your first project</button></section>`;
  const recordStructure = demoProjects.length ? `<section class="panel spaced-panel"><div class="panel-head"><div><h3>Project record structure</h3><p>What is saved separately for each project</p></div></div><div class="table-wrap"><table><thead><tr><th>RECORD</th><th>PURPOSE</th><th>STATUS</th></tr></thead><tbody><tr><td>Project memory</td><td class="muted">Goal, last task, decisions and next step</td><td><span class="status active">Saved locally</span></td></tr><tr><td>Progress checklist</td><td class="muted">Tasks and user-marked completion</td><td><span class="status active">Saved locally</span></td></tr><tr><td>Session history</td><td class="muted">Date-wise activity records</td><td><span class="status active">Saved locally</span></td></tr></tbody></table></div></section>` : '';
  return `${pageHeading('YOUR WORK, ORGANIZED', 'Projects', 'Har project ki apni local memory, checklist, decisions aur session history hogi.', '<button class="btn btn-primary" type="button" data-project-action="new">＋ New project</button>')}
    <div class="preview-notice"><span>✦</span><div><b>Your projects stay on this computer.</b><small>Project details and records are saved locally. Supabase cloud sync is optional, manual and only runs after your confirmation.</small></div></div>
    ${projectFormOpen ? projectCreateFormMarkup() : ''}
    ${projectList}
    ${recordStructure}`;
}

function renderMonitoring() {
  const hasProjects = demoProjects.length > 0;
  const options = demoProjects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.id)} · ${escapeHtml(project.name)}</option>`).join('');
  const projectSelect = hasProjects ? options : '<option value="">No projects available</option>';
  return `${pageHeading('VISIBLE · USER CONTROLLED', 'Live monitoring', 'Sirf tumhare START button ke baad. STOP par automatic session record selected project mein save hoga.')}
    <section class="monitor-panel monitor-root" id="monitorRoot">
      <div class="monitor-status"><span class="status-orb" id="monitorOrb"></span><div><b id="monitorStateTitle">Monitoring is OFF</b><small id="monitorStateDescription">Koi monitoring abhi active nahi hai.</small></div><span class="status planned status-push-right" id="monitorStateBadge">OFF</span></div>
      <form id="monitorStartForm" class="monitor-start-form">
        <label>Project<select id="monitorProjectSelect" name="projectId" required ${hasProjects ? '' : 'disabled'}>${projectSelect}</select></label>
        <label>Aaj ka maqsad / session activity<input id="monitorActivityInput" name="activity" maxlength="300" required ${hasProjects ? '' : 'disabled'} placeholder="Misal: Course research aur notes review"></label>
        <button class="btn btn-primary" id="monitorStartButton" type="submit" ${hasProjects ? '' : 'disabled'}>▶ Start session</button>
        ${hasProjects ? '' : '<p class="monitor-empty-guidance" id="monitorEmptyGuidance" role="status">Abhi koi project saved nahi hai. Monitoring ke liye project zaroori hai. Pehle Projects page se project create karo; phir Start session available hoga.</p>'}
      </form>
      <div id="monitorControls" class="monitor-actions hidden">
        <button class="btn btn-outline" id="monitorPause" type="button" data-monitor-action="pause">Ⅱ Pause</button>
        <button class="btn btn-outline" id="monitorResume" type="button" data-monitor-action="resume">▶ Resume</button>
        <button class="btn btn-danger" id="monitorStop" type="button" data-monitor-action="stop">■ Stop & save record</button>
      </div>
      <div class="monitor-big">
        <div class="monitor-metric"><small>ACTIVE APPLICATION</small><strong id="monitorApp">—</strong></div>
        <div class="monitor-metric"><small>CPU LOAD</small><strong id="monitorCpu">—</strong></div>
        <div class="monitor-metric"><small>RAM USED</small><strong id="monitorRam">—</strong></div>
      </div>
      <div class="monitor-live-meta"><span>Active time <b id="monitorElapsed">00:00</b></span><span>Samples <b id="monitorSamples">0</b></span><span>Warnings <b id="monitorWarnings">0</b></span></div>
      <div class="monitor-app-usage" id="monitorAppUsage"><p class="empty-note">Session start hone par approximate app usage yahan show hogi.</p></div>
      <div class="monitor-warning-list" id="monitorWarningList"></div>
      <div class="monitor-last-session" id="monitorLastSession"></div>
      <div class="monitor-running-note">Monitoring Start ke baad tab tak chalti rahegi jab tak tum Stop na karo ya local server band na karo. Sirf browser window band karne se server-side monitoring automatically stop nahi hoti.</div>
      <div class="privacy-note"><span>✓</span><span><b>Privacy boundary:</b> Is phase mein sirf foreground application ka process name aur CPU/RAM/storage health sample hoti hai. Window title, website URL ya page content, files, keyboard, clipboard, camera aur microphone capture nahi hote. Email/password/payment app process names excluded hain where identifiable. Website content monitoring is version mein shamil nahi.</span></div>
    </section>
    <section class="panel spaced-panel"><div class="panel-head"><div><h3>Monitoring scope in v11.0.1</h3><p>Manual Windows metadata + optional browser extension source (not installed)</p></div><span class="status active">Local only</span></div><div class="table-wrap"><table><thead><tr><th>DATA TYPE</th><th>v11.0.1 BEHAVIOUR</th><th>NOTES</th></tr></thead><tbody><tr><td>Foreground application</td><td><span class="status active">Sampled</span></td><td class="muted">Process name only, every 10 seconds</td></tr><tr><td>CPU / RAM / drive free</td><td><span class="status active">Sampled</span></td><td class="muted">Basic system health figures</td></tr><tr><td>Window title / URLs / page text</td><td><span class="status alert">Not captured</span></td><td class="muted">Manual browser extension capture is separate and requires per-domain permission</td></tr><tr><td>Email / password manager processes</td><td><span class="status alert">Excluded where identifiable</span></td><td class="muted">No message, password or payment contents are read</td></tr><tr><td>Keyboard / clipboard / camera / mic</td><td><span class="status alert">Never captured</span></td><td class="muted">Outside product scope</td></tr></tbody></table></div></section>`;
}

function formatElapsed(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function refreshMonitorPanel() {
  if (monitorPollBusy || currentView !== 'monitoring' || !$('#monitorRoot')) return;
  monitorPollBusy = true;
  try {
    const status = await api('/api/monitor/status');
    const active = status.activeSession;
    const running = status.state === 'running';
    const paused = status.state === 'paused';
    const activeNow = Boolean(active);
    $('#monitorStateTitle').textContent = running ? 'Monitoring is RUNNING' : paused ? 'Monitoring is PAUSED' : 'Monitoring is OFF';
    $('#monitorStateDescription').textContent = active ? `${active.projectId} · ${active.projectName} · ${active.activity}` : 'Koi monitoring abhi active nahi hai.';
    $('#monitorStateBadge').textContent = running ? 'RUNNING' : paused ? 'PAUSED' : 'OFF';
    $('#monitorStateBadge').className = `status ${running ? 'active' : paused ? 'paused' : 'planned'} status-push-right`;
    $('#monitorOrb').style.background = running ? 'var(--mint)' : paused ? 'var(--amber)' : '#65738e';
    $('#monitorStartForm').classList.toggle('hidden', activeNow);
    $('#monitorControls').classList.toggle('hidden', !activeNow);
    $('#monitorPause').classList.toggle('hidden', !running);
    $('#monitorResume').classList.toggle('hidden', !paused);
    $('#monitorStop').disabled = !activeNow;
    const canStartMonitoring = demoProjects.length > 0;
    const startButton = $('#monitorStartButton');
    const projectSelect = $('#monitorProjectSelect');
    const activityInput = $('#monitorActivityInput');
    if (startButton) startButton.disabled = !canStartMonitoring;
    if (projectSelect) projectSelect.disabled = !canStartMonitoring;
    if (activityInput) activityInput.disabled = !canStartMonitoring;
    const latest = active && active.latestSample;
    $('#monitorApp').textContent = latest ? latest.activeApp : 'Waiting…';
    $('#monitorCpu').textContent = latest && Number.isFinite(latest.cpuPercent) ? `${latest.cpuPercent}% · avg ${active.avgCpuPercent === null ? '—' : `${active.avgCpuPercent}%`}` : '—';
    $('#monitorRam').textContent = latest && Number.isFinite(latest.ramUsedPercent) ? `${latest.ramUsedPercent}% · avg ${active.avgRamUsedPercent === null ? '—' : `${active.avgRamUsedPercent}%`}` : '—';
    $('#monitorElapsed').textContent = active ? formatElapsed(active.activeSeconds) : '00:00';
    $('#monitorSamples').textContent = active ? String(active.sampleCount) : '0';
    $('#monitorWarnings').textContent = active ? String(active.warningCount) : '0';
    $('#monitorWarningList').innerHTML = active && active.warningMessages && active.warningMessages.length
      ? `<div class="monitor-warning-heading">Recent warnings</div>${active.warningMessages.map(message => `<div class="monitor-warning-item">${escapeHtml(message)}</div>`).join('')}`
      : '';
    const usage = active ? active.appUsage : [];
    $('#monitorAppUsage').innerHTML = usage.length
      ? `<div class="monitor-usage-heading">Approximate time by application</div>${usage.map(item => `<div class="monitor-usage-row"><b>${escapeHtml(item.name)}</b><span>${formatElapsed(item.seconds)}</span></div>`).join('')}`
      : '<p class="empty-note">Successful app samples yahan appear honge. Sampling har 10 seconds mein hoti hai.</p>';
    const last = status.lastSession;
    $('#monitorLastSession').innerHTML = !active && last
      ? `<div class="detail-note">Last saved automatic session: <b>${escapeHtml(last.projectId)} · ${escapeHtml(last.activity)}</b> — ${formatElapsed(last.durationSeconds)} · ${last.sampleCount} samples · ${escapeHtml(last.status)}.</div>`
      : '';
  } catch (error) {
    const description = $('#monitorStateDescription');
    if (description) description.textContent = `Monitor status load nahi hua: ${error.message}`;
  } finally {
    monitorPollBusy = false;
  }
}

function startMonitorPolling() {
  if (monitorPollTimer) clearInterval(monitorPollTimer);
  void refreshMonitorPanel();
  monitorPollTimer = setInterval(() => { void refreshMonitorPanel(); }, 2500);
}

function renderRecords() {
  const records = window.BiRecordsCore.collectRecords(demoProjects);
  const counts = window.BiRecordsCore.countByType(records);
  const visibleRecords = window.BiRecordsCore.filterRecords(records, currentRecordsFilter);
  const totalRecords = records.length;
  const projectsWithRecords = new Set(records.map(record => record.projectId)).size;
  const filters = [
    ['all', 'All records', totalRecords],
    ['session', 'Sessions', counts.sessions],
    ['decision', 'Decisions', counts.decisions],
    ['task', 'Tasks', counts.tasks],
    ['memory', 'Memory updates', counts.memory]
  ];
  const filterMarkup = filters.map(([key, label, count]) => `<button type="button" class="filter-chip ${currentRecordsFilter === key ? 'selected' : ''}" data-record-filter="${key}" aria-pressed="${currentRecordsFilter === key}">${label} <span class="record-filter-count">${count}</span></button>`).join('');
  const rows = visibleRecords.length
    ? visibleRecords.map(record => {
        const statusClass = record.status === 'Interrupted' || record.status === 'Pending' ? 'paused' : record.status === 'Marked done' || record.status === 'Verified' ? 'active' : 'planned';
        return `<tr><td>${escapeHtml(formatDate(record.createdAt))}</td><td><b>${escapeHtml(record.projectId)}</b><small class="history-time">${escapeHtml(record.projectName)}</small></td><td class="muted"><b>${escapeHtml(record.activity)}</b><small class="history-time">${escapeHtml(record.detail)}</small></td><td><span class="status ${statusClass}">${escapeHtml(record.status)}</span></td><td class="muted">${escapeHtml(record.duration)}</td></tr>`;
      }).join('')
    : `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">▤</div><h3>${totalRecords ? 'No records in this filter' : 'No records yet'}</h3><p>${totalRecords ? 'Choose another record type to see saved workspace activity.' : 'Saved sessions, decisions, checklist tasks and memory updates will appear here when you add them to a project.'}</p></div></td></tr>`;
  const activityDescription = totalRecords
    ? `${totalRecords} saved ${totalRecords === 1 ? 'entry' : 'entries'} across ${projectsWithRecords} ${projectsWithRecords === 1 ? 'project' : 'projects'}. These are records saved in your local workspace.`
    : 'Only real records saved in your local projects will appear here. No sample entries are shown.';
  return `${pageHeading('WHAT HAPPENED, WHEN', 'Records', 'A timeline of saved sessions, decisions, checklist tasks and memory updates.', '<button class="btn btn-outline" data-view="reports">Go to reports ↗</button>')}
    <div class="records-summary"><div class="summary-tile"><small>Saved entries</small><strong>${totalRecords}</strong></div><div class="summary-tile"><small>Sessions</small><strong>${counts.sessions}</strong></div><div class="summary-tile"><small>Decisions</small><strong>${counts.decisions}</strong></div><div class="summary-tile"><small>Tasks marked done</small><strong>${counts.tasksDone}</strong></div></div>
    <section class="panel"><div class="panel-head"><div><h3>Recent activity log</h3><p>${escapeHtml(activityDescription)}</p></div></div><div class="record-filters">${filterMarkup}</div><div class="table-wrap"><table><thead><tr><th>DATE & TIME</th><th>PROJECT</th><th>ACTIVITY</th><th>STATUS</th><th>DURATION</th></tr></thead><tbody>${rows}</tbody></table></div><p class="detail-note">Task status reflects what the owner marked in the checklist. It is not independent verification unless a record explicitly carries a verified flag.</p></section>`;
}

function renderChats() {
  return `${pageHeading('CONVERSATION HISTORY', 'Chats', 'No conversation source is connected to this local workspace.')}
    <section class="panel"><div class="panel-head"><div><h3>Saved conversations</h3><p>Only conversations deliberately added to this workspace will appear here.</p></div><span class="status planned">0 conversations</span></div>
      <div class="empty-state"><div class="empty-icon">▱</div><h3>No conversations yet</h3><p>There are no conversations saved in this workspace. ChatGPT and email conversations are not read or imported automatically.</p></div>
      <div class="privacy-note"><span>i</span><span>Chat history syncing is not connected. Nothing is collected in the background. Any future chat source or import feature will require a separate, deliberate setup.</span></div>
    </section>`;
}

function renderImportant() {
  return `${pageHeading('KEEP WHAT MATTERS CLOSE', 'Important', 'Built-in workspace guidance aur tumhare apne saved reference items.')}
    <section class="panel important-principles-panel" aria-labelledby="workspacePrinciplesHeading">
      <div class="panel-head"><div><h3 id="workspacePrinciplesHeading">Built-in Workspace Principles</h3><p>Default guidance. Yeh tumhare personal saved items se alag hain.</p></div><span class="status active">Always applies</span></div>
      <div class="important-principles-grid">
        <article class="important-principle-card"><div class="feature-icon purple">✦</div><h4>Permission rule</h4><p>No installation, account connection, import, export, sharing, deletion, or external action without separate, specific approval for that exact action.</p><div class="important-principle-meta"><span class="status active">Built-in principle</span></div></article>
        <article class="important-principle-card"><div class="feature-icon mint">✓</div><h4>Free-first approach</h4><p>Prefer free and offline options. Explain any unavoidable paid cost before choosing it.</p><div class="important-principle-meta"><span class="status active">Built-in principle</span></div></article>
        <article class="important-principle-card"><div class="feature-icon amber">⌂</div><h4>Teaching style</h4><p>Use simple Roman Urdu, one action at a time, with a reason and a verification step.</p><div class="important-principle-meta"><span class="status active">Built-in principle</span></div></article>
      </div>
    </section>
    <section class="panel important-personal-panel"><div class="panel-head"><div><h3>My Important Items</h3><p>Apne notes aur quick-reference items yahan save karo.</p></div><span class="status planned" id="importantCount">Loading…</span></div>
      <form id="importantForm" class="inline-form"><label>Title<input name="title" maxlength="160" required placeholder="Important note ka title"></label><label>Note<textarea name="content" rows="2" maxlength="2000" required placeholder="Reference note likho…"></textarea></label><button class="btn btn-primary" type="submit">＋ Save important item</button></form>
      <div id="importantItemsList" class="reminder-list"><p class="empty-note">Loading saved items…</p></div>
    </section>`;
}

function renderStopped() {
  const items = demoProjects.flatMap(project => (project.sessions || []).filter(session => ['interrupted','paused','stopped'].includes(String(session.status || '').toLowerCase())).map(session => ({ project, session })));
  const onHold = demoProjects.filter(project => project.status === 'On hold');
  return `${pageHeading('PICK UP WHEN YOU ARE READY', 'Stopped', 'Interrupted sessions aur On hold projects ka real record.')}
    <section class="panel"><div class="panel-head"><div><h3>Interrupted sessions</h3><p>${items.length} saved session records</p></div></div>${items.length ? items.map(({project,session}) => `<div class="project-row"><div class="project-color">Ⅱ</div><div class="project-info"><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.id)} · ${escapeHtml(session.activity || 'Session')} · ${escapeHtml(formatDate(session.createdAt))}</small></div><span class="status paused">${escapeHtml(session.status)}</span><button class="btn btn-outline btn-small" data-project-id="${escapeHtml(project.id)}">Open project</button></div>`).join('') : '<div class="empty-note">Koi interrupted session record nahi.</div>'}</section>
    <section class="panel"><div class="panel-head"><div><h3>On hold projects</h3><p>${onHold.length} saved projects</p></div></div>${onHold.length ? onHold.map(project => `<div class="project-row"><div class="project-color">Ⅱ</div><div class="project-info"><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.id)} · ${escapeHtml(project.nextStep || 'No next step saved')}</small></div><span class="status paused">On hold</span><button class="btn btn-outline btn-small" data-project-id="${escapeHtml(project.id)}">Open project</button></div>`).join('') : '<div class="empty-note">Koi On hold project nahi.</div>'}</section>`;
}

function renderReminders() {
  const projectOptions = demoProjects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.id)} · ${escapeHtml(project.name)}</option>`).join('');
  return `${pageHeading('STAY ON TRACK', 'Reminders', 'Apne tasks ke liye local reminders create aur manage karo.')}
    <section class="panel"><div class="panel-head"><div><h3>Create reminder</h3><p>Reminder is computer par save hoga. Notification permission alag se enable karni hogi.</p></div></div>
      <form id="reminderForm" class="inline-form"><label>Reminder title<input name="title" maxlength="200" required placeholder="Misal: Project review complete karna"></label><label>Due date & time<input name="dueAt" type="datetime-local" required></label><label>Project (optional)<select name="projectId"><option value="">No project link</option>${projectOptions}</select></label><label>Notes (optional)<input name="notes" maxlength="1000" placeholder="Short note"></label><button class="btn btn-primary" type="submit">＋ Save reminder</button></form>
    </section><section class="panel"><div class="panel-head"><div><h3>Saved reminders</h3><p>Create, edit, complete ya delete kar sakte ho.</p></div><span class="status planned" id="reminderCount">Loading…</span></div><div id="remindersList" class="reminder-list"><p class="empty-note">Loading reminders…</p></div></section>`;
}

function renderAlerts() {
  return `${pageHeading('IMPORTANT NOTIFICATIONS', 'Alerts', 'Real alerts reminders ki due date aur time se banti hain.')}
    <section class="panel"><div class="panel-head"><div><h3>Active alerts</h3><p>Upcoming 24 hours aur overdue reminders.</p></div><span class="status planned" id="alertCount">Loading…</span></div><div id="alertsList" class="alert-list"><p class="empty-note">Loading alerts…</p></div></section>`;
}

function renderReports() {
  return `${pageHeading('YOUR WORK, IN A FILE', 'Reports', 'Saved projects aur records se real local report banao.')}
    <section class="panel"><div class="panel-head"><div><h3>Workspace summary</h3><p>Sirf project names, statuses, checklist counts, sessions, decisions aur reminders. Private notes/chat content report mein shamil nahi.</p></div><span class="status planned">Local report</span></div><div id="reportSummary" class="report-summary"><p class="empty-note">Loading saved workspace data…</p></div><div class="settings-actions"><button class="btn btn-outline btn-small" id="downloadReportCsv" type="button">Download CSV</button><button class="btn btn-outline btn-small" id="downloadReportMarkdown" type="button">Download Markdown</button></div></section>`;
}

function renderSettings() {
  const rows = [
    ['Local Owner account', 'Local projects, reminders, reports aur AI history sirf Local Owner login ke baad accessible hain.', authenticated ? 'Signed in' : 'Locked'],
    ['Cloud account', 'Cloud sign-in sirf manual Supabase sync ke liye hai; yeh local projects ko unlock nahi karta.', cloudAuthenticated ? `Connected: ${cloudAccountEmail || 'account email unavailable'}` : (cloudConfigured ? 'Ready to connect' : 'Needs setup')],
    ['Cloud storage', 'RLS-protected project table. Sync sirf tumhare explicit confirmation ke baad hota hai.', cloudConfigured ? 'Configured · not live-verified' : 'Not configured'],
    ['Browser extension', 'Manual page capture source included in v11.0. No automatic website reading or extension installation.', 'Not installed'],
    ['Desktop inspection', 'UI Automation sirf manually aur approved app process names ke liye available hogi.', 'Off by default'],
    ['Notifications', 'Browser/Windows notifications sirf tumhari permission ke baad; browser/app band ho to reminders fire nahi karte.', 'Loading…'],
    ['Workspace backup', 'Export ya restore mein auth credentials aur API keys shamil nahi hotin.', 'Local only']
  ];
  return `${pageHeading('YOUR PREFERENCES', 'Settings', 'Account, privacy, notification, agent aur backup controls.')}
    <section class="panel"><div class="panel-head"><div><h3>Workspace settings</h3><p>Account and storage status</p></div></div><div class="settings-list">${rows.map(r=>`<div class="setting-row"><div><b>${r[0]}</b><small>${r[1]}</small></div><span class="setting-value">${r[2]}</span></div>`).join('')}</div>
      <div class="settings-actions"><button class="btn btn-outline btn-small" id="connectCloudButton" type="button">${cloudAuthenticated ? 'Change cloud account' : 'Connect cloud account'}</button>${cloudAuthenticated ? '<button class="btn btn-outline btn-small" id="disconnectCloudButton" type="button">Disconnect cloud</button><button class="btn btn-outline btn-small" id="cloudSyncButton" type="button">Review & sync local projects</button><button class="btn btn-outline btn-small" id="loadCloudProjectsButton" type="button">View my cloud projects</button><small>Existing matching cloud project codes will be updated only after your confirmation. Cloud list is read-only here.</small>' : ''}</div>
      <div id="cloudProjectsPreview" class="settings-group hidden"></div><div class="settings-group"><h3>Notifications</h3><p>Browser permission tumhare click ke baad hi maangi jayegi. Notifications tabhi aayengi jab app/browser chal raha ho.</p><button class="btn btn-outline btn-small" id="enableNotificationsButton" type="button">Enable browser notifications</button><span id="notificationSettingStatus" class="setting-value">Loading…</span></div>
      <div class="settings-group"><h3>Approved desktop apps</h3><p>Sirf process names jo tum yahan save karoge, manual Desktop UIA check ke liye allow honge. Default empty hai.</p><textarea id="approvedAppsInput" rows="2" maxlength="1000" placeholder="Misal: notepad, code"></textarea><button class="btn btn-outline btn-small" id="saveApprovedAppsButton" type="button">Save approved apps</button></div>
      <div class="settings-group"><h3>Backup and restore</h3><p>Backup mein projects, reminders, settings, Chatbot aur Teacher history hoti hai. Owner password/recovery file aur server .env key include nahi hoti. AI chat text backup ka hissa hota hai; us mein tumhara likha koi private text ho sakta hai.</p><div class="settings-actions"><button class="btn btn-outline btn-small" id="downloadWorkspaceBackup" type="button">Download workspace backup</button><label class="btn btn-outline btn-small" for="restoreWorkspaceFile">Choose backup file</label><input id="restoreWorkspaceFile" type="file" accept="application/json,.json" hidden /></div><small id="backupStatus" class="setting-value"></small></div>
    </section>`;
}

async function loadImportantView() {
  const target = $('#importantItemsList'); if (!target) return;
  try {
    const result = await api('/api/important'); const items = result.items || [];
    const count = $('#importantCount'); if (count) count.textContent = `${items.length} saved items`;
    target.innerHTML = items.length ? items.map(item => `<div class="reminder-row"><div class="reminder-info"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.content)}</small><small>${escapeHtml(formatDate(item.createdAt))}</small></div><div class="settings-actions"><button class="btn btn-outline btn-small" data-important-edit="${escapeHtml(item.id)}">Edit</button><button class="btn btn-danger btn-small" data-important-delete="${escapeHtml(item.id)}">Delete</button></div></div>`).join('') : '<div class="empty-state"><h3>No personal items yet</h3><p>Upar form se apna pehla important note save karo.</p></div>';
  } catch (error) { target.innerHTML = `<p class="empty-note">Important items load nahi huay: ${escapeHtml(error.message)}</p>`; }
}

async function loadRemindersView() {
  const target = $('#remindersList'); if (!target) return;
  try {
    const result = await api('/api/reminders');
    const reminders = result.reminders || [];
    const count = $('#reminderCount'); if (count) count.textContent = `${reminders.filter(item => !item.completedAt).length} open`;
    target.innerHTML = reminders.length ? reminders.map(item => {
      const project = demoProjects.find(p => p.id === item.projectId);
      return `<div class="reminder-row ${item.completedAt ? 'is-complete' : ''}"><div class="reminder-info"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(formatDate(item.dueAt))}${project ? ` · ${escapeHtml(project.name)}` : ''}</small>${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ''}</div><div class="settings-actions">${item.completedAt ? '<span class="status active">Completed</span>' : `<button class="btn btn-outline btn-small" data-reminder-edit="${escapeHtml(item.id)}">Edit</button><button class="btn btn-outline btn-small" data-reminder-complete="${escapeHtml(item.id)}">Complete</button>`}<button class="btn btn-danger btn-small" data-reminder-delete="${escapeHtml(item.id)}">Delete</button></div></div>`;
    }).join('') : '<div class="empty-state"><h3>No reminders yet</h3><p>Upar form se apna pehla reminder create karo.</p></div>';
  } catch (error) { target.innerHTML = `<p class="empty-note">Reminders load nahi huay: ${escapeHtml(error.message)}</p>`; }
}

async function loadAlertsView() {
  const target = $('#alertsList'); if (!target) return;
  try {
    const result = await api('/api/alerts');
    const alerts = result.alerts || [];
    const count = $('#alertCount'); if (count) count.textContent = `${alerts.length} active`;
    const navCount = $('.alert-count'); if (navCount) { navCount.textContent = String(alerts.length); navCount.classList.toggle('hidden', alerts.length === 0); }
    target.innerHTML = alerts.length ? alerts.map(item => `<div class="alert-row"><div class="alert-marker ${item.severity === 'warning' ? 'alert-pink' : 'alert-amber'}">${item.severity === 'warning' ? '!' : '◷'}</div><div class="reminder-info"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message)} · ${escapeHtml(formatDate(item.dueAt))}</small></div><button class="btn btn-outline btn-small" data-alert-dismiss="${escapeHtml(item.sourceId)}">Dismiss</button></div>`).join('') : '<div class="empty-state"><h3>No active alerts</h3><p>Jab reminder due ya overdue hoga, alert yahan nazar aayega.</p></div>';
  } catch (error) { target.innerHTML = `<p class="empty-note">Alerts load nahi huay: ${escapeHtml(error.message)}</p>`; }
}

async function loadReportsView() {
  const target = $('#reportSummary'); if (!target) return;
  try {
    const report = await api('/api/reports/summary');
    const t = report.totals;
    target.innerHTML = `<div class="records-summary"><div class="summary-tile"><small>Projects</small><strong>${t.projects}</strong></div><div class="summary-tile"><small>Tasks complete</small><strong>${t.completedTasks}/${t.tasks}</strong></div><div class="summary-tile"><small>Sessions</small><strong>${t.sessions}</strong></div><div class="summary-tile"><small>Open reminders</small><strong>${t.openReminders}</strong></div></div><div class="table-wrap"><table><thead><tr><th>PROJECT</th><th>STATUS</th><th>PROGRESS</th><th>SESSIONS</th><th>MINUTES</th><th>DECISIONS</th><th>REMINDERS</th></tr></thead><tbody>${report.projects.map(item => `<tr><td>${escapeHtml(item.name)}<small>${escapeHtml(item.id)}</small></td><td>${escapeHtml(item.status)}</td><td>${item.progress}% (${item.completedTasks}/${item.totalTasks})</td><td>${item.sessionCount}</td><td>${item.totalDurationMinutes}</td><td>${item.decisionCount}</td><td>${item.reminderCount}</td></tr>`).join('') || '<tr><td colspan="7">No saved projects yet.</td></tr>'}</tbody></table></div><p class="detail-note">Generated: ${escapeHtml(formatDate(report.generatedAt))}. Private project goals, notes, AI chats aur credentials report mein include nahi.</p>`;
  } catch (error) { target.innerHTML = `<p class="empty-note">Report generate nahi hui: ${escapeHtml(error.message)}</p>`; }
}

async function loadSettingsView() {
  try {
    const result = await api('/api/settings');
    const settings = result.settings || {};
    const status = $('#notificationSettingStatus');
    if (status) status.textContent = settings.browserNotificationsEnabled && window.Notification?.permission === 'granted' ? 'Enabled' : (window.Notification?.permission === 'denied' ? 'Browser permission denied' : 'Disabled');
    const apps = $('#approvedAppsInput'); if (apps) apps.value = (settings.approvedApps || []).join(', ');
  } catch (error) { notify(`Settings load nahi hui: ${error.message}`); }
}

async function startAlertPolling() {
  if (alertPollTimer) clearInterval(alertPollTimer);
  const check = async () => {
    if (!authenticated || alertPollBusy) return;
    alertPollBusy = true;
    try {
      const [alertsResult, settingsResult] = await Promise.all([api('/api/alerts'), api('/api/settings')]);
      const alerts = alertsResult.alerts || [];
      const navCount = $('.alert-count'); if (navCount) { navCount.textContent = String(alerts.length); navCount.classList.toggle('hidden', alerts.length === 0); }
      if (settingsResult.settings?.browserNotificationsEnabled && window.Notification?.permission === 'granted') {
        for (const item of alerts) {
          if (item.notifiedAt || Date.parse(item.dueAt) > Date.now()) continue;
          new Notification(item.title, { body: `${item.message} ${new Date(item.dueAt).toLocaleString()}` });
          await api(`/api/reminders/${encodeURIComponent(item.sourceId)}/notified`, { method: 'POST', body: '{}' });
        }
      }
      if (currentView === 'alerts') await loadAlertsView();
    } catch { /* A temporary reminder poll failure must not lock the workspace. */ }
    finally { alertPollBusy = false; }
  };
  await check();
  alertPollTimer = setInterval(() => { void check(); }, 30_000);
}

async function downloadWorkspaceFile(url, filename) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = objectUrl; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
}

function renderAiShell(mode) {
  const teacher = mode === 'teacher';
  const projectOptions = demoProjects.map(project => `<option value="${escapeHtml(project.id)}" ${selectedProjectId === project.id ? 'selected' : ''}>${escapeHtml(project.id)} · ${escapeHtml(project.name)}</option>`).join('');
  const learningPanel = teacher ? `<div class="ai-progress">
    <h3>Learning progress</h3><p>Goals aur lessons yahan manage honge. Changes tabhi save hongi jab tum Save progress dabao ge.</p>
    <div class="ai-progress-group"><b>Learning goals</b><div class="ai-progress-items" data-ai-goals-list><p class="muted">Loading goals…</p></div><div class="ai-progress-add"><input type="text" maxlength="300" data-ai-new-goal placeholder="Naya learning goal"><button type="button" class="btn btn-outline btn-small" data-ai-add-goal>Add</button></div></div>
    <div class="ai-progress-group"><b>Completed lessons</b><div class="ai-progress-items" data-ai-lessons-list><p class="muted">Loading lessons…</p></div><div class="ai-progress-add"><input type="text" maxlength="300" data-ai-new-lesson placeholder="Completed lesson ka naam"><button type="button" class="btn btn-outline btn-small" data-ai-add-lesson>Add</button></div></div>
    <label>Learning notes<textarea data-ai-notes rows="4" maxlength="5000" placeholder="Aaj kya seekha…"></textarea></label>
    <button type="button" class="btn btn-primary btn-small" data-ai-save-progress>Save progress</button><small class="ai-progress-saved" data-ai-progress-updated>Progress local computer par save hoti hai.</small>
  </div>` : '';
  return `${pageHeading(teacher ? 'YOUR PERSONAL LEARNING SPACE' : 'YOUR PRIVATE AI ASSISTANT', teacher ? 'AI Teacher' : 'AI Chatbot', teacher ? 'Roman Urdu mein seekhein, practice karein aur apni learning progress save karein.' : 'Ideas, sawalat aur project discussions ke liye aapka private chat space.', '<span class="status" data-ai-status>Checking AI status…</span>')}
    <section class="panel ai-workspace" data-ai-mode="${mode}">
      <div class="ai-toolbar"><div><b>${teacher ? 'Teacher workspace' : 'Chat workspace'}</b><small>Chatbot aur Teacher ki histories alag local files mein save hoti hain. OpenAI sirf enabled server par aur Send to AI dabane par use hoga.</small></div><button type="button" class="btn btn-outline btn-small" data-ai-new="${mode}">＋ New chat</button></div>
      <div class="ai-layout"><aside class="ai-history"><h3>Saved conversations</h3><div data-ai-history>Loading local history…</div>${learningPanel}</aside>
      <div class="ai-conversation"><div class="ai-welcome"><span class="ai-mark">${teacher ? '🎓' : '✦'}</span><h2>${teacher ? 'Aaj kya seekhna chahte hain?' : 'Aap kis cheez par baat karna chahte hain?'}</h2><p>${teacher ? 'Apna sawal ya learning topic likhein. Teacher simple Roman Urdu mein ek waqt mein ek step samjhane ke liye tayyar hai.' : 'Apna sawal, idea ya project topic yahan likhein. General questions aur project planning ke liye.'}</p></div>
      <div class="ai-message-list" data-ai-messages aria-live="polite"></div><form class="ai-compose" data-ai-form="${mode}">
        <label class="ai-project-context"><span><input type="checkbox" data-ai-attach-project> Is message ke saath project context AI ko bhejo</span><select data-ai-project-select ${demoProjects.length ? '' : 'disabled'}><option value="">Project choose karo</option>${projectOptions}</select><small>Default OFF. Checkbox ON karke Send to AI dabane par sirf is request ke liye project name, goal, next step aur checklist share hogi. Project context saved chat mein store nahi hota aur aglay requests mein dobara nahi bheja jata. Notes, decisions aur session records share nahi honge.</small></label>
        <textarea name="message" rows="3" maxlength="12000" placeholder="${teacher ? 'Misal: Mujhe JavaScript bilkul shuru se samjhao…' : 'Apna message likhein…'}" required></textarea><button class="btn btn-primary" type="submit" data-ai-submit>Save locally</button></form><small class="ai-local-note" data-ai-note>Local history is on this computer. OpenAI requests are disabled by default.</small></div></div>
    </section>`;
}
function renderAiChatbot() { return renderAiShell('chatbot'); }
function renderAiTeacher() { return renderAiShell('teacher'); }


function renderInspector() {
  const options = demoProjects.map(project =>
    `<option value="${escapeHtml(project.id)}">${escapeHtml(project.id)} · ${escapeHtml(project.name)}</option>`
  ).join('');
  return `${pageHeading('ONE-TIME · READ-ONLY CHECK', 'AI Project Inspector', 'Manual checks only. Koi background page ya desktop reading nahi hoti.')}
    <section class="panel inspector-panel" data-mode="manual-read-only">
      <div class="panel-head"><div><h3>Windows system snapshot</h3><p>Check Now sirf saved project progress aur aik system snapshot dekhta hai.</p></div><span class="status planned">MANUAL ONLY</span></div>
      <div class="inspector-controls"><label for="inspectorProjectSelect">Project</label><select id="inspectorProjectSelect" ${demoProjects.length ? '' : 'disabled'}>${options || '<option value="">No saved projects</option>'}</select><button class="btn btn-primary" id="inspectorCheckNow" type="button" ${demoProjects.length ? '' : 'disabled'}>⌕ Check Now</button><button class="btn btn-outline" id="desktopInspectorCheck" type="button">Check approved desktop app</button></div>
      <p class="inspector-privacy">Privacy: system snapshot foreground process name aur basic CPU/RAM/system-drive health only. Browser URLs/content, window titles, screenshots, files, keyboard aur clipboard is check mein read nahi hote.</p>
      <div id="inspectorResult" class="inspector-result" aria-live="polite"><p class="empty-note">Abhi koi system inspection nahi hui.</p></div>
    </section>
    <section class="panel"><div class="panel-head"><div><h3>Browser / desktop evidence review</h3><p>Browser extension se manually captured JSON yahan paste karo, ya approved desktop app ka snapshot lo. Pehle evidence review karo; AI ko kuch tabhi bheja jayega jab tum Analyze dabao ge.</p></div></div>
      <textarea id="browserEvidenceInput" rows="9" maxlength="16000" placeholder='Browser extension ka JSON yahan paste karo. Example: {"source":"browser-extension","url":"https://example.com","title":"Page title","text":"Visible page text"}'></textarea>
      <div class="settings-actions"><button class="btn btn-primary" id="analyzeEvidenceButton" type="button">Analyze reviewed evidence with AI</button></div>
      <p class="inspector-privacy">Page/app text untrusted data samjha jayega. Password, OTP, payment, email aur form pages capture nahi hone chahiye. AI analysis disabled ho to koi API request nahi bheji jayegi.</p>
      <pre id="analysisResult" class="analysis-result" aria-live="polite">No analysis yet.</pre>
    </section>`;
}

const renderers = { home: renderHome, projects: renderProjects, monitoring: renderMonitoring, inspector: renderInspector, records: renderRecords, chats: renderChats, 'ai-chatbot': renderAiChatbot, 'ai-teacher': renderAiTeacher, important: renderImportant, stopped: renderStopped, reminders: renderReminders, alerts: renderAlerts, reports: renderReports, settings: renderSettings };

async function refreshGlobalMonitorIndicator() {
  if (globalMonitorPollBusy || !$('#globalMonitorIndicator')) return;
  globalMonitorPollBusy = true;
  try {
    const status = await api('/api/monitor/status');
    const button = $('#globalMonitorIndicator');
    const active = status.activeSession;
    if (active) {
      button.classList.remove('hidden');
      button.textContent = status.state === 'paused'
        ? 'Ⅱ MONITORING PAUSED · OPEN CONTROLS'
        : '● MONITORING ACTIVE · OPEN CONTROLS';
      button.classList.toggle('is-paused', status.state === 'paused');
    } else {
      button.classList.add('hidden');
      button.classList.remove('is-paused');
    }
  } catch {
    // Do not replace the rest of the dashboard if the status check is temporarily unavailable.
  } finally {
    globalMonitorPollBusy = false;
  }
}

function startGlobalMonitorIndicator() {
  if (globalMonitorPollTimer) clearInterval(globalMonitorPollTimer);
  void refreshGlobalMonitorIndicator();
  globalMonitorPollTimer = setInterval(() => { void refreshGlobalMonitorIndicator(); }, 5000);
}

function renderView(view) {
  if (monitorPollTimer) { clearInterval(monitorPollTimer); monitorPollTimer = null; }
  currentView = renderers[view] ? view : 'home';
  breadcrumbCurrent.textContent = titles[currentView];
  viewContent.innerHTML = renderers[currentView]();
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === currentView));
  $('#sidebar').classList.remove('mobile-open');
  if (currentView === 'monitoring') startMonitorPolling();
  if (currentView === 'ai-chatbot' || currentView === 'ai-teacher') void loadAiLocalView(currentView === 'ai-teacher' ? 'teacher' : 'chatbot');
  if (currentView === 'important') void loadImportantView();
  if (currentView === 'reminders') void loadRemindersView();
  if (currentView === 'alerts') void loadAlertsView();
  if (currentView === 'reports') void loadReportsView();
  if (currentView === 'settings') void loadSettingsView();
}


document.addEventListener('click', async (event) => {
  const desktopButton = event.target.closest('#desktopInspectorCheck');
  if (desktopButton && currentView === 'inspector') {
    desktopButton.disabled = true;
    try {
      const result = await api('/api/inspector/desktop-check', { method: 'POST', body: '{}' });
      $('#browserEvidenceInput').value = JSON.stringify(result.evidence, null, 2);
      notify(result.evidence.status === 'captured' ? 'Approved desktop app ka text capture ho gaya. Review ke baad hi AI ko bhejna.' : (result.evidence.reason || 'Desktop app supported nahi.'));
    } catch (error) { notify(`Desktop check nahi hui: ${error.message}`); }
    finally { desktopButton.disabled = false; }
    return;
  }
  const analyzeButton = event.target.closest('#analyzeEvidenceButton');
  if (analyzeButton && currentView === 'inspector') {
    const projectId = $('#inspectorProjectSelect')?.value || '';
    const output = $('#analysisResult');
    if (!projectId) return notify('Pehle project select karo.');
    let evidence;
    try { evidence = JSON.parse($('#browserEvidenceInput').value || '{}'); }
    catch { return notify('Evidence JSON valid nahi. Extension se dobara copy/paste karo.'); }
    analyzeButton.disabled = true; output.textContent = 'Evidence AI ko bheji ja rahi hai…';
    try {
      const result = await api('/api/inspector/analyze', { method: 'POST', body: JSON.stringify({ projectId, evidence }) });
      output.textContent = `${result.analysis}\n\nModel: ${result.model || 'configured model'} · Saved: no`;
    } catch (error) { output.textContent = `Analysis nahi hui: ${error.message}`; }
    finally { analyzeButton.disabled = false; }
    return;
  }
});

document.addEventListener('click', async (event) => {
  const button = event.target.closest('#inspectorCheckNow');
  if (!button || currentView !== 'inspector') return;
  const select = $('#inspectorProjectSelect');
  const result = $('#inspectorResult');
  if (!select || !select.value || !result) return;
  button.disabled = true;
  result.innerHTML = '<p class="empty-note">One-time check chal raha hai…</p>';
  try {
    const payload = await api('/api/inspector/check-now', {
      method: 'POST',
      body: JSON.stringify({ projectId: select.value })
    });
    const report = payload.report;
    const project = report.project;
    const system = report.system;
    result.innerHTML = `
      <div class="inspector-report-head"><div><small>INSPECTION REPORT</small><h3>${escapeHtml(project.name)} · ${escapeHtml(project.id)}</h3></div><span class="status active">COMPLETED</span></div>
      <p class="inspector-time">Checked: ${escapeHtml(formatDate(report.checkedAt))} · Read-only · Not saved</p>
      <div class="inspector-metrics">
        <div><small>CHECKLIST PROGRESS</small><b>${project.progress}%</b><span>${project.checklistCompleted}/${project.checklistTotal} complete</span></div>
        <div><small>FOREGROUND APP</small><b>${escapeHtml(system.activeApp)}</b><span>Process name only</span></div>
        <div><small>CPU / RAM</small><b>${system.cpuPercent === null ? '—' : `${system.cpuPercent}%`} / ${system.ramUsedPercent === null ? '—' : `${system.ramUsedPercent}%`}</b><span>Single snapshot</span></div>
      </div>
      <div class="inspector-findings"><h4>Findings</h4><ul>${report.findings.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      <div class="inspector-next"><b>Saved project goal</b><p>${escapeHtml(project.goal || 'Not set')}</p><b>Last completed task</b><p>${escapeHtml(project.lastCompletedTask || 'Not set')}</p><b>Saved next step</b><p>${escapeHtml(project.nextStep || 'Not set')}</p></div>
      <p class="inspector-limitation">Important: App ka naam aur saved checklist actual kaam sahi direction mein hone ka proof nahi. Website/page content inspect nahi hua. Is report ko guidance samjho, final verification nahi.</p>`;
    notify('Manual inspection report tayyar hai. Koi project data change nahi hua.');
  } catch (error) {
    result.innerHTML = `<p class="inspector-error">Inspection complete nahi hui: ${escapeHtml(error.message)}</p>`;
    notify(`Inspection failed: ${error.message}`);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id !== 'monitorStartForm') return;
  event.preventDefault();
  if (demoProjects.length === 0) {
    notify('Monitoring start nahi ho sakti. Pehle ek project create ya add karo.');
    return;
  }
  const values = Object.fromEntries(new FormData(form).entries());
  if (!demoProjects.some(project => project.id === values.projectId)) {
    notify('Selected project nahi mila. Pehle valid project select karo.');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const result = await api('/api/monitor/start', { method: 'POST', body: JSON.stringify(values) });
    notify(`Monitoring start ho gayi. Safety backup ban gaya: ${result.backupName}`);
    await refreshMonitorPanel();
    await refreshGlobalMonitorIndicator();
  } catch (error) {
    notify(`Monitoring start nahi hui: ${error.message}`);
  } finally {
    if (button && form.isConnected) button.disabled = false;
  }
});

document.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-monitor-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.monitorAction;
  if (action === 'stop' && !window.confirm('Monitoring band karke automatic session record save karna hai?')) return;
  actionButton.disabled = true;
  try {
    const result = await api(`/api/monitor/${action}`, { method: 'POST', body: '{}' });
    if (action === 'stop') {
      notify(`Session save ho gaya. ${result.session.sampleCount} samples record hue.`);
      await loadProjects();
    } else {
      notify(action === 'pause' ? 'Monitoring pause ho gayi.' : 'Monitoring resume ho gayi.');
    }
    await refreshMonitorPanel();
    await refreshGlobalMonitorIndicator();
  } catch (error) {
    notify(`Action complete nahi hua: ${error.message}`);
  } finally {
    if (actionButton.isConnected) actionButton.disabled = false;
  }
});

document.addEventListener('click', async (event) => {
  if (authenticated) pingActivity();
  const authAction = event.target.closest('[data-auth-action]');
  if (authAction) {
    if (authAction.dataset.authAction === 'welcome') { showLanding(); return; }
    if (authAction.dataset.authAction === 'google-login') { window.location.href = '/api/cloud-auth/google'; return; }
    showAuth(authAction.dataset.authAction);
    return;
  }
  const authButton = event.target.closest('[data-auth]');
  if (authButton) { showAuth(authConfigured ? 'signin' : 'setup'); return; }
  const cloudSyncButton = event.target.closest('#cloudSyncButton');
  if (cloudSyncButton) {
    if (!cloudAuthenticated) return notify('Pehle cloud account login karein.');
    if (!window.confirm(`Connected cloud account (${cloudAccountEmail || 'email unavailable'}) ke liye ${demoProjects.length} local projects upload honge. Existing matching cloud project codes will be updated. Local files delete nahi hongi. Kya aap is upload ki ijazat dete hain?`)) return;
    cloudSyncButton.disabled = true;
    try { const result = await api('/api/cloud-auth/sync', { method: 'POST', body: JSON.stringify({ projects: demoProjects }) }); notify(`${result.synced} projects cloud mein sync ho gaye.`); }
    catch (error) { if (error.status === 401) { cloudAuthenticated = false; cloudAccountEmail = ''; renderView('settings'); } notify(`Cloud sync nahi hui: ${error.message}`); }
    finally { if (cloudSyncButton.isConnected) cloudSyncButton.disabled = false; }
    return;
  }
  const loadCloudProjects = event.target.closest('#loadCloudProjectsButton');
  if (loadCloudProjects) {
    loadCloudProjects.disabled = true;
    try {
      const result = await api('/api/cloud-auth/projects');
      const panel = $('#cloudProjectsPreview');
      if (panel) {
        panel.classList.remove('hidden');
        panel.innerHTML = `<h3>My Supabase projects</h3><p>Yeh list signed-in account ki RLS-filtered cloud records se aayi hai. Local projects mein import ya overwrite nahi hota.</p>${result.projects.length ? result.projects.map(item => `<div class="reminder-row"><div class="reminder-info"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.projectCode)} · ${escapeHtml(item.status)}</small></div><span class="status active">Cloud only</span></div>`).join('') : '<p class="empty-note">Is cloud account mein abhi koi project nahi.</p>'}`;
      }
    } catch (error) { if (error.status === 401) { cloudAuthenticated = false; cloudAccountEmail = ''; renderView('settings'); } notify(`Cloud projects load nahi huay: ${error.message}`); }
    finally { loadCloudProjects.disabled = false; }
    return;
  }
  const connectCloud = event.target.closest('#connectCloudButton');
  if (connectCloud) {
    if (cloudAuthenticated) {
      if (!window.confirm(`Current cloud account ${cloudAccountEmail || ''} disconnect karke doosra account connect karna hai? Local data change nahi hoga.`)) return;
      try { await api('/api/cloud-auth/logout', { method: 'POST', body: '{}' }); cloudAuthenticated = false; cloudAccountEmail = ''; } catch (error) { return notify(error.message); }
    }
    showAuth('cloud-signin', 'Sirf apna Supabase account connect karein. Local workspace alag Local Owner login se protected rahega.'); return;
  }
  const disconnectCloud = event.target.closest('#disconnectCloudButton');
  if (disconnectCloud) {
    if (!window.confirm('Kya is browser se Supabase cloud account disconnect karna hai? Local projects delete nahi honge.')) return;
    try { await api('/api/cloud-auth/logout', { method: 'POST', body: '{}' }); cloudAuthenticated = false; cloudAccountEmail = ''; renderView('settings'); notify('Cloud account disconnect ho gaya.'); }
    catch (error) { notify(`Cloud disconnect nahi hua: ${error.message}`); }
    return;
  }
  const enableNotifications = event.target.closest('#enableNotificationsButton');
  if (enableNotifications) {
    if (!('Notification' in window)) return notify('Is browser mein desktop notifications supported nahi.');
    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ browserNotificationsEnabled: enabled }) }); await loadSettingsView(); notify(enabled ? 'Browser notifications enable ho gayin.' : 'Notifications enable nahi hui.'); }
    catch (error) { notify(`Notification setting save nahi hui: ${error.message}`); }
    return;
  }
  const saveApps = event.target.closest('#saveApprovedAppsButton');
  if (saveApps) {
    const approvedApps = ($('#approvedAppsInput')?.value || '').split(',').map(item => item.trim()).filter(Boolean);
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ approvedApps }) }); notify('Approved desktop app list save ho gayi.'); }
    catch (error) { notify(`App list save nahi hui: ${error.message}`); }
    return;
  }
  const downloadBackup = event.target.closest('#downloadWorkspaceBackup');
  if (downloadBackup) {
    downloadBackup.disabled = true;
    try { await downloadWorkspaceFile('/api/backup', 'biillliiii-inspector-backup-v11.0.1.json'); notify('Workspace backup download ho gaya.'); }
    catch (error) { notify(error.message); }
    finally { downloadBackup.disabled = false; }
    return;
  }
  const downloadCsv = event.target.closest('#downloadReportCsv');
  if (downloadCsv) { try { await downloadWorkspaceFile('/api/reports/summary.csv', 'biillliiii-workspace-report.csv'); } catch (error) { notify(error.message); } return; }
  const downloadMd = event.target.closest('#downloadReportMarkdown');
  if (downloadMd) { try { await downloadWorkspaceFile('/api/reports/summary.md', 'biillliiii-workspace-report.md'); } catch (error) { notify(error.message); } return; }
  const editImportant = event.target.closest('[data-important-edit]');
  if (editImportant) {
    try {
      const result = await api('/api/important');
      const item = (result.items || []).find(value => value.id === editImportant.dataset.importantEdit);
      if (!item) throw new Error('Important item not found.');
      const title = window.prompt('Important item ka title update karo:', item.title);
      if (title === null) return;
      const content = window.prompt('Important note update karo:', item.content);
      if (content === null) return;
      await api(`/api/important/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ title, content }) });
      await loadImportantView(); notify('Important item update ho gaya.');
    } catch (error) { notify(`Important item update nahi hua: ${error.message}`); }
    return;
  }
  const deleteImportant = event.target.closest('[data-important-delete]');
  if (deleteImportant) {
    if (!window.confirm('Kya yeh personal important note delete karna hai?')) return;
    try { await api(`/api/important/${encodeURIComponent(deleteImportant.dataset.importantDelete)}`, { method: 'DELETE', body: '{}' }); await loadImportantView(); notify('Important item delete ho gaya.'); }
    catch (error) { notify(error.message); }
    return;
  }
  const editReminder = event.target.closest('[data-reminder-edit]');
  if (editReminder) {
    try {
      const list = await api('/api/reminders');
      const item = (list.reminders || []).find(value => value.id === editReminder.dataset.reminderEdit);
      if (!item) throw new Error('Reminder not found.');
      const title = window.prompt('Reminder title update karo:', item.title);
      if (title === null) return;
      const localDate = new Date(item.dueAt); localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
      const dueAt = window.prompt('New due date/time (YYYY-MM-DDTHH:mm):', localDate.toISOString().slice(0,16));
      if (dueAt === null) return;
      await api(`/api/reminders/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ title, dueAt }) });
      await loadRemindersView(); await refreshReminderBadge(); notify('Reminder update ho gaya.');
    } catch (error) { notify(`Reminder update nahi hua: ${error.message}`); }
    return;
  }
  const completeReminder = event.target.closest('[data-reminder-complete]');
  if (completeReminder) {
    try { await api(`/api/reminders/${encodeURIComponent(completeReminder.dataset.reminderComplete)}`, { method: 'PATCH', body: JSON.stringify({ completed: true }) }); await loadRemindersView(); await refreshReminderBadge(); notify('Reminder complete mark ho gaya.'); }
    catch (error) { notify(error.message); }
    return;
  }
  const deleteReminder = event.target.closest('[data-reminder-delete]');
  if (deleteReminder) {
    if (!window.confirm('Kya yeh reminder delete karna hai?')) return;
    try { await api(`/api/reminders/${encodeURIComponent(deleteReminder.dataset.reminderDelete)}`, { method: 'DELETE', body: '{}' }); await loadRemindersView(); await refreshReminderBadge(); notify('Reminder delete ho gaya.'); }
    catch (error) { notify(error.message); }
    return;
  }
  const dismissAlert = event.target.closest('[data-alert-dismiss]');
  if (dismissAlert) {
    try { await api(`/api/alerts/${encodeURIComponent(dismissAlert.dataset.alertDismiss)}/dismiss`, { method: 'POST', body: '{}' }); await loadAlertsView(); notify('Alert dismiss ho gaya.'); }
    catch (error) { notify(error.message); }
    return;
  }
  const restoreInput = event.target.closest('#restoreWorkspaceFile');
  if (restoreInput) return;
  if (event.target.closest('#recordFilterUnused')) return;
  const recordFilter = event.target.closest('[data-record-filter]');
  if (recordFilter) { currentRecordsFilter = recordFilter.dataset.recordFilter || 'all'; renderView('records'); return; }
  const projectTab = event.target.closest('[data-project-tab]');
  if (projectTab && selectedProjectId) { renderProjectDetail(selectedProjectId, projectTab.dataset.projectTab); return; }
  const projectCard = event.target.closest('[data-project-id]');
  if (projectCard) { renderProjectDetail(projectCard.dataset.projectId); return; }
  const deleteDecisionButton = event.target.closest('[data-decision-delete]');
  if (deleteDecisionButton) {
    if (!authenticated) return lockWorkspaceLocally('Login required.');
    if (!selectedProjectId) return notify('Pehle project kholo.');
    const decisionId = deleteDecisionButton.dataset.decisionDelete;
    if (!window.confirm('Kya is decision ko is project se delete karna hai?')) return;
    deleteDecisionButton.disabled = true;
    try {
      const result = await api(`/api/projects/${selectedProjectId}/decisions/${encodeURIComponent(decisionId)}`, { method: 'DELETE' });
      updateProjectCache(result.project);
      notify('Decision delete ho gaya.');
      renderProjectDetail(selectedProjectId, 'decisions');
    } catch (error) {
      deleteDecisionButton.disabled = false;
      notify(`Decision delete nahi hua: ${error.message}`);
    }
    return;
  }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { if (!authenticated) return showAuth(authConfigured ? 'signin' : 'setup'); showDashboard(viewButton.dataset.view); return; }
  const projectAction = event.target.closest('[data-project-action]');
  if (projectAction) {
    if (!authenticated) return showAuth(authConfigured ? 'signin' : 'setup');
    if (projectAction.dataset.projectAction === 'new') {
      projectFormOpen = true;
      renderView('projects');
      $('#projectName')?.focus();
    } else if (projectAction.dataset.projectAction === 'cancel') {
      projectFormOpen = false;
      renderView('projects');
    }
    return;
  }
  const toastButton = event.target.closest('[data-toast]');
  if (toastButton) { notify(toastButton.dataset.toast); return; }
});

function renderAiProgressItems(root, kind, items) {
  const target = root.querySelector(kind === 'goal' ? '[data-ai-goals-list]' : '[data-ai-lessons-list]');
  if (!target) return;
  const label = kind === 'goal' ? 'goal' : 'lesson';
  target.innerHTML = items.length ? items.map((item, index) => `<div class="ai-progress-item"><span>${escapeHtml(item)}</span><button type="button" class="btn btn-danger btn-small" data-ai-remove-${label}="${index}" aria-label="Remove ${label}">Remove</button></div>`).join('') : `<p class="muted">Abhi koi ${kind === 'goal' ? 'learning goal' : 'completed lesson'} add nahi hua.</p>`;
}
function setAiProgress(root, progress) {
  const goals = Array.isArray(progress.goals) ? progress.goals : [];
  const lessons = Array.isArray(progress.completedLessons) ? progress.completedLessons : [];
  root.dataset.aiGoals = JSON.stringify(goals);
  root.dataset.aiLessons = JSON.stringify(lessons);
  renderAiProgressItems(root, 'goal', goals);
  renderAiProgressItems(root, 'lesson', lessons);
  const notes = root.querySelector('[data-ai-notes]'); if (notes) notes.value = progress.notes || '';
  const updated = root.querySelector('[data-ai-progress-updated]');
  if (updated) updated.textContent = progress.updatedAt ? `Last saved: ${new Date(progress.updatedAt).toLocaleString()}` : 'Abhi progress save nahi hui.';
}
function boundedAiMessages(messages) {
  const recent = messages.slice(-200);
  return recent[0]?.role === 'assistant' ? recent.slice(1) : recent;
}
function getAiProjectContext(projectId) {
  const project = demoProjects.find(item => item.id === projectId);
  if (!project) return '';
  const checklist = (project.checklist || []).slice(0, 20).map(item => `- [${item.done ? 'x' : ' '}] ${String(item.title || item.text || 'Untitled task').slice(0, 240)}`);
  return [
    'PROJECT CONTEXT (user ne is message ke liye share karne ko select kiya):',
    `Project: ${project.name} (${project.id})`,
    `Type: ${project.type || 'Not set'}`,
    `Goal: ${project.goal || 'Not set'}`,
    `Last completed task: ${project.lastCompletedTask || 'Not set'}`,
    `Next step: ${project.nextStep || 'Not set'}`,
    'Checklist:',
    checklist.length ? checklist.join('\n') : '- No checklist items saved',
    'Use this context only to provide guidance. Do not claim any project data was changed.'
  ].join('\n').slice(0, 7000);
}
async function loadAiLocalView(mode) {
  const root = $(`[data-ai-mode="${mode}"]`); if (!root) return;
  try {
    const [result, aiStatus] = await Promise.all([api(`/api/ai/${mode}/conversations`), api('/api/ai/status')]);
    root.dataset.aiEnabled = aiStatus.enabled ? 'true' : 'false';
    const statusLabel = root.querySelector('[data-ai-status]');
    const submitButton = root.querySelector('[data-ai-submit]');
    const note = root.querySelector('[data-ai-note]');
    if (statusLabel) statusLabel.textContent = aiStatus.enabled ? `OpenAI ready · ${aiStatus.model || 'configured model'} · paid usage` : 'Local history · OpenAI disabled';
    if (submitButton) submitButton.textContent = aiStatus.enabled ? 'Send to AI' : 'Save locally';
    if (note) note.textContent = aiStatus.enabled ? 'API usage par charges lag sakte hain. Message sirf Send to AI dabane par bheja jayega. Project context default OFF hai.' : 'Koi message OpenAI ko nahi bheja ja raha. History local computer par rehti hai.';
    const history = root.querySelector('[data-ai-history]');
    history.innerHTML = result.conversations.length ? result.conversations.map(item => `<div class="ai-history-row"><button type="button" class="ai-history-item" data-ai-open="${escapeHtml(item.id)}" data-ai-mode="${mode}">${escapeHtml(item.title)}<small>${escapeHtml(new Date(item.updatedAt).toLocaleString())}</small></button><button type="button" class="btn btn-danger btn-small" data-ai-delete="${escapeHtml(item.id)}" data-ai-mode="${mode}" aria-label="Delete conversation">Delete</button></div>`).join('') : '<p class="muted">Abhi koi saved conversation nahi.</p>';
    root.dataset.conversations = JSON.stringify(result.conversations);
    if (mode === 'teacher') {
      const p = await api('/api/ai/teacher/progress');
      setAiProgress(root, p.progress || {});
    }
  } catch (error) { notify(`AI local history load nahi hui: ${error.message}`); }
}
function aiConversationRoot(mode) { return $(`[data-ai-mode="${mode}"]`); }
function aiCurrentConversation(mode) {
  const root = aiConversationRoot(mode); if (!root) return null;
  try { return JSON.parse(root.dataset.conversations || '[]')[0] || null; } catch { return null; }
}
document.addEventListener('click', async event => {
  const retryButton = event.target.closest('[data-ai-retry]');
  if (retryButton) {
    const mode = retryButton.dataset.aiMode, root = aiConversationRoot(mode);
    const conversations = JSON.parse(root?.dataset.conversations || '[]');
    const conversation = conversations.find(item => item.id === retryButton.dataset.aiRetry);
    if (!root || !conversation) return notify('Conversation dobara load nahi hui. History refresh karke koshish karo.');
    retryButton.disabled = true; retryButton.textContent = 'Retrying…';
    try {
      const answer = await api(`/api/ai/${mode}/respond`, { method: 'POST', body: JSON.stringify({ messages: conversation.messages.map(item => ({ role: item.role, content: item.content })) }) });
      conversation.messages.push({ role: 'assistant', content: answer.message, createdAt: new Date().toISOString() });
      const saved = await api(`/api/ai/${mode}/conversations`, { method: 'POST', body: JSON.stringify({ id: conversation.id, title: conversation.title, messages: boundedAiMessages(conversation.messages) }) });
      root.dataset.activeId = saved.conversation.id;
      await loadAiLocalView(mode);
      root.querySelector('[data-ai-messages]').innerHTML = saved.conversation.messages.map(m => `<div class="ai-bubble ${m.role}"><b>${m.role === 'user' ? 'You' : (mode === 'teacher' ? 'AI Teacher' : 'AI Chatbot')}</b><p>${escapeHtml(m.content)}</p></div>`).join('');
      notify('Retry successful. AI jawab local history mein save ho gaya.');
    } catch (error) {
      retryButton.disabled = false; retryButton.textContent = 'Retry AI (project context dobara share nahi hoga)';
      notify(`Retry nahi hua: ${error.message}`);
    }
    return;
  }
  const newButton = event.target.closest('[data-ai-new]');
  if (newButton) { const root = aiConversationRoot(newButton.dataset.aiNew); if (root) { root.dataset.activeId = ''; root.querySelector('[data-ai-messages]').innerHTML = ''; root.querySelector('.ai-welcome').classList.remove('hidden'); } return; }
  const openButton = event.target.closest('[data-ai-open]');
  if (openButton) { const mode = openButton.dataset.aiMode, root = aiConversationRoot(mode); if (!root) return; const list = JSON.parse(root.dataset.conversations || '[]'); const item = list.find(x => x.id === openButton.dataset.aiOpen); if (!item) return; root.dataset.activeId = item.id; root.querySelector('.ai-welcome').classList.add('hidden'); root.querySelector('[data-ai-messages]').innerHTML = item.messages.map(m => `<div class="ai-bubble ${m.role}"><b>${m.role === 'user' ? 'You' : (mode === 'teacher' ? 'AI Teacher' : 'AI Chatbot')}</b><p>${escapeHtml(m.content)}</p></div>`).join(''); return; }
  const deleteButton = event.target.closest('[data-ai-delete]');
  if (deleteButton) {
    const mode = deleteButton.dataset.aiMode, root = aiConversationRoot(mode), id = deleteButton.dataset.aiDelete;
    if (!root || !window.confirm('Kya is saved conversation ko local history se delete karna hai?')) return;
    deleteButton.disabled = true;
    try {
      await api(`/api/ai/${mode}/conversations`, { method: 'DELETE', body: JSON.stringify({ id }) });
      if (root.dataset.activeId === id) { root.dataset.activeId = ''; root.querySelector('[data-ai-messages]').innerHTML = ''; root.querySelector('.ai-welcome').classList.remove('hidden'); }
      await loadAiLocalView(mode); notify('Conversation local history se delete ho gayi.');
    } catch (error) { deleteButton.disabled = false; notify(`Conversation delete nahi hui: ${error.message}`); }
    return;
  }
  const addGoal = event.target.closest('[data-ai-add-goal]');
  const addLesson = event.target.closest('[data-ai-add-lesson]');
  if (addGoal || addLesson) {
    const root = aiConversationRoot('teacher');
    const kind = addGoal ? 'goal' : 'lesson';
    const input = root.querySelector(kind === 'goal' ? '[data-ai-new-goal]' : '[data-ai-new-lesson]');
    const value = input.value.trim(); if (!value) return notify('Pehle text likho.');
    const key = kind === 'goal' ? 'aiGoals' : 'aiLessons';
    const items = JSON.parse(root.dataset[key] || '[]');
    const limit = kind === 'goal' ? 30 : 100;
    if (items.length >= limit) return notify(`Maximum ${limit} ${kind === 'goal' ? 'goals' : 'lessons'} allowed hain.`);
    items.push(value.slice(0, 300)); root.dataset[key] = JSON.stringify(items); input.value = '';
    renderAiProgressItems(root, kind, items); return;
  }
  const removeGoal = event.target.closest('[data-ai-remove-goal]');
  const removeLesson = event.target.closest('[data-ai-remove-lesson]');
  if (removeGoal || removeLesson) {
    const root = aiConversationRoot('teacher'), kind = removeGoal ? 'goal' : 'lesson';
    const key = kind === 'goal' ? 'aiGoals' : 'aiLessons';
    const items = JSON.parse(root.dataset[key] || '[]');
    items.splice(Number((removeGoal || removeLesson).dataset[ `aiRemove${kind === 'goal' ? 'Goal' : 'Lesson'}` ]), 1);
    root.dataset[key] = JSON.stringify(items); renderAiProgressItems(root, kind, items); return;
  }
  if (event.target.closest('[data-ai-save-progress]')) {
    const root = aiConversationRoot('teacher');
    try {
      const progress = await api('/api/ai/teacher/progress', { method: 'PUT', body: JSON.stringify({ goals: JSON.parse(root.dataset.aiGoals || '[]'), completedLessons: JSON.parse(root.dataset.aiLessons || '[]'), notes: root.querySelector('[data-ai-notes]').value }) });
      setAiProgress(root, progress.progress); notify('Learning goals, completed lessons aur notes local computer par save ho gaye.');
    } catch (error) { notify(error.message); }
  }
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-ai-form]'); if (!form) return;
  event.preventDefault();
  const mode = form.dataset.aiForm, root = aiConversationRoot(mode), input = form.elements.message;
  const content = input.value.trim(); if (!content) return;
  const submitButton = form.querySelector('[data-ai-submit]');
  const originalSubmitLabel = submitButton?.textContent || '';
  if (submitButton) { submitButton.disabled = true; if (root.dataset.aiEnabled === 'true') submitButton.textContent = 'Sending…'; }
  const list = root.querySelector('[data-ai-messages]');
  const activeId = root.dataset.activeId || '';
  const conversation = activeId ? (JSON.parse(root.dataset.conversations || '[]').find(x => x.id === activeId)) : null;
  const messages = conversation ? [...conversation.messages] : [];
  let projectContext = '';
  if (root.dataset.aiEnabled === 'true' && form.querySelector('[data-ai-attach-project]')?.checked) {
    const projectId = form.querySelector('[data-ai-project-select]')?.value || '';
    projectContext = getAiProjectContext(projectId);
    if (!projectContext) { if (submitButton) submitButton.disabled = false; return notify('Project context bhejne ke liye pehle project select karo.'); }
  }
  messages.push({ role: 'user', content, createdAt: new Date().toISOString() });
  let savedConversation;
  try {
    const saved = await api(`/api/ai/${mode}/conversations`, { method: 'POST', body: JSON.stringify({ id: activeId, title: content.slice(0, 70), messages: boundedAiMessages(messages) }) });
    savedConversation = saved.conversation;
    root.dataset.activeId = savedConversation.id;
    input.value = '';
    root.querySelector('.ai-welcome').classList.add('hidden');
    if (root.dataset.aiEnabled === 'true') {
      try {
        const contextCheckbox = form.querySelector('[data-ai-attach-project]');
        if (contextCheckbox) contextCheckbox.checked = false;
        const answer = await api(`/api/ai/${mode}/respond`, { method: 'POST', body: JSON.stringify({ messages: savedConversation.messages.map(item => ({ role: item.role, content: item.content })), ...(projectContext ? { projectContext } : {}) }) });
        savedConversation.messages.push({ role: 'assistant', content: answer.message, createdAt: new Date().toISOString() });
        const finalSave = await api(`/api/ai/${mode}/conversations`, { method: 'POST', body: JSON.stringify({ id: savedConversation.id, title: savedConversation.title, messages: boundedAiMessages(savedConversation.messages) }) });
        savedConversation = finalSave.conversation;
        notify('AI ka jawab aa gaya aur conversation local history mein save ho gayi.');
      } catch (error) {
        list.innerHTML = savedConversation.messages.map(m => `<div class="ai-bubble ${m.role}"><b>${m.role === 'user' ? 'You' : (mode === 'teacher' ? 'AI Teacher' : 'AI Chatbot')}</b><p>${escapeHtml(m.content)}</p></div>`).join('') + `<button type="button" class="btn btn-outline btn-small" data-ai-retry="${escapeHtml(savedConversation.id)}" data-ai-mode="${mode}">Retry AI (project context dobara share nahi hoga)</button>`;
        notify(`Message local save ho gaya, lekin AI jawab nahi mila: ${error.message}. Retry button se dobara koshish kar sakte ho.`);
      }
    } else {
      notify('Message local history mein save ho gaya. OpenAI abhi disabled hai.');
    }
    list.innerHTML = savedConversation.messages.map(m => `<div class="ai-bubble ${m.role}"><b>${m.role === 'user' ? 'You' : (mode === 'teacher' ? 'AI Teacher' : 'AI Chatbot')}</b><p>${escapeHtml(m.content)}</p></div>`).join('');
    if (root.dataset.aiEnabled !== 'true') list.innerHTML += '<div class="ai-local-placeholder">Message local history mein save ho gaya. OpenAI requests abhi disabled hain.</div>';
    await loadAiLocalView(mode);
  } catch (error) {
    notify(`Message save nahi hua: ${error.message}`);
  } finally {
    if (submitButton && form.isConnected) { submitButton.disabled = false; submitButton.textContent = originalSubmitLabel; }
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'authForm') return handleAuthSubmit(event);
  if (form.id === 'importantForm') {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries());
    try { await api('/api/important', { method: 'POST', body: JSON.stringify(values) }); form.reset(); await loadImportantView(); notify('Important item save ho gaya.'); }
    catch (error) { notify(`Important item save nahi hua: ${error.message}`); }
    return;
  }
  if (form.id === 'reminderForm') {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api('/api/reminders', { method: 'POST', body: JSON.stringify(values) });
      notify(`Reminder save ho gaya: ${result.reminder.title}`);
      form.reset(); await loadRemindersView(); await refreshReminderBadge();
    } catch (error) { notify(`Reminder save nahi hua: ${error.message}`); }
    return;
  }
  if (form.id === 'createProjectForm') {
    event.preventDefault();
    if (!authenticated) return lockWorkspaceLocally('Login required.');
    const values = Object.fromEntries(new FormData(form).entries());
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await api('/api/projects', { method: 'POST', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      projectFormOpen = false;
      selectedProjectId = result.project.id;
      selectedProjectTab = 'overview';
      notify(`Project ${result.project.id} successfully save ho gaya.`);
      await renderProjectDetail(result.project.id, 'overview');
    } catch (error) {
      notify(`Project save nahi hua: ${error.message}`);
    } finally {
      if (submitButton && submitButton.isConnected) submitButton.disabled = false;
    }
    return;
  }
  if (!['memoryForm', 'addTaskForm', 'addDecisionForm', 'editDecisionForm', 'addSessionForm'].includes(form.id)) return;
  if (!authenticated) { event.preventDefault(); return lockWorkspaceLocally('Login required.'); }
  event.preventDefault();
  if (!selectedProjectId) return notify('Pehle project kholo.');
  const values = Object.fromEntries(new FormData(form).entries());
  try {
    let result;
    if (form.id === 'memoryForm') {
      result = await api(`/api/projects/${selectedProjectId}/memory`, { method: 'PUT', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Project memory save ho gayi.');
      return renderProjectDetail(selectedProjectId, 'memory');
    }
    if (form.id === 'addTaskForm') {
      result = await api(`/api/projects/${selectedProjectId}/checklist`, { method: 'POST', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Naya task save ho gaya.');
      return renderProjectDetail(selectedProjectId, 'checklist');
    }
    if (form.id === 'addDecisionForm') {
      result = await api(`/api/projects/${selectedProjectId}/decisions`, { method: 'POST', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Decision save ho gaya.');
      return renderProjectDetail(selectedProjectId, 'decisions');
    }
    if (form.id === 'editDecisionForm') {
      const decisionId = values.decisionId;
      delete values.decisionId;
      result = await api(`/api/projects/${selectedProjectId}/decisions/${encodeURIComponent(decisionId)}`, { method: 'PATCH', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Decision update ho gaya.');
      return renderProjectDetail(selectedProjectId, 'decisions');
    }
    if (form.id === 'addSessionForm') {
      result = await api(`/api/projects/${selectedProjectId}/sessions`, { method: 'POST', body: JSON.stringify(values) });
      updateProjectCache(result.project);
      notify('Session record save ho gaya.');
      return renderProjectDetail(selectedProjectId, 'history');
    }
  } catch (error) {
    notify(`Save nahi hua: ${error.message}`);
  }
});

async function refreshReminderBadge() {
  try {
    const [alertsResult, remindersResult] = await Promise.all([api('/api/alerts'), api('/api/reminders')]);
    const navCount = $('.alert-count'); if (navCount) { navCount.textContent = String((alertsResult.alerts || []).length); navCount.classList.toggle('hidden', !(alertsResult.alerts || []).length); }
    const homeCount = $('#homeReminderCount');
    if (homeCount) {
      const openCount = (remindersResult.reminders || []).filter(item => !item.completedAt).length;
      homeCount.textContent = String(openCount);
      const foot = $('#homeReminderFoot'); if (foot) foot.firstChild.textContent = `${openCount} open · `;
    }
  } catch { /* no-op */ }
}

document.addEventListener('change', async (event) => {
  const restoreFile = event.target.closest('#restoreWorkspaceFile');
  if (restoreFile && restoreFile.files?.[0]) {
    const file = restoreFile.files[0];
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Backup 5 MB se bara hai.');
      const backup = JSON.parse(await file.text());
      const phrase = window.prompt('Restore current workspace ko replace karega. Pehle automatic safety backup banega. Confirm karne ke liye exact phrase likhein: RESTORE WORKSPACE');
      if (phrase !== 'RESTORE WORKSPACE') { notify('Restore cancel kar diya. Current data change nahi hua.'); return; }
      const result = await api('/api/backup/restore', { method: 'POST', body: JSON.stringify({ confirmation: phrase, backup }) });
      await loadProjects(); await refreshReminderBadge(); renderView('settings');
      notify(`Restore complete. Safety backup: ${result.backupCreated}`);
    } catch (error) { notify(`Restore nahi hua: ${error.message}`); }
    finally { restoreFile.value = ''; }
    return;
  }
  const checkbox = event.target.closest('[data-task-id]');
  if (!checkbox || !selectedProjectId) return;
  try {
    const result = await api(`/api/projects/${selectedProjectId}/checklist/${encodeURIComponent(checkbox.dataset.taskId)}`, {
      method: 'PATCH', body: JSON.stringify({ done: checkbox.checked })
    });
    updateProjectCache(result.project);
    notify('Checklist update save ho gayi.');
    renderProjectDetail(selectedProjectId, 'checklist');
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    notify(`Checklist save nahi hui: ${error.message}`);
  }
});

document.addEventListener('keydown', (event) => {
  if (authenticated) pingActivity();
  const projectCard = event.target.closest('[data-project-id]');
  if (projectCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    renderProjectDetail(projectCard.dataset.projectId);
  }
});

$('#logoutButton').addEventListener('click', () => { void lockWorkspace('You have been logged out.'); });
$('#dismissNotice').addEventListener('click', () => $('.preview-notice').classList.add('hidden'));
$('#collapseSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('collapsed'));
$('#mobileSidebarToggle').addEventListener('click', () => $('#sidebar').classList.toggle('mobile-open'));
$('#mobileMenuBtn').addEventListener('click', () => showAuth(authConfigured ? 'signin' : 'setup'));
$('#topHelp').addEventListener('click', () => notify('Local owner workspace. Monitoring starts only after your explicit Start action.'));

for (const eventName of ['pointerdown', 'keydown', 'touchstart']) {
  document.addEventListener(eventName, () => { if (authenticated) pingActivity(); }, { passive: true });
}

async function initializeOwnerWorkspace() {
  showLanding('Checking local owner setup…');
  try {
    const recovery = new URLSearchParams(window.location.hash.slice(1));
    if (recovery.get('type') === 'recovery' && recovery.get('access_token') && recovery.get('refresh_token')) {
      await api('/api/cloud-auth/recovery-session', { method: 'POST', body: JSON.stringify({ access_token: recovery.get('access_token'), refresh_token: recovery.get('refresh_token'), expires_in: recovery.get('expires_in') }) });
      window.history.replaceState({}, '', '/');
      showAuth('cloud-recovery');
      return;
    }
    const status = await api('/api/auth/status');
    authConfigured = status.configured === true; cloudConfigured = status.cloudConfigured === true;
    if (status.localAuthenticated) {
      cloudAccountEmail = status.cloudUser?.email || '';
      // Only the Local Owner session unlocks this computer's local workspace.
      // A Supabase session alone must never bypass local owner isolation.
      authenticated = true; cloudAuthenticated = status.cloudAuthenticated === true; currentOwnerName = status.username || 'Owner';
      await loadProjects();
      if ($('#profileUsername')) $('#profileUsername').textContent = currentOwnerName;
      if ($('#topAvatar')) $('#topAvatar').textContent = currentOwnerName.slice(0, 1).toUpperCase();
      showDashboard('home'); startGlobalMonitorIndicator(); startIdleLock();
      return;
    }
    if (status.cloudAuthenticated) { cloudAccountEmail = status.cloudUser?.email || ''; showAuth(authConfigured ? 'signin' : 'setup', `Cloud account ${status.cloudUser?.email || ''} signed in hai, lekin local workspace ke liye Local Owner account setup/login zaroori hai.`); }
    else showLanding();
  } catch (error) {
    showLanding(`Local authentication service could not be checked: ${error.message}`);
  }
}

if (new URLSearchParams(window.location.search).get('cloud-login') === 'success') { window.history.replaceState({}, '', '/'); }
void initializeOwnerWorkspace();
console.info("Biillliiii's Inspector v11.0.1 loaded. Local owner or Supabase authentication is required before project data is loaded.");

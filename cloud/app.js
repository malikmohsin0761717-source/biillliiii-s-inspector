'use strict';

const $ = (selector) => document.querySelector(selector);
let signupMode = false;
let currentUser = null;

async function api(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) headers['X-Requested-With'] = 'BiillliiiiInspector';
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw Object.assign(new Error(payload.error || `Request failed (${response.status}).`), { status: response.status });
  return payload;
}

function message(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? '#ffb9bd' : '#b9d8ff';
}

function showSignedIn(user) {
  currentUser = user;
  $('#authPanel').classList.add('hidden');
  $('#workspacePanel').classList.remove('hidden');
  $('#accountEmail').textContent = user?.email || 'Signed in';
  void loadDocuments();
}

function showSignedOut() {
  currentUser = null;
  $('#workspacePanel').classList.add('hidden');
  $('#authPanel').classList.remove('hidden');
}

function setAuthMode(signup) {
  signupMode = signup;
  $('#authTitle').textContent = signup ? 'Create cloud account' : 'Cloud sign in';
  $('#authSubmit').textContent = signup ? 'Create account' : 'Log in';
  $('#password').autocomplete = signup ? 'new-password' : 'current-password';
  $('#toggleAuth').textContent = signup ? 'Back to cloud login' : 'Create a cloud account';
  $('#forgotPassword').classList.toggle('hidden', signup);
  $('#authMessage').textContent = '';
}

async function loadDocuments() {
  const list = $('#documentsList');
  list.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Loading documents…' }));
  try {
    const type = $('#documentType').value;
    const result = await api(`/api/cloud-documents?type=${encodeURIComponent(type)}`);
    list.replaceChildren();
    if (!result.documents.length) {
      list.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Is type ka koi cloud document abhi save nahi.' }));
      return;
    }
    for (const doc of result.documents) {
      const card = document.createElement('article'); card.className = 'item';
      const top = document.createElement('div'); top.className = 'item-top';
      const title = document.createElement('b'); title.textContent = doc.document_key;
      const del = document.createElement('button'); del.className = 'delete'; del.type = 'button'; del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!window.confirm(`Cloud document "${doc.document_key}" delete karna hai? Yeh action sirf cloud copy par hoga.`)) return;
        del.disabled = true;
        try {
          const query = new URLSearchParams({ type: doc.document_type, key: doc.document_key });
          await api(`/api/cloud-documents?${query}`, { method: 'DELETE' });
          await loadDocuments();
          message($('#documentMessage'), 'Cloud document delete ho gaya.');
        } catch (error) { message($('#documentMessage'), error.message, true); del.disabled = false; }
      });
      top.append(title, del);
      const date = document.createElement('small'); date.textContent = `Updated: ${doc.updated_at ? new Date(doc.updated_at).toLocaleString() : 'unknown'}`;
      const pre = document.createElement('pre'); pre.textContent = JSON.stringify(doc.payload, null, 2);
      card.append(top, date, pre); list.append(card);
    }
  } catch (error) {
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: error.message }));
    if (error.status === 401) showSignedOut();
  }
}

async function loadProjects() {
  const list = $('#projectsList');
  list.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Loading projects…' }));
  try {
    const result = await api('/api/cloud-auth/projects');
    list.replaceChildren();
    if (!result.projects.length) {
      list.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Is cloud account mein abhi koi project nahi.' }));
      return;
    }
    for (const project of result.projects) {
      const card = document.createElement('article'); card.className = 'item';
      const name = document.createElement('b'); name.textContent = project.name || 'Untitled project';
      const meta = document.createElement('small'); meta.textContent = `${project.projectCode} · ${project.status}`;
      card.append(name, document.createElement('br'), meta); list.append(card);
    }
  } catch (error) {
    list.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: error.message }));
    if (error.status === 401) showSignedOut();
  }
}

$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#authSubmit'); button.disabled = true;
  message($('#authMessage'), signupMode ? 'Account create ho raha hai…' : 'Login check ho raha hai…');
  try {
    const result = await api(signupMode ? '/api/cloud-auth/signup' : '/api/cloud-auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#email').value.trim(), password: $('#password').value })
    });
    if (signupMode && result.confirmationRequired) {
      message($('#authMessage'), 'Confirmation email bhej di gayi hai. Inbox verify karke phir login karein.');
    } else {
      const status = await api('/api/cloud-auth/status');
      if (status.authenticated) showSignedIn(status.user);
    }
  } catch (error) { message($('#authMessage'), error.message, true); }
  finally { button.disabled = false; }
});

$('#toggleAuth').addEventListener('click', () => setAuthMode(!signupMode));
$('#forgotPassword').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  if (!email) return message($('#authMessage'), 'Pehle email address likhein.', true);
  try {
    await api('/api/cloud-auth/recover', { method: 'POST', body: JSON.stringify({ email }) });
    message($('#authMessage'), 'Agar account mojood hai to password reset email bhej di gayi hai.');
  } catch (error) { message($('#authMessage'), error.message, true); }
});
$('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/cloud-auth/logout', { method: 'POST', body: '{}' }); } catch { /* Local screen still locks on logout attempt. */ }
  showSignedOut();
  setAuthMode(false);
});
$('#documentType').addEventListener('change', () => void loadDocuments());
$('#refreshDocuments').addEventListener('click', () => void loadDocuments());
$('#refreshProjects').addEventListener('click', () => void loadProjects());
$('#saveDocument').addEventListener('click', async () => {
  const button = $('#saveDocument'); button.disabled = true;
  try {
    const payload = JSON.parse($('#documentPayload').value || '{}');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JSON payload aik object hona chahiye.');
    const result = await api('/api/cloud-documents', {
      method: 'POST',
      body: JSON.stringify({ documentType: $('#documentType').value, documentKey: $('#documentKey').value.trim(), payload })
    });
    message($('#documentMessage'), result.document ? 'Document Supabase mein save ho gaya.' : 'Save request complete hui.');
    await loadDocuments();
  } catch (error) { message($('#documentMessage'), error.message, true); }
  finally { button.disabled = false; }
});

async function initialize() {
  try {
    const status = await api('/api/cloud-auth/status');
    if (status.authenticated) showSignedIn(status.user);
    else showSignedOut();
  } catch (error) {
    showSignedOut();
    message($('#authMessage'), error.message, true);
  }
}

void initialize();

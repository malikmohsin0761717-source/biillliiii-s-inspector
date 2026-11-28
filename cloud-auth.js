'use strict';

const crypto = require('node:crypto');

const COOKIE = 'biilli_cloud_session';
const OAUTH_COOKIE = 'biilli_oauth_flow';
const sessions = new Map();
const flows = new Map();

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '');
  return { configured: Boolean(url && key), url, key };
}
function b64url(value) { return Buffer.from(value).toString('base64url'); }
function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString('base64url'); }
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}
function setCookie(res, name, value, maxAge, sameSite = 'Strict') {
  const existing = res.getHeader('Set-Cookie');
  const item = `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), item] : item);
}
function clearCookie(res, name) { setCookie(res, name, '', 0); }
function currentSession(req) {
  const token = parseCookies(req)[COOKIE];
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return { ...session, cookieToken: token };
}
async function request(path, options = {}) {
  const c = config();
  if (!c.configured) throw Object.assign(new Error('Supabase configure nahi hai. .env file mein SUPABASE_URL aur SUPABASE_PUBLISHABLE_KEY set karein.'), { status: 503 });
  const response = await fetch(`${c.url}${path}`, {
    ...options,
    headers: { apikey: c.key, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.msg || body.message || body.error_description || body.error || 'Supabase request failed.'), { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
  return body;
}
function saveSession(res, payload) {
  const token = randomToken();
  const expiresIn = Math.max(60, Number(payload.expires_in || 3600));
  sessions.set(token, {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshAt: Date.now() + Math.max(30, expiresIn - 60) * 1000,
    user: { id: payload.user?.id, email: payload.user?.email || '' }
  });
  setCookie(res, COOKIE, token, 60 * 60 * 24 * 7);
  return sessions.get(token).user;
}
async function getFreshSession(req) {
  const token = parseCookies(req)[COOKIE];
  const stored = token && sessions.get(token);
  if (!stored) return null;
  const session = { ...stored, cookieToken: token };
  if (session.refreshAt <= Date.now() + 15_000 || session.expiresAt <= Date.now()) {
    const refreshed = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refreshToken }) });
    sessions.set(token, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + Math.max(60, Number(refreshed.expires_in || 3600)) * 1000,
      refreshAt: Date.now() + Math.max(30, Number(refreshed.expires_in || 3600) - 60) * 1000,
      user: { id: refreshed.user?.id || session.user.id, email: refreshed.user?.email || session.user.email }
    });
  }
  return sessions.get(session.cookieToken);
}
async function logout(req, res) {
  const token = parseCookies(req)[COOKIE];
  const session = await getFreshSession(req).catch(() => null);
  if (session) await request('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` } }).catch(() => {});
  if (token) sessions.delete(token);
  clearCookie(res, COOKIE);
}

async function handle(req, res, url, readBody, json) {
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/cloud-auth/status') {
    const session = currentSession(req);
    return json(res, 200, { configured: config().configured, authenticated: Boolean(session), user: session?.user || null, provider: 'supabase' });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/signup') {
    const body = await readBody(req);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return json(res, 400, { error: 'Valid email aur kam az kam 12 characters ka password dein.' });
    const result = await request('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, options: { emailRedirectTo: `${url.origin}/` } }) });
    if (result.access_token) saveSession(res, result);
    return json(res, 201, { created: true, authenticated: Boolean(result.access_token), confirmationRequired: !result.access_token, message: result.access_token ? 'Cloud account create ho gaya.' : 'Email confirmation link bhej diya gaya hai.' });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/login') {
    const body = await readBody(req);
    const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: String(body.email || '').trim(), password: String(body.password || '') }) });
    const user = saveSession(res, result);
    return json(res, 200, { authenticated: true, user });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/recovery-session') {
    const body = await readBody(req);
    const accessToken = String(body.access_token || '');
    const refreshToken = String(body.refresh_token || '');
    if (!accessToken || !refreshToken) return json(res, 400, { error: 'Recovery link incomplete hai.' });
    const user = await request('/auth/v1/user', { headers: { Authorization: `Bearer ${accessToken}` } });
    const sessionUser = saveSession(res, { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(body.expires_in || 3600), user });
    return json(res, 200, { authenticated: true, user: sessionUser });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/update-password') {
    const session = await getFreshSession(req);
    if (!session) return json(res, 401, { error: 'Password reset session expire ho gayi. Reset email dobara mangwayein.' });
    const body = await readBody(req);
    const password = String(body.password || '');
    if (password.length < 12) return json(res, 400, { error: 'Naya password kam az kam 12 characters ka hona chahiye.' });
    await request('/auth/v1/user', { method: 'PUT', headers: { Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ password }) });
    return json(res, 200, { updated: true, message: 'Cloud password update ho gaya.' });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/recover') {
    const body = await readBody(req);
    const email = String(body.email || '').trim();
    await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${url.origin}/`)}`, { method: 'POST', body: JSON.stringify({ email }) });
    return json(res, 200, { sent: true, message: 'Agar email account mojood hai to password reset email bhej di gayi hai.' });
  }
  if (req.method === 'POST' && p === '/api/cloud-auth/logout') {
    await logout(req, res);
    return json(res, 200, { loggedOut: true });
  }
  if (req.method === 'GET' && p === '/api/cloud-auth/google') {
    const c = config();
    if (!c.configured) return json(res, 503, { error: 'Pehle Supabase configuration set karein.' });
    const verifier = randomToken(48);
    const state = randomToken(24);
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const flowToken = randomToken();
    flows.set(flowToken, { verifier, state, createdAt: Date.now() });
    setCookie(res, OAUTH_COOKIE, flowToken, 600, 'Lax');
    const redirect = `${url.origin}/api/cloud-auth/callback`;
    const target = `${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256&state=${encodeURIComponent(state)}`;
    res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' }); res.end(); return;
  }
  if (req.method === 'GET' && p === '/api/cloud-auth/callback') {
    const cookies = parseCookies(req);
    const flow = flows.get(cookies[OAUTH_COOKIE]);
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!flow || flow.createdAt < Date.now() - 10 * 60 * 1000 || !state || state !== flow.state || !code) return json(res, 400, { error: 'Google login state invalid ya expire ho gaya. Dobara try karein.' });
    flows.delete(cookies[OAUTH_COOKIE]); clearCookie(res, OAUTH_COOKIE);
    const result = await request('/auth/v1/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: flow.verifier }) });
    saveSession(res, result);
    res.writeHead(302, { Location: '/?cloud-login=success', 'Cache-Control': 'no-store' }); res.end(); return;
  }
  if (req.method === 'GET' && p === '/api/cloud-auth/projects') {
    const session = await getFreshSession(req);
    if (!session) return json(res, 401, { error: 'Cloud account login required.' });
    const projects = await request('/rest/v1/projects?select=project_code,name,status,payload&order=project_code.asc', {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    });
    if (!Array.isArray(projects)) return json(res, 502, { error: 'Supabase project list response invalid hai.' });
    return json(res, 200, { projects: projects.map(row => ({ projectCode: String(row.project_code || ''), name: String(row.name || ''), status: String(row.status || ''), payload: row.payload && typeof row.payload === 'object' ? row.payload : null })) });
  }

  if (req.method === 'POST' && p === '/api/cloud-auth/sync') {
    const session = await getFreshSession(req);
    if (!session) return json(res, 401, { error: 'Cloud account login required.' });
    const body = await readBody(req);
    if (!Array.isArray(body.projects) || body.projects.length > 1000) return json(res, 400, { error: 'Projects payload invalid hai.' });
    const rows = body.projects.map(project => ({
      project_code: String(project.id || '').slice(0, 64),
      name: String(project.name || '').slice(0, 120),
      status: String(project.status || 'Planning').slice(0, 24),
      payload: project
    }));
    if (rows.some(row => !row.project_code)) return json(res, 400, { error: 'Har project ka ID zaroori hai.' });
    if (rows.length) {
      await request('/rest/v1/projects?on_conflict=owner_id,project_code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows)
      });
    }
    return json(res, 200, { synced: rows.length, mode: 'manual-upsert', message: 'Cloud sync mukammal. Local files delete ya overwrite nahi ki gayin.' });
  }
  return json(res, 404, { error: 'Cloud authentication endpoint not found.' });
}

module.exports = { handle, currentSession, getFreshSession, config, logout, COOKIE };

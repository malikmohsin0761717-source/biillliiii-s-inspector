'use strict';

const crypto = require('node:crypto');

const SESSION_COOKIE = 'biilli_cloud_session';
const OAUTH_COOKIE = 'biilli_cloud_oauth';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const MAX_BODY_BYTES = 1024 * 1024;

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '');
  return { configured: Boolean(url && key), url, key };
}

function encryptionKey() {
  const secret = String(process.env.BI_CLOUD_SESSION_SECRET || '');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw Object.assign(new Error('BI_CLOUD_SESSION_SECRET must contain at least 32 bytes.'), { status: 503 });
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

function unseal(value) {
  try {
    const raw = Buffer.from(String(value || ''), 'base64url');
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const clear = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
    return JSON.parse(clear);
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    try { result[name] = decodeURIComponent(raw); } catch { result[name] = raw; }
  }
  return result;
}

function setCookie(res, name, value, maxAge, sameSite = 'Lax') {
  const current = res.getHeader('Set-Cookie');
  const item = `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', current ? [...(Array.isArray(current) ? current : [current]), item] : item);
}

function clearCookie(res, name, sameSite = 'Lax') {
  setCookie(res, name, '', 0, sameSite);
}

function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function assertSameOrigin(req, allowOAuthCallback = false) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  if (allowOAuthCallback) return;
  const origin = req.headers.origin;
  if (origin && origin !== requestOrigin(req)) throw Object.assign(new Error('Cross-origin request blocked.'), { status: 403 });
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    throw Object.assign(new Error('Cross-site request blocked.'), { status: 403 });
  }
  if (req.headers['x-requested-with'] !== 'BiillliiiiInspector') {
    throw Object.assign(new Error('Same-origin request header is required.'), { status: 403 });
  }
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.end(JSON.stringify(value));
}

async function supabaseRequest(path, options = {}) {
  const c = config();
  if (!c.configured) throw Object.assign(new Error('Supabase environment is not configured.'), { status: 503 });
  const response = await fetch(`${c.url}${path}`, {
    ...options,
    headers: { apikey: c.key, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.msg || body.message || body.error_description || body.error || 'Supabase request failed.';
    throw Object.assign(new Error(String(message).slice(0, 240)), { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
  }
  return body;
}

function sessionFromAuth(payload) {
  const expiresIn = Math.max(60, Math.min(Number(payload.expires_in || 3600), SESSION_MAX_AGE));
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    user: { id: payload.user?.id || null, email: payload.user?.email || '' }
  };
}

function saveSession(res, payload) {
  if (!payload.access_token || !payload.refresh_token) throw Object.assign(new Error('Supabase did not return a complete session.'), { status: 502 });
  const session = sessionFromAuth(payload);
  setCookie(res, SESSION_COOKIE, seal(session), SESSION_MAX_AGE, 'Lax');
  return session.user;
}

async function getSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  let session = token ? unseal(token) : null;
  if (!session || !session.accessToken || !session.refreshToken || !Number.isFinite(session.expiresAt)) return null;

  if (session.expiresAt <= Date.now() + 60_000) {
    try {
      const refreshed = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refreshToken })
      });
      session = sessionFromAuth(refreshed);
      setCookie(res, SESSION_COOKIE, seal(session), SESSION_MAX_AGE, 'Lax');
    } catch {
      clearCookie(res, SESSION_COOKIE);
      return null;
    }
  }

  try {
    const user = await supabaseRequest('/auth/v1/user', {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    });
    session.user = { id: user.id, email: user.email || '' };
    return session;
  } catch {
    clearCookie(res, SESSION_COOKIE);
    return null;
  }
}

function requireSession(session) {
  if (!session?.user?.id || !session.accessToken) throw Object.assign(new Error('Cloud account login required.'), { status: 401 });
  return session;
}

module.exports = {
  SESSION_COOKIE, OAUTH_COOKIE, SESSION_MAX_AGE, config, encryptionKey, seal, unseal,
  parseCookies, setCookie, clearCookie, requestOrigin, assertSameOrigin, readBody,
  sendJson, supabaseRequest, saveSession, getSession, requireSession
};

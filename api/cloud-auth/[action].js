'use strict';

const {
  OAUTH_COOKIE, SESSION_COOKIE, config, seal, unseal, parseCookies,
  setCookie, clearCookie, assertSameOrigin, readBody, sendJson,
  supabaseRequest, saveSession, getSession, requireSession
} = require('../_lib/cloud-session');

function actionName(req) {
  if (req.query && typeof req.query.action === 'string') return req.query.action;
  const match = String(req.url || '').split('?')[0].match(/\/api\/cloud-auth\/([^/]+)\/?$/);
  return match ? match[1] : '';
}

function validEmail(email) { return /^\S+@\S+\.\S+$/.test(email); }

module.exports = async function cloudAuthHandler(req, res) {
  try {
    const action = actionName(req);
    const method = String(req.method || 'GET').toUpperCase();
    assertSameOrigin(req, action === 'callback');

    if (action === 'status' && method === 'GET') {
      const session = await getSession(req, res);
      return sendJson(res, 200, { configured: config().configured, authenticated: Boolean(session), user: session?.user || null, provider: 'supabase' });
    }

    if (action === 'signup' && method === 'POST') {
      const body = readBody(req);
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      if (!validEmail(email) || password.length < 12 || password.length > 128) return sendJson(res, 400, { error: 'Valid email aur 12–128 characters ka password dein.' });
      const origin = `${String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()}://${String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
      if (!/^https:\/\//.test(origin)) return sendJson(res, 400, { error: 'Secure HTTPS origin required for email confirmation.' });
      const result = await supabaseRequest('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, options: { emailRedirectTo: `${origin}/` } }) });
      const existingAccount = Array.isArray(result.user?.identities) && result.user.identities.length === 0;
      if (result.access_token) saveSession(res, result);
      return sendJson(res, existingAccount ? 200 : 201, {
        created: !existingAccount && Boolean(result.user),
        existingAccount,
        authenticated: Boolean(result.access_token),
        confirmationRequired: !existingAccount && !result.access_token,
        message: existingAccount
          ? 'Is email par cloud account pehle se mojood hai. Log in karein ya Forgot password se naya password set karein.'
          : result.access_token ? 'Cloud account create ho gaya.' : 'Email confirmation request process ho gayi hai.'
      });
    }

    if (action === 'resend-confirmation' && method === 'POST') {
      const email = String(readBody(req).email || '').trim();
      if (!validEmail(email)) return sendJson(res, 400, { error: 'Valid email address dein.' });
      const origin = `${String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()}://${String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
      if (!/^https:\/\//.test(origin)) return sendJson(res, 400, { error: 'Secure HTTPS origin required for email confirmation.' });
      await supabaseRequest('/auth/v1/resend', {
        method: 'POST',
        body: JSON.stringify({ type: 'signup', email, options: { emailRedirectTo: `${origin}/` } })
      });
      return sendJson(res, 200, { requested: true, message: 'Agar account ki email confirmation pending hai to naya verification email request kar diya gaya hai. Inbox aur Spam check karein.' });
    }

    if (action === 'login' && method === 'POST') {
      const body = readBody(req);
      const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
        method: 'POST', body: JSON.stringify({ email: String(body.email || '').trim(), password: String(body.password || '') })
      });
      const user = saveSession(res, result);
      return sendJson(res, 200, { authenticated: true, user });
    }

    if ((action === 'recovery-session' || action === 'session-exchange') && method === 'POST') {
      const body = readBody(req);
      let result;
      const tokenHash = String(body.token_hash || '');
      if (tokenHash) {
        const type = String(body.type || '');
        if (!['signup','invite','magiclink','recovery','email'].includes(type) || tokenHash.length > 512) {
          return sendJson(res, 400, { error: 'Email confirmation link invalid hai.' });
        }
        result = await supabaseRequest('/auth/v1/verify', {
          method: 'POST', body: JSON.stringify({ token_hash: tokenHash, type })
        });
      } else {
        const accessToken = String(body.access_token || '');
        const refreshToken = String(body.refresh_token || '');
        if (!accessToken || !refreshToken) return sendJson(res, 400, { error: 'Confirmation/recovery link incomplete hai.' });
        const user = await supabaseRequest('/auth/v1/user', { headers: { Authorization: `Bearer ${accessToken}` } });
        result = { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(body.expires_in || 3600), user };
      }
      if (!result.access_token || !result.refresh_token) return sendJson(res, 400, { error: 'Email link verify hua lekin session receive nahi hua. Dobara link request karein.' });
      const sessionUser = saveSession(res, result);
      return sendJson(res, 200, { authenticated: true, user: sessionUser });
    }

    if (action === 'update-password' && method === 'POST') {
      const session = requireSession(await getSession(req, res));
      const password = String(readBody(req).password || '');
      if (password.length < 12 || password.length > 128) return sendJson(res, 400, { error: 'Naya password 12–128 characters ka hona chahiye.' });
      await supabaseRequest('/auth/v1/user', { method: 'PUT', headers: { Authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ password }) });
      return sendJson(res, 200, { updated: true, message: 'Cloud password update ho gaya.' });
    }

    if (action === 'recover' && method === 'POST') {
      const email = String(readBody(req).email || '').trim();
      if (!validEmail(email)) return sendJson(res, 400, { error: 'Valid email address dein.' });
      const origin = `${String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()}://${String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
      if (!/^https:\/\//.test(origin)) return sendJson(res, 400, { error: 'Secure HTTPS origin required for password recovery.' });
      await supabaseRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${origin}/`)}`, { method: 'POST', body: JSON.stringify({ email }) });
      return sendJson(res, 200, { sent: true, message: 'Agar email account mojood hai to reset email bhej di gayi hai.' });
    }

    if (action === 'logout' && method === 'POST') {
      const session = await getSession(req, res);
      if (session) await supabaseRequest('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}` } }).catch(() => {});
      clearCookie(res, SESSION_COOKIE);
      return sendJson(res, 200, { loggedOut: true });
    }

    if (action === 'google' && method === 'GET') {
      const c = config();
      if (!c.configured) return sendJson(res, 503, { error: 'Supabase environment is not configured.' });
      const origin = `${String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()}://${String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()}`;
      if (!/^https:\/\//.test(origin)) return sendJson(res, 400, { error: 'Secure HTTPS origin required for Google login.' });
      const verifier = require('node:crypto').randomBytes(48).toString('base64url');
      const challenge = require('node:crypto').createHash('sha256').update(verifier).digest('base64url');
      // Supabase Auth creates and validates its own OAuth state/flow_state. The app binds the callback to this browser with the PKCE verifier cookie.
      setCookie(res, OAUTH_COOKIE, seal({ verifier, createdAt: Date.now() }), 600, 'Lax');
      const redirect = `${origin}/api/cloud-auth/callback`;
      const target = `${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirect)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256`;
      res.statusCode = 302; res.setHeader('Location', target); res.setHeader('Cache-Control', 'no-store'); return res.end();
    }

    if (action === 'callback' && method === 'GET') {
      const flow = unseal(parseCookies(req)[OAUTH_COOKIE]);
      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const code = url.searchParams.get('code');
      if (!flow || !flow.verifier || flow.createdAt < Date.now() - 10 * 60 * 1000 || !code) return sendJson(res, 400, { error: 'Google login flow invalid ya expire ho gaya. Dobara try karein.' });
      const result = await supabaseRequest('/auth/v1/token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: flow.verifier }) });
      saveSession(res, result);
      clearCookie(res, OAUTH_COOKIE, 'Lax');
      res.statusCode = 302; res.setHeader('Location', '/?cloud-login=success'); res.setHeader('Cache-Control', 'no-store'); return res.end();
    }

    if (action === 'projects' && method === 'GET') {
      const session = requireSession(await getSession(req, res));
      const rows = await supabaseRequest('/rest/v1/projects?select=project_code,name,status,payload&order=project_code.asc', { headers: { Authorization: `Bearer ${session.accessToken}` } });
      return sendJson(res, 200, { projects: Array.isArray(rows) ? rows.map(row => ({ projectCode: String(row.project_code || ''), name: String(row.name || ''), status: String(row.status || ''), payload: row.payload && typeof row.payload === 'object' ? row.payload : null })) : [] });
    }

    if (action === 'sync' && method === 'POST') {
      const session = requireSession(await getSession(req, res));
      const body = readBody(req);
      if (!Array.isArray(body.projects) || body.projects.length > 250 || body.projects.some(project => !project || typeof project !== 'object' || Array.isArray(project))) return sendJson(res, 400, { error: 'Projects payload invalid hai (maximum 250 objects).' });
      const rows = body.projects.map(project => ({
        project_code: String(project.id || '').slice(0, 64),
        name: String(project.name || '').slice(0, 120),
        status: String(project.status || 'Planning').slice(0, 24),
        payload: project
      }));
      if (rows.some(row => !row.project_code)) return sendJson(res, 400, { error: 'Har project ka ID zaroori hai.' });
      if (rows.length) await supabaseRequest('/rest/v1/projects?on_conflict=owner_id,project_code', {
        method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows)
      });
      return sendJson(res, 200, { synced: rows.length, mode: 'manual-upsert', message: 'Cloud sync mukammal. Local files delete ya overwrite nahi ki gayin.' });
    }

    return sendJson(res, 404, { error: 'Cloud authentication endpoint not found.' });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || 'Cloud authentication failed.' });
  }
};

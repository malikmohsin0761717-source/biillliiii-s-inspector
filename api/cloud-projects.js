'use strict';

const { assertSameOrigin, readBody, sendJson, supabaseRequest, getSession, requireSession } = require('./_lib/cloud-session');

function clean(value, max, label) {
  const result = String(value ?? '').trim();
  if (!result || result.length > max) throw Object.assign(new Error(`${label} must contain 1–${max} characters.`), { status: 400 });
  return result;
}
function query(req, key) {
  if (req.query && typeof req.query[key] === 'string') return req.query[key];
  return new URL(req.url, `https://${req.headers.host || 'localhost'}`).searchParams.get(key) || '';
}
function normalize(row) {
  const payload = row && row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  return { ...payload, id: String(row.project_code), name: String(row.name || payload.name || ''), status: String(row.status || payload.status || 'Planning') };
}

module.exports = async function cloudProjectsHandler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    assertSameOrigin(req);
    const session = requireSession(await getSession(req, res));
    const base = '/rest/v1/projects';

    if (method === 'GET') {
      const rows = await supabaseRequest(`${base}?select=project_code,name,status,payload,created_at,updated_at&order=project_code.asc`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      return sendJson(res, 200, { projects: Array.isArray(rows) ? rows.map(normalize) : [] });
    }

    if (method === 'POST') {
      const body = readBody(req);
      const project = body.project && typeof body.project === 'object' && !Array.isArray(body.project) ? body.project : body;
      const id = clean(project.id, 64, 'Project ID');
      const name = clean(project.name, 120, 'Project name');
      const status = clean(project.status || 'Planning', 24, 'Project status');
      const payload = { ...project, id, name, status };
      if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 1024 * 1024) return sendJson(res, 413, { error: 'Project payload exceeds the 1 MiB limit.' });
      const rows = await supabaseRequest(`${base}?on_conflict=owner_id,project_code&select=project_code,name,status,payload,created_at,updated_at`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ project_code: id, name, status, payload })
      });
      const row = Array.isArray(rows) ? rows[0] : null;
      return sendJson(res, 200, { project: row ? normalize(row) : payload });
    }

    if (method === 'PATCH' || method === 'DELETE') {
      const id = clean(query(req, 'id'), 64, 'Project ID');
      if (method === 'DELETE') {
        await supabaseRequest(`${base}?project_code=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'return=minimal' }
        });
        return sendJson(res, 200, { deleted: true, id });
      }
      const body = readBody(req);
      const currentRows = await supabaseRequest(`${base}?select=project_code,name,status,payload&project_code=eq.${encodeURIComponent(id)}&limit=1`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (!Array.isArray(currentRows) || !currentRows.length) return sendJson(res, 404, { error: 'Project not found.' });
      const current = normalize(currentRows[0]);
      const patch = body.project && typeof body.project === 'object' && !Array.isArray(body.project) ? body.project : body;
      const updated = { ...current, ...patch, id };
      const name = clean(updated.name, 120, 'Project name');
      const status = clean(updated.status || 'Planning', 24, 'Project status');
      if (Buffer.byteLength(JSON.stringify(updated), 'utf8') > 1024 * 1024) return sendJson(res, 413, { error: 'Project payload exceeds the 1 MiB limit.' });
      const rows = await supabaseRequest(`${base}?project_code=eq.${encodeURIComponent(id)}&select=project_code,name,status,payload`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'return=representation' },
        body: JSON.stringify({ name, status, payload: updated })
      });
      const row = Array.isArray(rows) ? rows[0] : null;
      return sendJson(res, 200, { project: row ? normalize(row) : updated });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || 'Cloud project request failed.' });
  }
};

'use strict';

const {
  assertSameOrigin, readBody, sendJson, supabaseRequest, getSession, requireSession
} = require('./_lib/cloud-session');

const ALLOWED_TYPES = new Set([
  'workspace', 'reminders', 'important', 'alerts', 'settings',
  'chatbot_history', 'teacher_history'
]);

function queryValue(req, name) {
  if (req.query && typeof req.query[name] === 'string') return req.query[name];
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  return url.searchParams.get(name) || '';
}

function validateType(value) {
  const type = String(value || '');
  if (!ALLOWED_TYPES.has(type)) throw Object.assign(new Error('Document type is not allowed.'), { status: 400 });
  return type;
}

function validateKey(value) {
  const key = String(value || '').trim();
  if (key.length < 1 || key.length > 120) throw Object.assign(new Error('Document key must contain 1–120 characters.'), { status: 400 });
  return key;
}

module.exports = async function cloudDocumentsHandler(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    assertSameOrigin(req);
    const session = requireSession(await getSession(req, res));
    const base = '/rest/v1/workspace_documents';

    if (method === 'GET') {
      const type = validateType(queryValue(req, 'type'));
      const key = queryValue(req, 'key');
      const filter = key ? `&document_key=eq.${encodeURIComponent(validateKey(key))}` : '';
      const rows = await supabaseRequest(`${base}?select=document_type,document_key,payload,created_at,updated_at&document_type=eq.${encodeURIComponent(type)}${filter}&order=updated_at.desc`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      return sendJson(res, 200, { documents: Array.isArray(rows) ? rows : [] });
    }

    if (method === 'POST') {
      const body = readBody(req);
      const documentType = validateType(body.documentType);
      const documentKey = validateKey(body.documentKey);
      if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) return sendJson(res, 400, { error: 'Document payload must be a JSON object.' });
      const payloadSize = Buffer.byteLength(JSON.stringify(body.payload), 'utf8');
      if (payloadSize > 1024 * 1024) return sendJson(res, 413, { error: 'Document payload exceeds the 1 MiB limit.' });
      const rows = await supabaseRequest(`${base}?on_conflict=owner_id,document_type,document_key&select=document_type,document_key,payload,created_at,updated_at`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ document_type: documentType, document_key: documentKey, payload: body.payload })
      });
      return sendJson(res, 200, { document: Array.isArray(rows) ? rows[0] || null : null });
    }

    if (method === 'DELETE') {
      const type = validateType(queryValue(req, 'type'));
      const key = validateKey(queryValue(req, 'key'));
      await supabaseRequest(`${base}?document_type=eq.${encodeURIComponent(type)}&document_key=eq.${encodeURIComponent(key)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}`, Prefer: 'return=minimal' }
      });
      return sendJson(res, 200, { deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.message || 'Cloud document request failed.' });
  }
};

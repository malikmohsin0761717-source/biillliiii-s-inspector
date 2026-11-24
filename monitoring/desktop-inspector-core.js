'use strict';

function parseDesktopEvidence(raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { throw Object.assign(new Error('Desktop inspector ne valid JSON return nahi kiya.'), { status: 502 }); }
  if (!value || typeof value !== 'object' || !['captured', 'not-approved', 'blocked', 'unsupported'].includes(value.status)) {
    throw Object.assign(new Error('Desktop evidence status invalid hai.'), { status: 502 });
  }
  const app = String(value.app || 'Unknown').slice(0, 80);
  const text = typeof value.text === 'string' ? value.text.slice(0, 12000) : '';
  return {
    source: 'desktop-uia', status: value.status, capturedAt: String(value.capturedAt || new Date().toISOString()).slice(0, 60),
    app, text, reason: String(value.reason || '').slice(0, 240)
  };
}

module.exports = { parseDesktopEvidence };

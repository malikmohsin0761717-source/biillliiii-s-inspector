'use strict';

const $ = (id) => document.getElementById(id);
const blockedHosts = [
  'mail.google.com','gmail.com','outlook.live.com','outlook.office.com','mail.yahoo.com',
  'accounts.google.com','login.microsoftonline.com','paypal.com','stripe.com',
  '1password.com','lastpass.com','bitwarden.com','dashlane.com','keepersecurity.com'
];
const blockedPath = /\/(login|log-in|signin|sign-in|auth|oauth|otp|verify|verification|checkout|payment|billing|bank|password|reset-password)(\/|$)/i;
const sensitiveHost = /(mail|bank|payment|wallet|password|auth|login|identity|checkout)/i;

function setStatus(message) { $('status').textContent = message; }
async function getApproved() {
  const result = await chrome.storage.local.get({ approvedDomains: [] });
  return Array.isArray(result.approvedDomains) ? result.approvedDomains : [];
}
async function renderDomains() {
  const domains = await getApproved();
  $('domains').textContent = '';
  if (!domains.length) { $('domains').textContent = 'Koi domain approved nahi.'; return; }
  for (const origin of domains) {
    const row = document.createElement('div'); row.className = 'domain';
    const label = document.createElement('span'); label.textContent = origin;
    const button = document.createElement('button'); button.textContent = 'Remove';
    button.addEventListener('click', async () => {
      const pattern = `${origin}/*`;
      await chrome.permissions.remove({ origins: [pattern] });
      const next = (await getApproved()).filter(item => item !== origin);
      await chrome.storage.local.set({ approvedDomains: next });
      await renderDomains(); setStatus('Domain approval remove ho gayi.');
    });
    row.append(label, button); $('domains').append(row);
  }
}

/*
 * Chrome serializes this function into the target tab, so it must remain
 * self-contained and must not depend on popup-page variables or closures.
 */
function extractVisiblePageEvidence() {
  const url = new URL(location.href);
  const blocked = /\/(login|log-in|signin|sign-in|auth|oauth|otp|verify|verification|checkout|payment|billing|bank|password|reset-password)(\/|$)/i;
  const sensitiveHostPattern = /(mail|bank|payment|wallet|password|auth|login|identity|checkout)/i;
  const sensitiveHint = /password|passcode|otp|one.time|verification|cc-|card|cvv|cvc|bank|email|login|token|secret|api.?key|social.?security|ssn|account.?number/i;
  const secretText = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|secret[_ -]?key)\b\s*[:=]\s*[A-Za-z0-9_\-./+=]{8,}|\b(?:otp|one.time.code|verification code)\b\s*[:=]?\s*\d{4,8}\b|\b(?:cvv|cvc)\b\s*[:=]?\s*\d{3,4}\b|\b\d{3}-\d{2}-\d{4}\b/i;

  const fields = Array.from(document.querySelectorAll(
    'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'
  ));
  const sensitiveField = fields.some(element => {
    const type = String(element.getAttribute('type') || '').toLowerCase();
    const hint = [
      element.getAttribute('name'), element.id, element.getAttribute('autocomplete'),
      element.getAttribute('aria-label'), element.getAttribute('placeholder'),
      element.getAttribute('data-testid')
    ].filter(Boolean).join(' ');
    return ['password', 'email', 'tel'].includes(type) ||
      element.isContentEditable ||
      sensitiveHint.test(hint) ||
      element.getAttribute('aria-autocomplete') === 'list' && sensitiveHint.test(hint);
  });

  if (sensitiveHostPattern.test(url.hostname) || blocked.test(url.pathname) ||
      document.querySelector('form') || sensitiveField) {
    return { status: 'blocked', reason: 'Sensitive host, path, form, or input detected. No page text was captured.' };
  }

  const text = String(document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000);
  if (!text) return { status: 'unsupported', reason: 'No visible page text was available.' };
  if (secretText.test(text)) {
    return { status: 'blocked', reason: 'Possible secret, token, OTP, CVV, or identity number detected. No page text was captured.' };
  }

  return {
    status: 'captured',
    source: 'browser-extension',
    capturedAt: new Date().toISOString(),
    url: url.origin + url.pathname,
    title: String(document.title || '').slice(0, 200),
    text
  };
}

$('capture').addEventListener('click', async () => {
  $('capture').disabled = true;
  $('evidence').value = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error('Active tab available nahi.');
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol) ||
        url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      throw new Error('Chrome internal, local aur non-web pages capture nahi hotay.');
    }
    if (blockedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
        blockedPath.test(url.pathname) || sensitiveHost.test(url.hostname)) {
      throw new Error('Yeh sensitive domain ya page path blocked hai.');
    }

    const origin = url.origin;
    const approved = await getApproved();
    const pattern = `${origin}/*`;
    const hasPermission = await chrome.permissions.contains({ origins: [pattern] });

    // Fresh, explicit consent is required for EVERY capture, even if previously approved.
    const confirmed = window.confirm(
      `Kya aap is waqt sirf is domain ka visible page text aik martaba read karne ki ijazat dete hain?\n\n${origin}\n\nHar capture par dobara confirmation zaroori hai. Evidence preview hogi; auto-send nahi hogi.`
    );
    if (!confirmed) {
      setStatus('Capture cancel. Koi page text read nahi hua.');
      return;
    }

    if (!hasPermission) {
      const granted = await chrome.permissions.request({ origins: [pattern] });
      if (!granted) {
        setStatus('Browser permission grant nahi hui. Koi page text read nahi hua.');
        return;
      }
    }
    if (!approved.includes(origin)) {
      await chrome.storage.local.set({ approvedDomains: [...new Set([...approved, origin])] });
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVisiblePageEvidence
    });
    const evidence = result?.result;
    if (!evidence || evidence.status !== 'captured') {
      throw new Error(evidence?.reason || 'Page capture available nahi.');
    }
    $('evidence').value = JSON.stringify(evidence, null, 2);
    setStatus('Capture complete. Evidence sirf yahan preview hai; app ya AI ko auto-send nahi hui.');
    await renderDomains();
  } catch (error) {
    setStatus(error.message || 'Capture fail hui.');
  } finally {
    $('capture').disabled = false;
  }
});

void renderDomains();

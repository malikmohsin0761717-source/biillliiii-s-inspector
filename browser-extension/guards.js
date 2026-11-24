'use strict';

(() => {
  const BLOCKED_HOSTS = [
    'mail.google.com', 'gmail.com', 'outlook.live.com', 'outlook.office.com',
    'mail.yahoo.com', 'accounts.google.com', 'login.microsoftonline.com',
    'paypal.com', 'stripe.com', '1password.com', 'lastpass.com',
    'bitwarden.com', 'dashlane.com', 'keepersecurity.com'
  ];
  const BLOCKED_PATH = /\/(login|log-in|signin|sign-in|auth|oauth|otp|verify|verification|checkout|payment|billing|bank|password|reset-password)(\/|$)/i;
  const SENSITIVE_HOST = /(mail|bank|payment|wallet|password|auth|login|identity|checkout)/i;
  const SENSITIVE_HINT = /password|passcode|otp|one.time|verification|cc-|card|cvv|cvc|bank|email|login|token|secret|api.?key|social.?security|ssn|account.?number/i;
  const SECRET_TEXT = /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|secret[_ -]?key)\b\s*[:=]\s*[A-Za-z0-9_\-./+=]{8,}|\b(?:otp|one.time.code|verification code)\b\s*[:=]?\s*\d{4,8}\b|\b(?:cvv|cvc)\b\s*[:=]?\s*\d{3,4}\b|\b\d{3}-\d{2}-\d{4}\b/i;

  function hostIsBlocked(hostname) {
    const host = String(hostname || '').toLowerCase();
    return BLOCKED_HOSTS.some(hostname => host === hostname || host.endsWith(`.${hostname}`));
  }

  function pathIsBlocked(pathname) {
    return BLOCKED_PATH.test(String(pathname || ''));
  }

  function urlIsBlocked(value) {
    try {
      const url = new URL(value);
      return !['http:', 'https:'].includes(url.protocol) ||
        url.hostname === 'localhost' || url.hostname === '127.0.0.1' ||
        hostIsBlocked(url.hostname) || SENSITIVE_HOST.test(url.hostname) ||
        pathIsBlocked(url.pathname);
    } catch {
      return true;
    }
  }

  function textLooksSensitive(text) {
    return SECRET_TEXT.test(String(text || ''));
  }

  globalThis.BIPrivacyGuards = Object.freeze({
    hostIsBlocked,
    pathIsBlocked,
    urlIsBlocked,
    textLooksSensitive
  });
})();

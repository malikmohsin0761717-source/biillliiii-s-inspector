'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(crypto.scrypt);
const SESSION_COOKIE = 'biillliiii_session';
const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function authError(message, status) {
  return Object.assign(new Error(message), { status });
}

function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { result[key] = decodeURIComponent(value); }
    catch { result[key] = value; }
  }
  return result;
}

function normalizeRecoveryCode(value) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : '';
}

function validateUsername(value) {
  if (typeof value !== 'string') throw authError('Username must be text.', 400);
  const username = value.trim();
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    throw authError('Username 3–32 characters ka ho aur sirf letters, numbers, dot, underscore ya hyphen use kare.', 400);
  }
  return username;
}

function validatePassword(value, confirmPassword) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw authError('Password kam az kam 12 aur zyada se zyada 128 characters ka hona chahiye.', 400);
  }
  if (value !== confirmPassword) throw authError('Password aur confirmation match nahi karte.', 400);
  return value;
}

async function deriveHash(secret, saltHex) {
  const derived = await scryptAsync(secret, Buffer.from(saltHex, 'hex'), 64, SCRYPT_OPTIONS);
  return Buffer.from(derived).toString('hex');
}

function safeEqualHex(actualHex, expectedHex) {
  if (typeof actualHex !== 'string' || typeof expectedHex !== 'string') return false;
  const actual = Buffer.from(actualHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && actual.length > 0 && crypto.timingSafeEqual(actual, expected);
}

class LocalAuthManager {
  constructor(options = {}) {
    this.filePath = options.filePath;
    if (!this.filePath) throw new TypeError('filePath is required.');
    this.idleTimeoutMs = Number(options.idleTimeoutMs || process.env.BI_AUTH_IDLE_TIMEOUT_MS || DEFAULT_IDLE_TIMEOUT_MS);
    this.absoluteTimeoutMs = Number(options.absoluteTimeoutMs || DEFAULT_ABSOLUTE_TIMEOUT_MS);
    this.sessions = new Map();
    this.onLastSessionExpired = typeof options.onLastSessionExpired === 'function' ? options.onLastSessionExpired : () => {};
  }

  readConfig() {
    if (!fs.existsSync(this.filePath)) return null;
    let config;
    try { config = JSON.parse(fs.readFileSync(this.filePath, 'utf8')); }
    catch { throw authError('Authentication file unreadable hai. Isay delete ya overwrite na karein; pehle backup aur repair zaroori hai.', 500); }
    if (!config || config.schemaVersion !== 1 || !config.password || !config.recovery) {
      throw authError('Authentication file ka format invalid hai. Data ko overwrite nahi kiya gaya.', 500);
    }
    return config;
  }

  writeConfig(config, exclusive = false) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(tempPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      if (exclusive) {
        let fd;
        try {
          fd = fs.openSync(this.filePath, 'wx', 0o600);
          fs.writeFileSync(fd, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
          fs.fsyncSync(fd);
        } catch (error) {
          if (error.code === 'EEXIST') throw authError('Owner account pehle hi create ho chuka hai.', 409);
          throw error;
        } finally {
          if (fd !== undefined) fs.closeSync(fd);
        }
      } else {
        fs.renameSync(tempPath, this.filePath);
      }
      try { fs.chmodSync(this.filePath, 0o600); } catch { /* Windows ACLs control file permissions. */ }
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* best-effort temp cleanup */ }
    }
  }

  newRecoveryCode() {
    return crypto.randomBytes(20).toString('hex').toUpperCase();
  }

  newSession() {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    this.sessions.set(tokenHash, { username: this.readConfig().username, createdAt: now, lastActivity: now });
    return token;
  }

  getSession(req, options = {}) {
    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (!token) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    const now = Date.now();
    if (now - session.lastActivity >= this.idleTimeoutMs || now - session.createdAt >= this.absoluteTimeoutMs) {
      this.sessions.delete(tokenHash);
      if (this.sessions.size === 0) this.onLastSessionExpired();
      return null;
    }
    if (options.touch) session.lastActivity = now;
    return session;
  }

  getStatus(req) {
    const config = this.readConfig();
    const session = config ? this.getSession(req, { touch: true }) : null;
    return {
      configured: Boolean(config),
      authenticated: Boolean(session),
      username: session ? session.username : null,
      idleTimeoutSeconds: Math.floor(this.idleTimeoutMs / 1000)
    };
  }

  async setup(body) {
    if (fs.existsSync(this.filePath)) throw authError('Owner account pehle hi configured hai.', 409);
    const username = validateUsername(body.username);
    const password = validatePassword(body.password, body.confirmPassword);
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const recoveryCode = this.newRecoveryCode();
    const recoverySalt = crypto.randomBytes(16).toString('hex');
    const [passwordHash, recoveryHash] = await Promise.all([
      deriveHash(password, passwordSalt),
      deriveHash(recoveryCode, recoverySalt)
    ]);
    const config = {
      schemaVersion: 1,
      username,
      password: { algorithm: 'scrypt', salt: passwordSalt, hash: passwordHash },
      recovery: { algorithm: 'scrypt', salt: recoverySalt, hash: recoveryHash },
      failedAttempts: 0,
      lockUntil: null,
      createdAt: new Date().toISOString()
    };
    this.writeConfig(config, true);
    return { configured: true, recoveryCode };
  }

  async login(body) {
    const config = this.readConfig();
    if (!config) throw authError('Pehle Owner Account setup karein.', 409);
    const now = Date.now();
    const lockUntil = config.lockUntil ? Date.parse(config.lockUntil) : 0;
    if (lockUntil && lockUntil > now) {
      throw authError(`Too many wrong attempts. ${Math.ceil((lockUntil - now) / 1000)} seconds baad dobara try karein.`, 429);
    }
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length > 128) throw authError('Password 128 characters se zyada nahi ho sakta.', 400);
    const candidate = await deriveHash(password, config.password.salt);
    const latestConfig = this.readConfig();
    if (!latestConfig || latestConfig.password.salt !== config.password.salt || latestConfig.password.hash !== config.password.hash) {
      throw authError('Owner credentials abhi change hue hain. Dobara login try karein.', 409);
    }
    const latestLockUntil = latestConfig.lockUntil ? Date.parse(latestConfig.lockUntil) : 0;
    if (latestLockUntil && latestLockUntil > Date.now()) {
      throw authError(`Too many wrong attempts. ${Math.ceil((latestLockUntil - Date.now()) / 1000)} seconds baad dobara try karein.`, 429);
    }
    const valid = username.toLowerCase() === String(latestConfig.username).toLowerCase() && safeEqualHex(candidate, latestConfig.password.hash);
    if (!valid) {
      latestConfig.failedAttempts = Number(latestConfig.failedAttempts || 0) + 1;
      if (latestConfig.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        latestConfig.failedAttempts = 0;
        latestConfig.lockUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
      }
      this.writeConfig(latestConfig);
      throw authError('Username ya password sahi nahi hai.', 401);
    }
    latestConfig.failedAttempts = 0;
    latestConfig.lockUntil = null;
    this.writeConfig(latestConfig);
    const hadPriorSessions = this.sessions.size > 0;
    this.sessions.clear();
    if (hadPriorSessions) this.onLastSessionExpired();
    return { username: latestConfig.username, token: this.newSession() };
  }

  logout(req) {
    const token = parseCookies(req.headers.cookie || '')[SESSION_COOKIE];
    if (!token) return { loggedOut: false, lastSession: this.sessions.size === 0 };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const removed = this.sessions.delete(tokenHash);
    const lastSession = this.sessions.size === 0;
    const monitoringPaused = Boolean(removed && lastSession && this.onLastSessionExpired());
    return { loggedOut: removed, lastSession, monitoringPaused };
  }

  async recover(body) {
    const config = this.readConfig();
    if (!config) throw authError('Owner Account abhi setup nahi hua.', 409);
    const now = Date.now();
    const lockUntil = config.lockUntil ? Date.parse(config.lockUntil) : 0;
    if (lockUntil && lockUntil > now) {
      throw authError(`Too many attempts. ${Math.ceil((lockUntil - now) / 1000)} seconds baad dobara try karein.`, 429);
    }
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
    if (recoveryCode.length > 64) throw authError('Recovery code format invalid hai.', 400);
    const newPassword = validatePassword(body.newPassword, body.confirmPassword);
    const candidate = await deriveHash(recoveryCode, config.recovery.salt);
    const valid = username.toLowerCase() === String(config.username).toLowerCase() && safeEqualHex(candidate, config.recovery.hash);
    if (!valid) {
      config.failedAttempts = Number(config.failedAttempts || 0) + 1;
      if (config.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        config.failedAttempts = 0;
        config.lockUntil = new Date(now + LOCKOUT_MS).toISOString();
      }
      this.writeConfig(config);
      throw authError('Username ya recovery code sahi nahi hai.', 401);
    }
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const newRecoveryCode = this.newRecoveryCode();
    const recoverySalt = crypto.randomBytes(16).toString('hex');
    const [passwordHash, recoveryHash] = await Promise.all([
      deriveHash(newPassword, passwordSalt),
      deriveHash(newRecoveryCode, recoverySalt)
    ]);
    config.password = { algorithm: 'scrypt', salt: passwordSalt, hash: passwordHash };
    config.recovery = { algorithm: 'scrypt', salt: recoverySalt, hash: recoveryHash };
    config.failedAttempts = 0;
    config.lockUntil = null;
    config.passwordUpdatedAt = new Date().toISOString();
    this.writeConfig(config);
    const hadSessions = this.sessions.size > 0;
    this.sessions.clear();
    if (hadSessions) this.onLastSessionExpired();
    return { recovered: true, recoveryCode: newRecoveryCode };
  }

  sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (now - session.lastActivity >= this.idleTimeoutMs || now - session.createdAt >= this.absoluteTimeoutMs) {
        this.sessions.delete(tokenHash);
        removed += 1;
      }
    }
    if (removed && this.sessions.size === 0) this.onLastSessionExpired();
    return removed;
  }
}

module.exports = {
  LocalAuthManager,
  SESSION_COOKIE,
  authError,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_ABSOLUTE_TIMEOUT_MS
};

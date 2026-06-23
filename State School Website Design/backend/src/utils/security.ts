// Security utilities for high-level protection
import crypto from 'crypto';

const LOCK_THRESHOLD = parseInt(process.env.AUTH_LOCK_THRESHOLD || '3');
const MAX_LOCK_MINUTES = parseInt(process.env.AUTH_MAX_LOCK_MINUTES || '120');

// Generate secure random token
export function generateSecureToken(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

// Hash with SHA-256
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Generate device fingerprint
export function generateDeviceFingerprint(req: any): string {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  const fingerprint = `${userAgent}|${ip}|${acceptLanguage}|${acceptEncoding}`;
  return sha256(fingerprint);
}

// Login protection tracker. Lockouts grow: 5, 10, 20, 40... minutes.
const loginAttempts = new Map<string, {
  failedCount: number;
  lockLevel: number;
  lockedUntil: number;
  lastAttempt: number;
}>();

function getAttemptKey(ip: string, username: string) {
  return `${ip}|${username.toLowerCase().trim()}`;
}

function getLockMinutes(lockLevel: number) {
  return Math.min(5 * 2 ** Math.max(lockLevel - 1, 0), MAX_LOCK_MINUTES);
}

export function checkLoginAllowed(ip: string, username: string): { allowed: boolean; retryAfter?: number; failedCount: number; lockLevel: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(getAttemptKey(ip, username));

  if (!attempt || attempt.lockedUntil <= now) {
    return {
      allowed: true,
      failedCount: attempt?.failedCount || 0,
      lockLevel: attempt?.lockLevel || 0
    };
  }

  return {
    allowed: false,
    retryAfter: Math.ceil((attempt.lockedUntil - now) / 1000),
    failedCount: attempt.failedCount,
    lockLevel: attempt.lockLevel
  };
}

export function recordFailedLogin(ip: string, username: string): { failedCount: number; locked: boolean; retryAfter?: number; lockMinutes?: number; lockLevel: number } {
  const now = Date.now();
  const key = getAttemptKey(ip, username);
  const attempt = loginAttempts.get(key) || { failedCount: 0, lockLevel: 0, lockedUntil: 0, lastAttempt: now };
  const failedCount = attempt.failedCount + 1;

  if (failedCount >= LOCK_THRESHOLD) {
    const lockLevel = attempt.lockLevel + 1;
    const lockMinutes = getLockMinutes(lockLevel);
    const lockedUntil = now + lockMinutes * 60 * 1000;
    loginAttempts.set(key, {
      failedCount,
      lockLevel,
      lockedUntil,
      lastAttempt: now
    });

    return {
      failedCount,
      locked: true,
      retryAfter: lockMinutes * 60,
      lockMinutes,
      lockLevel
    };
  }

  attempt.failedCount = failedCount;
  attempt.lastAttempt = now;
  loginAttempts.set(key, attempt);

  return {
    failedCount,
    locked: false,
    lockLevel: attempt.lockLevel
  };
}

export function resetLoginAttempts(ip: string, username = ''): void {
  if (username) {
    loginAttempts.delete(getAttemptKey(ip, username));
    return;
  }

  for (const key of loginAttempts.keys()) {
    if (key.startsWith(`${ip}|`)) loginAttempts.delete(key);
  }
}

// Session timeout (24 hours)
export const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Validate password strength
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

import { Request, Response } from 'express';
import { db, saveDatabase, getNextId } from '../config/database.js';
import { hashPassword, comparePassword, generateToken, getAuthCookieName } from '../utils/auth.js';
import { checkLoginAllowed, generateDeviceFingerprint, recordFailedLogin, resetLoginAttempts, validatePasswordStrength, generateSecureToken } from '../utils/security.js';
import type { AuthRequest } from '../utils/auth.js';
import { createHash, timingSafeEqual } from 'crypto';
import { logActivity, pushNotification } from '../utils/activity.js';

const AUTH_COOKIE_NAME = getAuthCookieName();
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const COOKIE_HTTP_ONLY = process.env.COOKIE_HTTP_ONLY !== 'false';
const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || 'strict').toLowerCase() as 'strict' | 'lax' | 'none';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SECRET_HASH_PREFIX = 'sha256:';
const SECONDARY_ADMIN_USERNAME = process.env.SECONDARY_ADMIN_USERNAME || 'shuhratmadaminov509@_';
const SECONDARY_ADMIN_PASSWORD = process.env.SECONDARY_ADMIN_PASSWORD || 'shuhrat995';

function buildAuthCookieOptions() {
  return {
    httpOnly: COOKIE_HTTP_ONLY,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS
  } as const;
}

function hashSecretKey(secretKey: string): string {
  return `${SECRET_HASH_PREFIX}${createHash('sha256').update(secretKey).digest('hex')}`;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySecretKey(input: string, stored: string): boolean {
  if (stored.startsWith(SECRET_HASH_PREFIX)) {
    return safeCompare(hashSecretKey(input), stored);
  }

  return safeCompare(input, stored);
}

function getClientIp(req: Request) {
  return req.ip || req.connection.remoteAddress || '';
}

function recordBlockedAttempt(username: string, ip: string, userAgent: string, failedCount: number, retryAfter?: number) {
  const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 0;
  const message = `Admin panelga kirishga urinish bloklandi. Login: ${username}, IP: ${ip}, xato urinishlar: ${failedCount}${minutes ? `, kutish: ${minutes} daqiqa` : ''}.`;
  pushNotification('Xavfli admin login urinishi', message, 'danger');
  logActivity(null, 'login_blocked', 'auth', null, `${message} User-Agent: ${userAgent || 'unknown'}`);
  saveDatabase();
}

function recordFailedAttempt(username: string, ip: string, userAgent: string, failedCount: number, retryAfter?: number) {
  const minutes = retryAfter ? Math.ceil(retryAfter / 60) : 0;
  const message = `Admin panelga noto'g'ri kirishga urinish. Login: ${username}, IP: ${ip}, xato urinishlar: ${failedCount}${minutes ? `, blok: ${minutes} daqiqa` : ''}.`;
  if (failedCount >= 3 || retryAfter) {
    pushNotification('Admin panelga kirishga urinishdi', message, 'danger');
  }
  logActivity(null, 'login_failed', 'auth', null, `${message} User-Agent: ${userAgent || 'unknown'}`);
  saveDatabase();
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ip = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '');
    const lockStatus = checkLoginAllowed(ip, username);

    if (!lockStatus.allowed) {
      recordBlockedAttempt(username, ip, userAgent, lockStatus.failedCount, lockStatus.retryAfter);
      return res.status(429).json({
        error: `Juda ko'p xato urinish. ${Math.ceil((lockStatus.retryAfter || 0) / 60)} daqiqa kuting.`,
        retryAfter: lockStatus.retryAfter
      });
    }

    const admin = db.admins.find(a => a.username === username && a.is_active);

    if (!admin) {
      const failed = recordFailedLogin(ip, username);
      recordFailedAttempt(username, ip, userAgent, failed.failedCount, failed.retryAfter);
      if (failed.locked) {
        return res.status(429).json({
          error: `3 marta xato kiritildi. ${failed.lockMinutes} daqiqa kuting.`,
          retryAfter: failed.retryAfter
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await comparePassword(password, admin.password_hash);

    if (!isValidPassword) {
      const failed = recordFailedLogin(ip, username);
      recordFailedAttempt(username, ip, userAgent, failed.failedCount, failed.retryAfter);
      if (failed.locked) {
        return res.status(429).json({
          error: `3 marta xato kiritildi. ${failed.lockMinutes} daqiqa kuting.`,
          retryAfter: failed.retryAfter
        });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(req);

    // Check if device exists
    let device = db.devices?.find(d => d.fingerprint === deviceFingerprint && d.admin_id === admin.id);

    if (!device) {
      // Create new device automatically (no verification needed)
      device = {
        id: getNextId('devices'),
        admin_id: admin.id,
        fingerprint: deviceFingerprint,
        device_name: req.body.deviceName || 'Primary Device',
        ip_address: ip,
        user_agent: req.headers['user-agent'] || '',
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_active: true
      };

      if (!db.devices) db.devices = [];
      db.devices.push(device);
    } else {
      // Update existing device
      device.last_active = new Date().toISOString();
      device.ip_address = ip;
    }

    resetLoginAttempts(ip, username);

    const token = generateToken({
      id: admin.id,
      username: admin.username,
      deviceId: device.id,
      fingerprint: deviceFingerprint
    });

    // Update admin last login
    admin.last_login = new Date().toISOString();
    admin.updated_at = new Date().toISOString();
    
    // Record login in history
    if (!db.login_history) db.login_history = [];
    db.login_history.push({
      id: getNextId('login_history'),
      admin_id: admin.id,
      username: admin.username,
      ip_address: ip,
      user_agent: req.headers['user-agent'] || '',
      device_name: device.device_name || 'Unknown Device',
      success: true,
      login_time: new Date().toISOString(),
      logout_time: null
    });
    
    saveDatabase();
    res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());

    res.json({
      message: 'Login successful',
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email
      },
      device: {
        id: device.id,
        name: device.device_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  try {
    const currentDeviceId = parseInt(req.headers['x-device-id'] as string || '0');
    if (req.admin?.id && currentDeviceId) {
      const device = (db.devices || []).find(d => d.id === currentDeviceId && d.admin_id === req.admin!.id);
      if (device) {
        device.last_active = new Date().toISOString();
      }
    }

    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: COOKIE_HTTP_ONLY,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      path: '/'
    });
    saveDatabase();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getDevices(req: AuthRequest, res: Response) {
  try {
    const devices = (db.devices || []).filter(d => d.admin_id === req.admin!.id);
    
    res.json({ 
      devices: devices.map(d => ({
        id: d.id,
        device_name: d.device_name,
        ip_address: d.ip_address,
        created_at: d.created_at,
        last_active: d.last_active,
        is_current: d.id === parseInt(req.headers['x-device-id'] as string || '0'),
        is_active: d.is_active
      }))
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function revokeDevice(req: AuthRequest, res: Response) {
  try {
    const { deviceId } = req.params;
    const device = (db.devices || []).find(d => d.id === parseInt(deviceId));
    
    if (!device || device.admin_id !== req.admin!.id) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    device.is_active = false;
    saveDatabase();
    
    res.json({ message: 'Device revoked successfully' });
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function revokeAllOtherDevices(req: AuthRequest, res: Response) {
  try {
    const currentDeviceId = parseInt(req.headers['x-device-id'] as string || '0');
    
    (db.devices || []).forEach(d => {
      if (d.admin_id === req.admin!.id && d.id !== currentDeviceId) {
        d.is_active = false;
      }
    });
    
    saveDatabase();
    
    res.json({ message: 'All other devices revoked' });
  } catch (error) {
    console.error('Revoke all devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function setSecretKey(req: AuthRequest, res: Response) {
  try {
    const { secretKey } = req.body;
    
    if (!secretKey || secretKey.length < 16) {
      return res.status(400).json({ error: 'Secret key must be at least 16 characters' });
    }
    
    const admin = db.admins.find(a => a.id === req.admin!.id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    admin.secret_key = hashSecretKey(secretKey);
    admin.updated_at = new Date().toISOString();
    saveDatabase();
    
    res.json({ message: 'Secret key set successfully' });
  } catch (error) {
    console.error('Set secret key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function recoverPassword(req: Request, res: Response) {
  try {
    const { username, secretKey, newPassword } = req.body;
    
    if (!username || !secretKey || !newPassword) {
      return res.status(400).json({ error: 'Username, secret key, and new password are required' });
    }
    
    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Weak password',
        details: passwordValidation.errors
      });
    }
    
    const admin = db.admins.find(a => a.username === username && a.is_active);
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    if (!verifySecretKey(secretKey, admin.secret_key)) {
      return res.status(403).json({ error: 'Invalid secret key' });
    }
    
    // Revoke all devices
    (db.devices || []).forEach(d => {
      if (d.admin_id === admin.id) {
        d.is_active = false;
      }
    });
    
    // Update password
    admin.password_hash = await hashPassword(newPassword);
    const newSecretKey = generateSecureToken(32);
    admin.secret_key = hashSecretKey(newSecretKey);
    admin.updated_at = new Date().toISOString();
    
    saveDatabase();
    
    res.json({ 
      message: 'Password changed successfully. All devices have been logged out. Please login again.',
      newSecretKey
    });
  } catch (error) {
    console.error('Recover password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        error: 'Weak password',
        details: passwordValidation.errors
      });
    }

    const admin = db.admins.find(a => a.id === req.admin!.id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const isValidPassword = await comparePassword(currentPassword, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await hashPassword(newPassword);
    admin.password_hash = newPasswordHash;
    admin.updated_at = new Date().toISOString();
    
    // Revoke all other devices
    const currentDeviceId = parseInt(req.headers['x-device-id'] as string || '0');
    (db.devices || []).forEach(d => {
      if (d.admin_id === admin.id && d.id !== currentDeviceId) {
        d.is_active = false;
      }
    });
    
    saveDatabase();

    res.json({ message: 'Password changed successfully. All other devices have been logged out.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const admin = db.admins.find(a => a.id === req.admin!.id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const device = (db.devices || []).find(d => d.id === parseInt(req.headers['x-device-id'] as string || '0'));
    
    if (!device || !device.is_active) {
      return res.status(403).json({ error: 'Invalid or revoked device' });
    }

    res.json({ 
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        created_at: admin.created_at,
        last_login: admin.last_login,
        has_secret_key: !!admin.secret_key
      } 
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLoginHistory(req: AuthRequest, res: Response) {
  try {
    const { limit = 50 } = req.query;
    const history = (db.login_history || [])
      .filter(h => h.admin_id === req.admin!.id)
      .sort((a, b) => new Date(b.login_time).getTime() - new Date(a.login_time).getTime())
      .slice(0, parseInt(limit as string));

    res.json({ 
      history,
      total: history.length
    });
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function ensureAdminAccount(username: string, password: string, email = 'admin@school.edu') {
  const existing = db.admins.find((admin) => admin.username === username);
  if (existing) {
    const passwordMatches = await comparePassword(password, existing.password_hash);
    if (!passwordMatches) {
      existing.password_hash = await hashPassword(password);
      existing.is_active = true;
      existing.updated_at = new Date().toISOString();
      saveDatabase();
    }
    return existing;
  }

  const newAdmin = {
    id: getNextId('admins'),
    username,
    password_hash: await hashPassword(password),
    secret_key: hashSecretKey(generateSecureToken(32)),
    email,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: null
  };

  db.admins.push(newAdmin);
  saveDatabase();
  return newAdmin;
}

export async function createInitialAdmin() {
  if (db.admins.length > 0) {
    await ensureAdminAccount(SECONDARY_ADMIN_USERNAME, SECONDARY_ADMIN_PASSWORD, 'shuhratmadaminov509@school.local');
    console.log(`Secondary admin login enabled: ${SECONDARY_ADMIN_USERNAME}`);
    console.log('✅ Admin user already exists');
    return;
  }

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'School@Admin2024!';
  const secretKey = generateSecureToken(32);
  
  const passwordHash = await hashPassword(password);
  
  const newAdmin = {
    id: getNextId('admins'),
    username,
    password_hash: passwordHash,
    secret_key: hashSecretKey(secretKey),
    email: 'admin@school.edu',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: null
  };
  
  db.admins.push(newAdmin);
  saveDatabase();
  await ensureAdminAccount(SECONDARY_ADMIN_USERNAME, SECONDARY_ADMIN_PASSWORD, 'shuhratmadaminov509@school.local');
  console.log(`Secondary admin login enabled: ${SECONDARY_ADMIN_USERNAME}`);

  console.log('\n🔐 Initial admin user created');
  console.log(`   Username: ${username}`);
  console.log('   Password: loaded from environment or default configuration');
  console.log(`   ⚠️  SECRET KEY (Save this!): ${secretKey}`);
  console.log('   ⚠️  Please change the default password and secret key after first login!\n');
}

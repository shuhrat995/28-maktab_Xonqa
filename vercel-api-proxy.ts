export const config = {
  api: {
    bodyParser: false
  }
};

declare const process: any;
declare const Buffer: any;

type AdminAccount = {
  id: number;
  username: string;
  password: string;
  email: string;
  secretKey: string;
  last_login?: string;
};

type AttemptState = {
  failedCount: number;
  lockLevel: number;
  lockedUntil: number;
};

const AUTH_COOKIE_NAME = 'admin_auth';
const TOKEN_SECRET = process.env.JWT_SECRET || 'maktab28-vercel-token-secret-2026';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

const admins: AdminAccount[] = [
  {
    id: 1,
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'School@Admin2024!',
    email: 'admin@school.edu',
    secretKey: 'maktab28-secure-secret'
  },
  {
    id: 2,
    username: process.env.SECONDARY_ADMIN_USERNAME || 'shuhratmadaminov509@_',
    password: process.env.SECONDARY_ADMIN_PASSWORD || 'shuhrat995',
    email: 'shuhratmadaminov509@school.local',
    secretKey: 'maktab28-shuhrat-secret'
  }
];

const attempts = new Map<string, AttemptState>();
const notifications: any[] = [];
const logs: any[] = [];

const state = {
  content: [] as any[],
  teachers: [] as any[],
  students: [] as any[],
  staff: [] as any[],
  sections: {} as Record<string, any>,
  settings: [] as any[]
};

let nextId = 1;

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '');
}

function getBackendOrigin() {
  return normalizeOrigin(
    process.env.BACKEND_ORIGIN ||
    process.env.VITE_API_ORIGIN ||
    process.env.VITE_API_URL ||
    ''
  );
}

function readRequestBody(req: any) {
  return new Promise<any>((resolve, reject) => {
    const chunks: any[] = [];
    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function copyRequestHeaders(req: any) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    const headerName = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(headerName) || headerName === 'host') continue;

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  headers.set('x-forwarded-host', req.headers.host || '');
  headers.set('x-forwarded-proto', 'https');

  return headers;
}

function copyResponseHeaders(upstreamResponse: Response, res: any) {
  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  const setCookies = (upstreamResponse.headers as any).getSetCookie?.();
  if (Array.isArray(setCookies) && setCookies.length) {
    res.setHeader('set-cookie', setCookies);
    return;
  }

  const setCookie = upstreamResponse.headers.get('set-cookie');
  if (setCookie) res.setHeader('set-cookie', setCookie);
}

function nowIso() {
  return new Date().toISOString();
}

function clientIp(req: any) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function attemptKey(req: any, username: string) {
  return `${clientIp(req)}|${username.toLowerCase().trim()}`;
}

function checkLoginAllowed(req: any, username: string) {
  const attempt = attempts.get(attemptKey(req, username));
  if (!attempt) return { allowed: true, failedCount: 0, retryAfter: 0 };
  const remaining = attempt.lockedUntil - Date.now();
  if (remaining <= 0) return { allowed: true, failedCount: attempt.failedCount, retryAfter: 0 };
  return { allowed: false, failedCount: attempt.failedCount, retryAfter: Math.ceil(remaining / 1000) };
}

function recordFailedLogin(req: any, username: string) {
  const key = attemptKey(req, username);
  const current = attempts.get(key) || { failedCount: 0, lockLevel: 0, lockedUntil: 0 };
  current.failedCount += 1;

  let retryAfter = 0;
  if (current.failedCount >= 3) {
    current.lockLevel += 1;
    const lockMinutes = 5 * Math.pow(2, current.lockLevel - 1);
    current.lockedUntil = Date.now() + lockMinutes * 60 * 1000;
    retryAfter = lockMinutes * 60;
  }

  attempts.set(key, current);
  addDangerNotice(
    `Admin panelga noto'g'ri kirishga urinish. Login: ${username}, IP: ${clientIp(req)}, xato urinishlar: ${current.failedCount}${retryAfter ? `, kutish: ${Math.ceil(retryAfter / 60)} daqiqa` : ''}.`
  );

  return { failedCount: current.failedCount, retryAfter };
}

function resetLoginAttempts(req: any, username: string) {
  attempts.delete(attemptKey(req, username));
}

function addLog(message: string, action = 'system') {
  logs.unshift({
    id: nextId++,
    admin_id: null,
    action,
    entity: 'admin',
    entity_id: null,
    message,
    created_at: nowIso()
  });
  logs.splice(100);
}

function addDangerNotice(message: string) {
  notifications.unshift({
    id: nextId++,
    title: 'Xavfli admin login urinishi',
    message,
    type: 'danger',
    is_read: false,
    created_at: nowIso()
  });
  notifications.splice(100);
  addLog(message, 'security');
}

function setCookie(res: any, token: string) {
  res.setHeader(
    'set-cookie',
    `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function clearCookie(res: any) {
  res.setHeader('set-cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function cookieValue(req: any, name: string) {
  const cookie = String(req.headers?.cookie || '');
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function currentAdmin(req: any) {
  const token = cookieValue(req, AUTH_COOKIE_NAME);
  const adminId = verifyToken(token);
  return adminId ? admins.find((admin) => admin.id === adminId) || null : null;
}

function signPayload(payload: string) {
  let hash = 2166136261;
  const input = `${payload}.${TOKEN_SECRET}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createToken(adminId: number) {
  const expiresAt = Date.now() + 60 * 60 * 24 * 7 * 1000;
  const payload = `${adminId}.${expiresAt}.${Math.random().toString(36).slice(2)}`;
  return `${payload}.${signPayload(payload)}`;
}

function verifyToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 4) return 0;
  const payload = parts.slice(0, 3).join('.');
  const signature = parts[3];
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return 0;
  if (signature !== signPayload(payload)) return 0;
  return Number(parts[0]) || 0;
}

function publicAdmin(admin: AdminAccount) {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    last_login: admin.last_login,
    has_secret_key: Boolean(admin.secretKey)
  };
}

function passwordErrors(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Special character');
  return errors;
}

async function parseBody(req: any) {
  const raw = await readRequestBody(req);
  if (!raw?.length) return {};

  const text = raw.toString('utf8');
  const contentType = String(req.headers?.['content-type'] || '');
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  return {};
}

function sendUnauthorized(res: any) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function collectionByName(name: string) {
  if (name === 'teachers') return state.teachers;
  if (name === 'students') return state.students;
  if (name === 'staff') return state.staff;
  if (name === 'content') return state.content;
  if (name === 'settings') return state.settings;
  return null;
}

async function handleAuth(req: any, res: any, path: string) {
  if (path === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const allowed = checkLoginAllowed(req, username);
    if (!allowed.allowed) {
      addDangerNotice(
        `Admin panelga kirishga urinish bloklandi. Login: ${username}, IP: ${clientIp(req)}, xato urinishlar: ${allowed.failedCount}, kutish: ${Math.ceil(allowed.retryAfter / 60)} daqiqa.`
      );
      return res.status(429).json({
        error: `Juda ko'p xato urinish. ${Math.ceil(allowed.retryAfter / 60)} daqiqadan keyin urinib ko'ring.`,
        retryAfter: allowed.retryAfter
      });
    }

    const admin = admins.find((item) => item.username === username && item.password === password);
    if (!admin) {
      const failed = recordFailedLogin(req, username);
      if (failed.retryAfter) {
        return res.status(429).json({
          error: `3 marta xato kiritildi. ${Math.ceil(failed.retryAfter / 60)} daqiqa kuting.`,
          retryAfter: failed.retryAfter
        });
      }
      return res.status(401).json({ error: 'Username or password is incorrect' });
    }

    resetLoginAttempts(req, username);
    const token = createToken(admin.id);
    admin.last_login = nowIso();
    addLog(`Admin kirdi: ${admin.username}`, 'login');
    setCookie(res, token);
    return res.status(200).json({
      message: 'Login successful',
      admin: publicAdmin(admin),
      device: { id: 1, device_name: 'Vercel session', is_active: true }
    });
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    clearCookie(res);
    return res.status(200).json({ message: 'Logged out' });
  }

  const admin = currentAdmin(req);
  if (!admin) return sendUnauthorized(res);

  if (path === '/api/auth/profile' && req.method === 'GET') {
    return res.status(200).json({ admin: publicAdmin(admin), device: { id: 1, is_active: true } });
  }

  if (path === '/api/auth/change-password' && req.method === 'POST') {
    const body = await parseBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (currentPassword !== admin.password) return res.status(401).json({ error: 'Current password is incorrect' });

    const errors = passwordErrors(newPassword);
    if (errors.length) return res.status(400).json({ error: 'Weak password', details: errors });

    admin.password = newPassword;
    addLog(`Admin parol o'zgartirdi: ${admin.username}`, 'security');
    return res.status(200).json({ message: 'Password changed successfully' });
  }

  if (path === '/api/auth/set-secret-key' && req.method === 'POST') {
    const body = await parseBody(req);
    const secretKey = String(body.secretKey || '');
    if (secretKey.length < 16) return res.status(400).json({ error: 'Secret key must be at least 16 characters' });
    admin.secretKey = secretKey;
    addLog(`Admin maxfiy so'zni yangiladi: ${admin.username}`, 'security');
    return res.status(200).json({ message: 'Secret key updated successfully' });
  }

  return res.status(404).json({ error: 'Not found' });
}

async function handleLocalApi(req: any, res: any) {
  const url = new URL(req.url || '/', 'https://admin.local');
  const rewrittenPath = url.searchParams.get('path');
  const path = rewrittenPath
    ? `/api/${rewrittenPath}`.replace(/\/+$/, '')
    : (url.pathname.replace(/\/+$/, '') || '/api');
  const method = req.method || 'GET';

  if (path.startsWith('/api/auth')) return handleAuth(req, res, path);

  const adminOnly = method !== 'GET' || path.startsWith('/api/admin');
  if (adminOnly && !currentAdmin(req)) return sendUnauthorized(res);

  if (path === '/api/health') return res.status(200).json({ status: 'ok', mode: 'serverless' });

  if (path === '/api/admin/stats') {
    return res.status(200).json({
      stats: {
        teachers: state.teachers.length,
        students: state.students.length,
        staff: state.staff.length,
        news: state.content.filter((item) => item.category === 'news').length,
        gallery: state.content.filter((item) => item.category === 'gallery').length,
        published: state.content.filter((item) => item.is_published !== false).length,
        drafts: state.content.filter((item) => item.is_published === false).length,
        views: state.content.reduce((sum, item) => sum + Number(item.views || 0), 0)
      }
    });
  }

  if (path === '/api/admin/activity') return res.status(200).json({ logs });
  if (path === '/api/admin/notifications') return res.status(200).json({ notifications });

  if (path === '/api/sections' && method === 'GET') return res.status(200).json({ content: state.sections });
  if (path.startsWith('/api/sections/')) {
    const [, , , page] = path.split('/');
    if (method === 'GET') return res.status(200).json({ content: state.sections[page] || {} });
    if (method === 'PUT' || method === 'POST') {
      state.sections[page] = await parseBody(req);
      addLog(`${page} sahifa kontenti saqlandi`, 'update');
      return res.status(200).json({ message: 'Section updated', content: state.sections[page] });
    }
  }

  for (const name of ['teachers', 'students', 'staff', 'content', 'settings']) {
    if (path === `/api/${name}`) {
      const collection = collectionByName(name)!;
      if (method === 'GET') return res.status(200).json({ [name]: collection });
      if (method === 'POST') {
        const body = await parseBody(req);
        const item = { id: nextId++, ...body, is_active: body.is_active ?? true, is_published: body.is_published ?? true, created_at: nowIso() };
        collection.unshift(item);
        addLog(`${name} yaratildi`, 'create');
        return res.status(201).json({ message: 'Created', [singularName(name)]: item });
      }
    }

    if (path.startsWith(`/api/${name}/`)) {
      const collection = collectionByName(name)!;
      const id = Number(path.split('/')[3]);
      const index = collection.findIndex((item) => Number(item.id) === id);

      if (method === 'PUT' || method === 'PATCH') {
        if (index >= 0) collection[index] = { ...collection[index], ...(await parseBody(req)), updated_at: nowIso() };
        addLog(`${name} yangilandi`, 'update');
        return res.status(200).json({ message: 'Updated', [singularName(name)]: index >= 0 ? collection[index] : null });
      }

      if (method === 'DELETE') {
        if (index >= 0) collection.splice(index, 1);
        addLog(`${name} o'chirildi`, 'delete');
        return res.status(200).json({ message: 'Deleted' });
      }
    }
  }

  if (path === '/api/contact' && method === 'POST') {
    addLog('Kontakt formadan xabar yuborildi', 'contact');
    return res.status(200).json({ message: 'Message sent' });
  }

  return res.status(404).json({ error: 'Not found' });
}

function singularName(name: string) {
  if (name === 'teachers') return 'teacher';
  if (name === 'students') return 'student';
  if (name === 'settings') return 'setting';
  return name;
}

async function proxyToBackend(req: any, res: any, backendOrigin: string) {
  try {
    const incomingUrl = new URL(req.url || '/', 'https://admin.local');
    const upstreamBase = new URL(backendOrigin);
    const upstreamPath = incomingUrl.pathname.replace(/^\/api\/?/, '/api/');
    const upstreamUrl = new URL(`${upstreamPath}${incomingUrl.search}`, upstreamBase);
    const method = req.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: copyRequestHeaders(req),
      body,
      redirect: 'manual'
    });

    copyResponseHeaders(upstreamResponse, res);
    res.status(upstreamResponse.status).send(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(502).json({ error: 'Admin API proxy failed.' });
  }
}

export default async function proxy(req: any, res: any) {
  const backendOrigin = getBackendOrigin();
  if (backendOrigin) return proxyToBackend(req, res, backendOrigin);
  return handleLocalApi(req, res);
}

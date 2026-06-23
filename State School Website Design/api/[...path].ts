export const config = {
  api: {
    bodyParser: false
  }
};

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
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
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

export default async function handler(req: any, res: any) {
  const backendOrigin = getBackendOrigin();

  if (!backendOrigin) {
    res.status(500).json({
      error: 'BACKEND_ORIGIN is not configured for the admin API proxy.'
    });
    return;
  }

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

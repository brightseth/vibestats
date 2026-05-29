export const NO_STORE_HEADERS = Object.freeze({ 'Cache-Control': 'no-store' });

export function setNoStore(res) {
  res.setHeader('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
}

export function json(res, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.status(status).json(body);
}

export function methodNotAllowed(res, allowed, headers = {}) {
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' }, headers);
}

const DEFAULT_MAX_JSON_BYTES = 64 * 1024;

function payloadTooLarge() {
  const err = new Error('JSON body too large');
  err.statusCode = 413;
  return err;
}

export async function readJson(req, { maxBytes = DEFAULT_MAX_JSON_BYTES } = {}) {
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > maxBytes) throw payloadTooLarge();
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.length) {
    if (Buffer.byteLength(req.body, 'utf8') > maxBytes) throw payloadTooLarge();
    return JSON.parse(req.body);
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw payloadTooLarge();
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function requestOrigin(req) {
  const host = req.headers?.host || 'localhost:3000';
  const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    ? 'http'
    : (req.headers?.['x-forwarded-proto'] || 'https');
  return `${proto}://${host}`;
}

export function requireSameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return;

  const allowed = new Set([requestOrigin(req)]);
  if (process.env.VIBESTATS_URL) {
    try {
      allowed.add(new URL(process.env.VIBESTATS_URL).origin);
    } catch {
      // Ignore bad env here; the launch doctor validates it explicitly.
    }
  }

  let actual;
  try {
    actual = new URL(origin).origin;
  } catch {
    const err = new Error('Invalid Origin header');
    err.statusCode = 403;
    throw err;
  }

  if (!allowed.has(actual)) {
    const err = new Error('Cross-origin mutation blocked');
    err.statusCode = 403;
    throw err;
  }
}

export function safeReturnTo(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/api/')) return fallback;
  return value;
}

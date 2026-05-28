export function json(res, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.status(status).json(body);
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' });
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
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

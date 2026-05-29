import { clearSessionCookie } from '../_lib/auth.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, requireSameOrigin } from '../_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);
  try {
    requireSameOrigin(req);
  } catch (err) {
    return json(res, err.statusCode || 403, { error: err.message || 'Logout failed' }, NO_STORE_HEADERS);
  }
  clearSessionCookie(req, res);
  json(res, 200, { ok: true }, NO_STORE_HEADERS);
}

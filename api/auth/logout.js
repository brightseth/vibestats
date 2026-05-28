import { clearSessionCookie } from '../_lib/auth.js';
import { json, methodNotAllowed, requireSameOrigin } from '../_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    requireSameOrigin(req);
  } catch (err) {
    return json(res, err.statusCode || 403, { error: err.message || 'Logout failed' });
  }
  clearSessionCookie(req, res);
  json(res, 200, { ok: true });
}

import { clearSessionCookie } from '../_lib/auth.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  clearSessionCookie(req, res);
  json(res, 200, { ok: true });
}


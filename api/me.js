import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { publicUser } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  try {
    const user = await requireUser(req);
    if (!user) {
      clearSessionCookie(req, res);
      return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);
    }

    json(res, 200, { user: publicUser(user, { includePrivacy: true }) }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/me error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Session failed' }, NO_STORE_HEADERS);
  }
}

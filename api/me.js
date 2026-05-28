import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { publicUser } from './_lib/db.js';
import { json, methodNotAllowed } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const user = await requireUser(req);
    if (!user) {
      clearSessionCookie(req, res);
      return json(res, 401, { error: 'Not authenticated' });
    }

    json(res, 200, { user: publicUser(user, { includePrivacy: true }) }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Session failed' });
  }
}


import { clearSessionCookie, requireUser } from './_lib/auth.js';
import { publicUser, sql } from './_lib/db.js';
import { json, methodNotAllowed, readJson } from './_lib/http.js';

const PRIVACY_VALUES = new Set(['public', 'unlisted', 'private']);

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
  }

  try {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' });

    if (req.method === 'GET') {
      return json(res, 200, { user: publicUser(user, { includePrivacy: true }) }, {
        'Cache-Control': 'no-store',
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const privacy = String(body.privacy || '');
      if (!PRIVACY_VALUES.has(privacy)) {
        return json(res, 400, { error: 'Invalid privacy value' });
      }

      const rows = await sql()`
        update users
        set privacy = ${privacy}, last_seen_at = now()
        where id = ${user.id}
        returning id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
      `;
      return json(res, 200, { user: publicUser(rows[0], { includePrivacy: true }) });
    }

    await sql()`delete from users where id = ${user.id}`;
    clearSessionCookie(req, res);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('/api/settings error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Settings failed' });
  }
}


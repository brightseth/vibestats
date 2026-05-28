import { readSession } from '../_lib/auth.js';
import { publicUser, sql } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

function getHandle(req) {
  const raw = req.query?.handle;
  if (Array.isArray(raw)) return raw[0];
  return raw || '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const handle = String(getHandle(req)).trim();
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(handle)) {
    return json(res, 400, { error: 'Invalid handle' });
  }

  try {
    const rows = await sql()`
      select id, gh_id, gh_handle, avatar_url, privacy, created_at, last_seen_at
      from users
      where lower(gh_handle) = lower(${handle})
      limit 1
    `;
    const user = rows[0];
    if (!user) return json(res, 404, { error: 'Profile not found' });

    const session = readSession(req);
    const isOwner = session?.sub === user.id;
    if (user.privacy === 'private' && !isOwner) {
      return json(res, 404, { error: 'Profile not found' });
    }

    const uploads = await sql()`
      select id, archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
      limit 50
    `;

    json(res, 200, {
      user: publicUser(user, { includePrivacy: isOwner }),
      is_owner: Boolean(isOwner),
      uploads,
    }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('GET /api/u/[handle] error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Profile failed' });
  }
}

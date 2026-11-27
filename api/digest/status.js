import { clearSessionCookie, originForRequest, requireUser } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { buildDigestStatus } from '../_lib/digest-status.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, safeErrorMessage } from '../_lib/http.js';
import { getProfileSettings } from '../_lib/profile-settings.js';

async function latestUploads(userId) {
  return sql()`
    select archetype, scores, metrics, raw_meta, uploaded_at
    from uploads
    where user_id = ${userId}
    order by uploaded_at desc
    limit 8
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  try {
    const user = await requireUser(req);
    if (!user) {
      clearSessionCookie(req, res);
      return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);
    }

    return json(res, 200, buildDigestStatus({
      user,
      settings: await getProfileSettings(user.id),
      uploads: await latestUploads(user.id),
      origin: originForRequest(req),
    }), NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/digest/status error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Digest status failed') }, NO_STORE_HEADERS);
  }
}

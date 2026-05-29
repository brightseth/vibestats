import { readSyncSession, syncTokenIsRevoked } from './_lib/auth.js';
import { getUserById, sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, readJson } from './_lib/http.js';
import { profileLinks } from './_lib/profile-links.js';
import { sanitizeUploadPayload } from './_lib/uploads.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'], NO_STORE_HEADERS);

  try {
    const session = readSyncSession(req);
    const user = session?.sub ? await getUserById(session.sub) : null;
    if (!user) return json(res, 401, { error: 'Invalid sync token' }, NO_STORE_HEADERS);

    const settingsRows = await sql()`
      select sync_token_invalidated_at
      from profile_settings
      where user_id = ${user.id}
      limit 1
    `;
    if (syncTokenIsRevoked(session, settingsRows[0]?.sync_token_invalidated_at)) {
      return json(res, 401, { error: 'Sync token revoked. Generate a new token from Settings.' }, NO_STORE_HEADERS);
    }

    const recent = await sql()`
      select count(*)::int as count
      from uploads
      where user_id = ${user.id}
        and uploaded_at > now() - interval '1 day'
    `;
    if ((recent[0]?.count || 0) >= 5) {
      return json(res, 429, { error: 'Sync limit reached: 5 profile saves per day' }, NO_STORE_HEADERS);
    }

    const payload = sanitizeUploadPayload(await readJson(req, { maxBytes: 64 * 1024 }));
    const rows = await sql()`
      insert into uploads (user_id, archetype, scores, metrics, raw_meta)
      values (
        ${user.id},
        ${payload.archetype},
        ${sql().json(payload.scores)},
        ${sql().json(payload.metrics)},
        ${sql().json(payload.raw_meta)}
      )
      returning id, archetype, scores, metrics, raw_meta, uploaded_at
    `;
    await sql()`update users set last_seen_at = now() where id = ${user.id}`;

    return json(res, 201, {
      ok: true,
      ...profileLinks(user, payload.archetype),
      upload: rows[0],
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('POST /api/sync error:', err);
    return json(res, err.statusCode || 500, { error: err.message || 'Sync failed' }, NO_STORE_HEADERS);
  }
}

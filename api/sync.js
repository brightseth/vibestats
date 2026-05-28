import { requireSyncUser } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { json, methodNotAllowed, readJson } from './_lib/http.js';
import { sanitizeUploadPayload } from './_lib/uploads.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const user = await requireSyncUser(req);
    if (!user) return json(res, 401, { error: 'Invalid sync token' }, { 'Cache-Control': 'no-store' });

    const recent = await sql()`
      select count(*)::int as count
      from uploads
      where user_id = ${user.id}
        and uploaded_at > now() - interval '1 day'
    `;
    if ((recent[0]?.count || 0) >= 5) {
      return json(res, 429, { error: 'Sync limit reached: 5 profile saves per day' }, { 'Cache-Control': 'no-store' });
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
      profile_url: `/u/${user.gh_handle}`,
      upload: rows[0],
    }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('POST /api/sync error:', err);
    return json(res, err.statusCode || 500, { error: err.message || 'Sync failed' }, {
      'Cache-Control': 'no-store',
    });
  }
}

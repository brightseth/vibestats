import { requireUser } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { json, methodNotAllowed, readJson, requireSameOrigin } from './_lib/http.js';
import { sanitizeUploadPayload } from './_lib/uploads.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' });

    const recent = await sql()`
      select count(*)::int as count
      from uploads
      where user_id = ${user.id}
        and uploaded_at > now() - interval '1 day'
    `;
    if ((recent[0]?.count || 0) >= 5) {
      return json(res, 429, { error: 'Upload limit reached: 5 profile saves per day' });
    }

    const payload = sanitizeUploadPayload(await readJson(req));
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

    json(res, 201, {
      ok: true,
      profile_url: `/u/${user.gh_handle}`,
      upload: rows[0],
    });
  } catch (err) {
    console.error('POST /api/uploads error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Upload failed' });
  }
}

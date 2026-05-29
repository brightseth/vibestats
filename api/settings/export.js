import { requireUser } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { exportableUpload } from '../_lib/export-upload.js';
import { NO_STORE_HEADERS, json, methodNotAllowed } from '../_lib/http.js';
import { getProfileSettings, ownerProfileSettings } from '../_lib/profile-settings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'], NO_STORE_HEADERS);

  try {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);

    const uploads = await sql()`
      select id, archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
    `;
    const settings = await getProfileSettings(user.id);

    res.setHeader('Content-Disposition', 'attachment; filename="vibestats-export.json"');
    json(res, 200, {
      exported_at: new Date().toISOString(),
      user: {
        gh_handle: user.gh_handle,
        avatar_url: user.avatar_url,
        privacy: user.privacy,
        created_at: user.created_at,
      },
      settings: ownerProfileSettings(settings),
      uploads: uploads.map(exportableUpload),
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('GET /api/settings/export error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Export failed' }, NO_STORE_HEADERS);
  }
}

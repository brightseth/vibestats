import { requireUser } from '../_lib/auth.js';
import { sql } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' });

    const uploads = await sql()`
      select id, archetype, scores, metrics, raw_meta, uploaded_at
      from uploads
      where user_id = ${user.id}
      order by uploaded_at desc
    `;

    res.setHeader('Content-Disposition', 'attachment; filename="vibestats-export.json"');
    json(res, 200, {
      exported_at: new Date().toISOString(),
      user: {
        gh_handle: user.gh_handle,
        avatar_url: user.avatar_url,
        privacy: user.privacy,
        created_at: user.created_at,
      },
      uploads,
    }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('GET /api/settings/export error:', err);
    json(res, err.statusCode || 500, { error: err.message || 'Export failed' });
  }
}


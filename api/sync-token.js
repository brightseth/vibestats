import { createSyncToken, originForRequest, requireUser, syncTokenExpiresAt } from './_lib/auth.js';
import { json, methodNotAllowed, requireSameOrigin } from './_lib/http.js';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' }, { 'Cache-Control': 'no-store' });

    const token = createSyncToken(user);
    const origin = originForRequest(req);
    return json(res, 200, {
      token,
      expires_at: syncTokenExpiresAt(),
      command: `npx vibestats sync --host ${shellQuote(origin)} --token ${shellQuote(token)}`,
    }, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    console.error('POST /api/sync-token error:', err);
    return json(res, err.statusCode || 500, { error: err.message || 'Sync token failed' }, {
      'Cache-Control': 'no-store',
    });
  }
}

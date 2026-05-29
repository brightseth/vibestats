import { createSyncToken, originForRequest, requireUser, syncTokenExpiresAt } from './_lib/auth.js';
import { sql } from './_lib/db.js';
import { NO_STORE_HEADERS, json, methodNotAllowed, requireSameOrigin, safeErrorMessage } from './_lib/http.js';

const DEFAULT_CLI_PACKAGE = 'github:brightseth/vibestats#feat/wave-1-identity';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function syncCommand(origin, token) {
  const packageSpec = process.env.VIBESTATS_CLI_PACKAGE || DEFAULT_CLI_PACKAGE;
  return `npx --yes ${shellQuote(packageSpec)} sync --host ${shellQuote(origin)} --token ${shellQuote(token)}`;
}

export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) return methodNotAllowed(res, ['POST', 'DELETE'], NO_STORE_HEADERS);

  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'Not authenticated' }, NO_STORE_HEADERS);

    if (req.method === 'DELETE') {
      const revokedAt = new Date();
      const rows = await sql()`
        insert into profile_settings (user_id, sync_token_invalidated_at, updated_at)
        values (${user.id}, ${revokedAt}, now())
        on conflict (user_id) do update
          set sync_token_invalidated_at = excluded.sync_token_invalidated_at,
              updated_at = now()
        returning sync_token_invalidated_at
      `;
      return json(res, 200, {
        ok: true,
        sync_token_invalidated_at: rows[0]?.sync_token_invalidated_at || null,
      }, NO_STORE_HEADERS);
    }

    const token = createSyncToken(user);
    const origin = originForRequest(req);
    return json(res, 200, {
      token,
      expires_at: syncTokenExpiresAt(),
      command: syncCommand(origin, token),
    }, NO_STORE_HEADERS);
  } catch (err) {
    console.error('POST /api/sync-token error:', err);
    return json(res, err.statusCode || 500, { error: safeErrorMessage(err, 'Sync token failed') }, NO_STORE_HEADERS);
  }
}
